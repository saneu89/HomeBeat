import { getDownloadedFile } from '@/database/trackRepo';
import { getMatchProviders, getProvider, MATCH_ORDER } from '@/providers';
import type { UnifiedItem } from '@/types/UnifiedItem';

import { bestMatch } from './matching';
import { assertStreamReadable } from './streams/fetchUtils';
import { resolveAutoQuality } from './streams/quality';
import type { ResolvedStream, StreamAttempt, StreamQuality } from './streams/types';

/**
 * StreamResolver (Abschnitt 2):
 * - Stream-URLs werden erst beim Abspielen geholt und nur kurz zwischengespeichert.
 * - Reihenfolge: lokale Datei → eigene Quelle (bei YouTube: Direktabruf mit mehreren Clients)
 *   → gleicher Song bei anderen Quellen („Künstler – Titel“ mit Dauer-Abgleich ±5 s) in der
 *   Reihenfolge YouTube Music, JioSaavn, SoundCloud, Audius → zuletzt Invidious/Piped (langsam,
 *   meist offline – stünden sie vorne, käme die Ausweichquelle erst nach bis zu ~50 s).
 * - Jede URL wird vor der Übergabe an den Player ab ~1 MB probegelesen (YouTube ohne PO-Token: 403).
 * - Fehlgeschlagene Wege werden über `exclude` übersprungen, damit der Player bei einem Fehler
 *   automatisch den nächsten Weg nimmt.
 */

export interface ResolveOptions {
  quality?: StreamQuality;
  /** Schlüssel bereits fehlgeschlagener Wege. */
  exclude?: ReadonlySet<string>;
  signal?: AbortSignal;
  /** Offline-Modus: nur lokale Dateien. */
  offlineOnly?: boolean;
}

export interface ResolveResult {
  stream: ResolvedStream;
  /** Schlüssel des erfolgreichen Wegs – bei späterem Wiedergabefehler in `exclude` aufnehmen. */
  attemptKey: string;
  /** Der Eintrag, dessen Stream tatsächlich gespielt wird (bei Songs ohne eigenen Stream: der Treffer). */
  playedItem: UnifiedItem;
  /** Fehlermeldungen übersprungener Wege (für die Diagnose). */
  failures: string[];
}

export class StreamUnavailableError extends Error {
  constructor(public readonly failures: string[]) {
    super('Für diesen Song wurde gerade keine abspielbare Quelle gefunden.');
    this.name = 'StreamUnavailableError';
  }
}

/** „Nur kurz“: höchstens 10 Minuten, nie über die Gültigkeit der URL hinaus. */
const CACHE_TTL_MS = 10 * 60 * 1000;
const ATTEMPT_TIMEOUT_MS = 12_000;
const MATCH_SEARCH_TIMEOUT_MS = 8_000;

type Candidate = { key: string; item: UnifiedItem; attempt: StreamAttempt };

function withTimeout<T>(run: (signal: AbortSignal) => Promise<T>, timeoutMs: number, outer?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  outer?.addEventListener('abort', onAbort);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('Zeitüberschreitung'));
    }, timeoutMs);
  });
  return Promise.race([run(controller.signal), timeout]).finally(() => {
    clearTimeout(timer);
    outer?.removeEventListener('abort', onAbort);
  });
}

class StreamResolverImpl {
  private cache = new Map<string, { result: ResolveResult; until: number }>();
  /** Treffer für Songs ohne eigenen Stream: "<itemId>|<providerId>" → Treffer oder null (nichts gefunden). */
  private matches = new Map<string, UnifiedItem | null>();

  /** Verwirft den zwischengespeicherten Stream (z. B. nach einem Wiedergabefehler). */
  invalidate(itemId: string): void {
    for (const key of this.cache.keys()) if (key.startsWith(`${itemId}|`)) this.cache.delete(key);
  }

  async resolve(item: UnifiedItem, options: ResolveOptions = {}): Promise<ResolveResult> {
    const quality = await resolveAutoQuality(options.quality ?? 'auto');
    const exclude = options.exclude ?? new Set<string>();
    const cacheKey = `${item.id}|${quality}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.until > Date.now() && !exclude.has(cached.result.attemptKey)) {
      return { ...cached.result, failures: [] }; // Fehlschläge stehen schon im Protokoll des ersten Abrufs
    }

    const failures: string[] = [];
    for await (const candidate of this.candidates(item, quality, exclude, failures, options)) {
      try {
        const stream = await withTimeout(async (signal) => {
          const s = await candidate.attempt.resolve(signal);
          // HLS-Wiedergabelisten sind klein – dort nichts zu prüfen.
          if (!s.isLocal && !/mpegurl/i.test(s.mimeType ?? '')) await assertStreamReadable(s.url, s.headers, signal);
          return s;
        }, ATTEMPT_TIMEOUT_MS, options.signal);
        const result: ResolveResult = { stream, attemptKey: candidate.key, playedItem: candidate.item, failures };
        if (!stream.isLocal) {
          this.cache.set(cacheKey, { result, until: Math.min(stream.expiresAt, Date.now() + CACHE_TTL_MS) });
        }
        return result;
      } catch (e) {
        options.signal?.throwIfAborted();
        failures.push(`${candidate.key}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    throw new StreamUnavailableError(failures);
  }

  private async *candidates(
    item: UnifiedItem,
    quality: Exclude<StreamQuality, 'auto'>,
    exclude: ReadonlySet<string>,
    failures: string[],
    options: ResolveOptions,
  ): AsyncGenerator<Candidate> {
    // 1. Lokale Datei (funktioniert auch im Flugmodus)
    const file = item.localFileUri ? null : await getDownloadedFile(item.id);
    const localUri = item.localFileUri ?? file?.fileUri;
    if (localUri && !exclude.has('local')) {
      yield {
        key: 'local',
        item,
        attempt: {
          key: 'local',
          resolve: async () => ({
            url: localUri,
            source: item.source,
            via: 'Datei',
            isLocal: true,
            bitrateKbps: file?.bitrateKbps ?? item.bitrateKbps,
            codec: file?.codec ?? item.codec,
            expiresAt: Number.MAX_SAFE_INTEGER,
          }),
        },
      };
    }
    if (options.offlineOnly) return;

    // 2. Eigene Quelle des Eintrags
    const own = getProvider(item.source);
    for (const attempt of own?.streamAttempts?.(item, quality) ?? []) {
      if (!exclude.has(attempt.key)) yield { key: attempt.key, item, attempt };
    }

    // 3. Gleicher Song bei anderen Quellen
    if (item.type === 'track') {
      const matchProviders = getMatchProviders();
      for (const id of MATCH_ORDER) {
        if (id === item.source) continue;
        const provider = matchProviders.find((p) => p.id === id);
        if (!provider) {
          failures.push(`match:${id}: ohne Schlüssel – nicht versucht`);
          continue;
        }
        const match = await this.findMatch(item, provider.id, options.signal, failures);
        if (!match) continue;
        for (const attempt of provider.streamAttempts?.(match, quality) ?? []) {
          const key = `match:${provider.id}:${attempt.key}`;
          if (!exclude.has(key)) yield { key, item: match, attempt };
        }
      }
    }

    // 4. Langsame Notwege der eigenen Quelle (Invidious/Piped) zuletzt
    for (const attempt of own?.fallbackStreamAttempts?.(item, quality) ?? []) {
      if (!exclude.has(attempt.key)) yield { key: attempt.key, item, attempt };
    }
  }

  private async findMatch(
    item: UnifiedItem,
    providerId: UnifiedItem['source'],
    signal: AbortSignal | undefined,
    failures: string[],
  ): Promise<UnifiedItem | null> {
    const key = `${item.id}|${providerId}`;
    if (this.matches.has(key)) return this.matches.get(key) ?? null;
    const provider = getProvider(providerId);
    if (!provider) return null;
    try {
      const results = await withTimeout(
        (s) => provider.search(`${item.artist} ${item.title}`.trim(), { types: ['track'], signal: s, limit: 15 }),
        MATCH_SEARCH_TIMEOUT_MS,
        signal,
      );
      const match = bestMatch(item, results) ?? null;
      this.matches.set(key, match);
      if (!match) failures.push(`suche:${providerId}: ${results.length} Ergebnisse, kein passender Treffer (Künstler/Titel/Dauer ±5 s)`);
      return match;
    } catch (e) {
      signal?.throwIfAborted();
      failures.push(`suche:${providerId}: ${e instanceof Error ? e.message : String(e)}`);
      return null;
    }
  }
}

export const StreamResolver = new StreamResolverImpl();

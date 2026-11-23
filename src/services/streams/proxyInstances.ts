import { fetchJson, fetchWithTimeout } from './fetchUtils';
import { pickFormat, splitMime } from './quality';
import type { ResolvedStream, StreamAttempt, StreamQuality } from './types';

/**
 * Ausweichwege für YouTube über öffentliche Piped- und Invidious-Instanzen.
 * Die Instanzlisten werden zur Laufzeit geladen (keine fest eingetragenen Adressen)
 * und eine Stunde im Speicher gehalten. Instanzen, die zuletzt fehlschlugen, kommen nach hinten.
 */

const INVIDIOUS_LIST_URL = 'https://api.invidious.io/instances.json?sort_by=type,users';
/** Offizielle Liste der Piped-Instanzen (Markdown-Tabelle im Doku-Repository). */
const PIPED_LIST_URL =
  'https://raw.githubusercontent.com/TeamPiped/documentation/main/content/docs/public-instances/index.md';

const LIST_TTL_MS = 60 * 60 * 1000;
const MAX_INSTANCES_PER_KIND = 3;
const STREAM_TTL_MS = 20 * 60 * 1000;

type Kind = 'invidious' | 'piped';

const lists: Record<Kind, { at: number; hosts: string[] } | null> = { invidious: null, piped: null };
const failures = new Map<string, number>();

async function loadInvidious(): Promise<string[]> {
  type Entry = [string, { api?: boolean | null; type?: string; uri?: string }];
  const data = await fetchJson<Entry[]>(INVIDIOUS_LIST_URL, { timeoutMs: 6000 });
  return data
    .filter(([, info]) => info.type === 'https' && info.api === true && !!info.uri)
    .map(([, info]) => info.uri!.replace(/\/$/, ''));
}

async function loadPiped(): Promise<string[]> {
  const res = await fetchWithTimeout(PIPED_LIST_URL, { timeoutMs: 6000 });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const md = await res.text();
  const hosts: string[] = [];
  for (const line of md.split('\n')) {
    const cols = line.split('|').map((c) => c.trim());
    const api = cols.find((c) => /^https:\/\/[^\s/]+\/?$/.test(c));
    if (api) hosts.push(api.replace(/\/$/, ''));
  }
  return hosts;
}

async function getHosts(kind: Kind): Promise<string[]> {
  const cached = lists[kind];
  if (!cached || Date.now() - cached.at > LIST_TTL_MS) {
    try {
      const hosts = kind === 'invidious' ? await loadInvidious() : await loadPiped();
      lists[kind] = { at: Date.now(), hosts };
    } catch {
      lists[kind] = { at: Date.now(), hosts: cached?.hosts ?? [] };
    }
  }
  const hosts = lists[kind]?.hosts ?? [];
  return [...hosts].sort((a, b) => (failures.get(a) ?? 0) - (failures.get(b) ?? 0)).slice(0, MAX_INSTANCES_PER_KIND);
}

function noteResult(host: string, ok: boolean) {
  if (ok) failures.delete(host);
  else failures.set(host, Date.now());
}

async function viaInvidious(host: string, videoId: string, quality: Exclude<StreamQuality, 'auto'>, signal?: AbortSignal): Promise<ResolvedStream> {
  type Fmt = { url: string; type: string; bitrate?: string | number };
  const data = await fetchJson<{ adaptiveFormats?: Fmt[]; liveNow?: boolean; hlsUrl?: string }>(
    `${host}/api/v1/videos/${encodeURIComponent(videoId)}?local=true&fields=adaptiveFormats,liveNow,hlsUrl`,
    { timeoutMs: 8000, signal },
  );
  if (data.liveNow && data.hlsUrl) {
    return { url: data.hlsUrl, mimeType: 'application/x-mpegURL', source: 'yt', via: 'Invidious', isLocal: false, expiresAt: Date.now() + STREAM_TTL_MS };
  }
  const audio = (data.adaptiveFormats ?? [])
    .filter((f) => f.type?.startsWith('audio/'))
    .map((f) => {
      const { mime, codec } = splitMime(f.type);
      return { url: f.url, mimeType: mime, codec, bitrateKbps: Math.round(Number(f.bitrate ?? 0) / 1000) };
    });
  const chosen = pickFormat(audio, quality);
  if (!chosen) throw new Error(`Invidious ${new URL(host).host}: keine Audio-Variante`);
  return {
    url: chosen.url,
    mimeType: chosen.mimeType,
    codec: chosen.codec,
    bitrateKbps: chosen.bitrateKbps,
    source: 'yt',
    via: 'Invidious',
    isLocal: false,
    expiresAt: Date.now() + STREAM_TTL_MS,
  };
}

async function viaPiped(host: string, videoId: string, quality: Exclude<StreamQuality, 'auto'>, signal?: AbortSignal): Promise<ResolvedStream> {
  type Fmt = { url: string; mimeType?: string; codec?: string; bitrate?: number };
  const data = await fetchJson<{ audioStreams?: Fmt[]; livestream?: boolean; hls?: string; error?: string }>(
    `${host}/streams/${encodeURIComponent(videoId)}`,
    { timeoutMs: 8000, signal },
  );
  if (data.error) throw new Error(`Piped ${new URL(host).host}: ${data.error.slice(0, 120)}`);
  if (data.livestream && data.hls) {
    return { url: data.hls, mimeType: 'application/x-mpegURL', source: 'yt', via: 'Piped', isLocal: false, expiresAt: Date.now() + STREAM_TTL_MS };
  }
  const audio = (data.audioStreams ?? []).map((f) => ({
    url: f.url,
    mimeType: f.mimeType ?? 'audio/mp4',
    codec: f.codec?.split('.')[0],
    bitrateKbps: Math.round((f.bitrate ?? 0) / 1000),
  }));
  const chosen = pickFormat(audio, quality);
  if (!chosen) throw new Error(`Piped ${new URL(host).host}: keine Audio-Variante`);
  return {
    url: chosen.url,
    mimeType: chosen.mimeType,
    codec: chosen.codec,
    bitrateKbps: chosen.bitrateKbps,
    source: 'yt',
    via: 'Piped',
    isLocal: false,
    expiresAt: Date.now() + STREAM_TTL_MS,
  };
}

/**
 * Liefert Versuche über Invidious und Piped. Die Instanzlisten werden erst geladen,
 * wenn der erste Versuch tatsächlich gebraucht wird.
 */
export function proxyAttempts(videoId: string, quality: Exclude<StreamQuality, 'auto'>): StreamAttempt[] {
  const attempts: StreamAttempt[] = [];
  for (const kind of ['invidious', 'piped'] as const) {
    for (let slot = 0; slot < MAX_INSTANCES_PER_KIND; slot++) {
      attempts.push({
        key: `${kind}:${slot}`,
        resolve: async (signal?: AbortSignal) => {
          const hosts = await getHosts(kind);
          const host = hosts[slot];
          if (!host) throw new Error(`Keine weitere ${kind === 'piped' ? 'Piped' : 'Invidious'}-Instanz verfügbar`);
          try {
            const result =
              kind === 'invidious'
                ? await viaInvidious(host, videoId, quality, signal)
                : await viaPiped(host, videoId, quality, signal);
            noteResult(host, true);
            return result;
          } catch (e) {
            noteResult(host, false);
            throw e;
          }
        },
      });
    }
  }
  return attempts;
}

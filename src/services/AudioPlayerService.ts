import TrackPlayer, {
  Event,
  PlaybackState,
  PlayerCommand,
  type MediaItem,
} from '@rntp/player';

import { recordPlay, recordSkip } from '@/database/trackRepo';
import type { UnifiedItem } from '@/types/UnifiedItem';

import { currentEntry, playerStore, type QueueEntry, type SleepTimerChoice } from './playerStore';
import { StreamResolver, StreamUnavailableError, type ResolveResult } from './StreamResolver';
import { fetchWithTimeout } from './streams/fetchUtils';
import { toast } from './toastStore';

/**
 * AudioPlayerService (Abschnitt 5) auf Basis von @rntp/player (react-native-track-player v5):
 * Hintergrundwiedergabe, Sperrbildschirm, Benachrichtigung, Bluetooth-Tasten.
 *
 * Die Warteschlange gehört der App (playerStore). Dem nativen Player werden immer nur der
 * aktuelle und der nächste Titel übergeben – jeweils mit frisch aufgelöster Stream-URL, weil
 * Stream-URLs ablaufen. Fällt ein Stream während der Wiedergabe aus, wird automatisch der
 * nächste Weg/die nächste Quelle genommen und an derselben Stelle weitergespielt.
 * Klappt keine Quelle, stoppt die Wiedergabe bei diesem Song (kein automatischer Sprung zum
 * nächsten Titel): Fehler mit Protokoll anzeigen, „Erneut versuchen“ / „Nächster Song“ anbieten.
 */

const MAX_RECOVERIES_PER_ENTRY = 8;
/** Unter dieser Spielzeit zählt „Weiter“ als Überspringen (für Empfehlungen). */
const SKIP_THRESHOLD_SEC = 30;
const SPEECH_TYPES: ReadonlySet<UnifiedItem['type']> = new Set(['audiobook', 'podcast_episode']);

let uidCounter = 0;
const newUid = () => `q${Date.now().toString(36)}${(uidCounter++).toString(36)}`;

/** Pro Warteschlangen-Eintrag: fehlgeschlagene Wege, der zuletzt genutzte Weg und das Versuchsprotokoll. */
const attempts = new Map<string, { exclude: Set<string>; lastKey?: string; recoveries: number; log: string[] }>();
/** Aufgelöste Streams für den nativen Player, je uid. */
const resolved = new Map<string, ResolveResult>();
/** Läuft gerade eine Ladeoperation? Neuere Operationen machen ältere ungültig. */
let loadToken = 0;
let setupDone = false;

function attemptState(uid: string) {
  let a = attempts.get(uid);
  if (!a) {
    a = { exclude: new Set(), recoveries: 0, log: [] };
    attempts.set(uid, a);
  }
  return a;
}

function toMediaItem(entry: QueueEntry, result: ResolveResult): MediaItem {
  const { item } = entry;
  return {
    mediaId: entry.uid,
    url: result.stream.headers ? { uri: result.stream.url, headers: result.stream.headers } : result.stream.url,
    title: item.title,
    artist: item.artist,
    albumTitle: item.album,
    artworkUrl: item.artworkUrl,
    duration: item.durationSec,
    isLive: item.isLive,
    mimeType: result.stream.mimeType,
    extras: { itemId: item.id },
  };
}

async function resolveEntry(entry: QueueEntry, token: number): Promise<ResolveResult | null> {
  const a = attemptState(entry.uid);
  let result: ResolveResult;
  try {
    result = await StreamResolver.resolve(entry.item, { exclude: a.exclude });
  } catch (e) {
    a.log.push(...(e instanceof StreamUnavailableError ? e.failures : [errorText(e)]));
    throw e;
  }
  a.log.push(...result.failures);
  const s = result.stream;
  a.log.push(`${result.attemptKey}: URL erhalten (${[s.via, s.mimeType, s.bitrateKbps && `${s.bitrateKbps} kbps`].filter(Boolean).join(', ')})${result.playedItem.id !== entry.item.id ? ` – Treffer: „${result.playedItem.title}“ – ${result.playedItem.artist}` : ''}`);
  if (token !== loadToken) return null;
  a.lastKey = result.attemptKey;
  resolved.set(entry.uid, result);
  return result;
}

function publishNowPlaying(entry: QueueEntry, result: ResolveResult) {
  playerStore.set({
    nowPlaying: {
      uid: entry.uid,
      playedSource: result.stream.isLocal ? 'local' : result.stream.source,
      via: result.stream.via,
      bitrateKbps: result.stream.bitrateKbps,
      codec: result.stream.codec,
      isLocal: result.stream.isLocal,
      // Ausweichquelle: tatsächlich gefundenen Eintrag zeigen, damit falsche Treffer auffallen.
      matched: result.playedItem.id !== entry.item.id ? { title: result.playedItem.title, artist: result.playedItem.artist } : undefined,
    },
  });
}

/** Lädt den aktuellen Eintrag neu in den nativen Player (optional ab einer Position). */
async function loadCurrent(options: { autoplay: boolean; startAt?: number }): Promise<void> {
  const token = ++loadToken;
  const s = playerStore.get();
  const entry = currentEntry(s);
  if (!entry) return;
  playerStore.set({ loading: true, error: null, errorDetails: [] });

  // Abspielgeschwindigkeit nur bei Hörbüchern und Podcasts
  const speed = SPEECH_TYPES.has(entry.item.type) ? s.playbackSpeed : 1;
  TrackPlayer.setPlaybackSpeed(speed);

  try {
    const result = await resolveEntry(entry, token);
    if (!result) return;
    TrackPlayer.setMediaItems([toMediaItem(entry, result)]);
    if (options.startAt && options.startAt > 1) TrackPlayer.seekTo(options.startAt);
    if (options.autoplay) TrackPlayer.play();
    publishNowPlaying(entry, result);
    playerStore.set({ loading: false });
    // Bei einer Wiederherstellung (startAt) nicht erneut als „gespielt“ zählen
    if (options.startAt === undefined) recordPlay(entry.item).catch(() => undefined);
    applySleepTimerAfterLoad();
    void prepareNext(token);
  } catch (e) {
    if (token !== loadToken) return;
    failStop(
      entry,
      e instanceof StreamUnavailableError ? `„${entry.item.title}“ konnte über keine Quelle geladen werden.` : errorText(e),
    );
  }
}

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Kein Weg hat funktioniert: Wiedergabe bei diesem Song anhalten – nie automatisch weiterspringen.
 * Der Fehler erscheint im Player und (über die Titel-Metadaten) in der Benachrichtigung/auf dem Sperrbildschirm.
 */
function failStop(entry: QueueEntry, message: string) {
  playerStore.set({ loading: false, error: message, errorDetails: [...attemptState(entry.uid).log] });
  toast.show(message);
  TrackPlayer.pause();
  const active = TrackPlayer.getActiveMediaItemIndex();
  if (active != null && TrackPlayer.getQueue().length > active) {
    // Vorab geladenen nächsten Titel entfernen, damit nichts von selbst weiterläuft.
    if (TrackPlayer.getQueue().length > active + 1) TrackPlayer.removeMediaItems(active + 1, TrackPlayer.getQueue().length);
    TrackPlayer.updateMetadata(active, {
      title: entry.item.title,
      artist: 'Nicht abspielbar – in HomeBeat öffnen',
      artworkUrl: entry.item.artworkUrl,
    });
  }
}

/** Prüfabruf nach einem Player-Fehler: HTTP-Status am Anfang und nach ca. 1 MB (YouTube sperrt teils erst später). */
async function probeStream(result: ResolveResult): Promise<string> {
  if (result.stream.isLocal) return 'lokale Datei';
  const ranges = ['0-65535', '1048576-1114111'];
  const parts = await Promise.all(
    ranges.map(async (range) => {
      try {
        const res = await fetchWithTimeout(result.stream.url, {
          headers: { ...result.stream.headers, Range: `bytes=${range}` },
          timeoutMs: 6000,
        });
        res.body?.cancel().catch(() => undefined);
        return `Bytes ${range}: HTTP ${res.status}`;
      } catch (e) {
        return `Bytes ${range}: ${errorText(e)}`;
      }
    }),
  );
  return parts.join(', ');
}

/** Löst den nächsten Titel vorab auf und hängt ihn an den nativen Player an (lückenloser Übergang). */
async function prepareNext(token: number): Promise<void> {
  const s = playerStore.get();
  const next = s.index + 1 < s.queue.length ? s.queue[s.index + 1] : null;
  if (!next) return;
  try {
    const result = await resolveEntry(next, token);
    if (!result || token !== loadToken) return;
    const queue = TrackPlayer.getQueue();
    const activeIdx = TrackPlayer.getActiveMediaItemIndex() ?? 0;
    // Alles nach dem aktiven Titel ersetzen
    if (queue.length > activeIdx + 1) TrackPlayer.removeMediaItems(activeIdx + 1, queue.length);
    TrackPlayer.addMediaItem(toMediaItem(next, result));
  } catch {
    // Kein Vorab-Stream: Beim Titelende wird der Eintrag regulär geladen (inkl. Ausweichquellen).
  }
}

/** Native Player ist zum nächsten Eintrag gewechselt (automatisch oder per Taste). */
function onTransition(mediaId: string | undefined) {
  if (!mediaId) return;
  const s = playerStore.get();
  const cur = currentEntry(s);
  if (cur?.uid === mediaId) return;
  const idx = s.queue.findIndex((e) => e.uid === mediaId);
  if (idx < 0) return;
  playerStore.set({ index: idx, error: null, errorDetails: [] });
  const entry = s.queue[idx];
  const result = resolved.get(entry.uid);
  if (result) publishNowPlaying(entry, result);
  recordPlay(entry.item).catch(() => undefined);

  // Bereits gespielte Titel aus dem nativen Player entfernen (Fenster: aktuell + nächster)
  const activeIdx = TrackPlayer.getActiveMediaItemIndex() ?? 0;
  if (activeIdx > 0) TrackPlayer.removeMediaItems(0, activeIdx);
  const token = ++loadToken;
  applySleepTimerAfterLoad();
  void prepareNext(token);
}

/** Stream fiel während der Wiedergabe aus → nächster Weg/nächste Quelle, gleiche Stelle. */
async function onPlaybackError(code: string, message: string) {
  const entry = currentEntry();
  if (!entry) return;
  const a = attemptState(entry.uid);
  const failed = resolved.get(entry.uid);
  const probe = failed ? await probeStream(failed) : 'kein Stream bekannt';
  a.log.push(`${a.lastKey ?? '?'}: Player-Fehler (${code}): ${message} – Prüfabruf: ${probe}`);
  if (entry !== currentEntry()) return; // inzwischen anderer Titel gewählt
  if (a.lastKey) a.exclude.add(a.lastKey);
  StreamResolver.invalidate(entry.item.id);
  a.recoveries++;
  if (a.recoveries > MAX_RECOVERIES_PER_ENTRY) {
    return failStop(entry, `Wiedergabefehler bei „${entry.item.title}“.`);
  }
  const position = TrackPlayer.getProgress().position;
  await loadCurrent({ autoplay: true, startAt: entry.item.isLive ? undefined : position });
}

function onEnded() {
  const s = playerStore.get();
  if (s.index + 1 < s.queue.length) {
    playerStore.set({ index: s.index + 1 });
    void loadCurrent({ autoplay: true });
  }
}

// ─── Schlaf-Timer ────────────────────────────────────

function applySleepTimerAfterLoad() {
  if (playerStore.get().sleepTimer === 'endOfTrack') {
    TrackPlayer.sleepAfterMediaItemAtIndex(TrackPlayer.getActiveMediaItemIndex() ?? 0);
  }
}

// ─── Öffentliche API ─────────────────────────────────

export const AudioPlayerService = {
  /** Einmalig beim App-Start (im Vordergrund) aus der Wiedergabe-Sitzung aufrufen. */
  setup() {
    if (setupDone) return;
    setupDone = true;
    TrackPlayer.setupPlayer({
      contentType: 'music',
      handleAudioBecomingNoisy: true,
      android: { wakeMode: 'network', taskRemovedBehavior: 'continue' },
    });
    TrackPlayer.setCommands({
      capabilities: [PlayerCommand.PlayPause, PlayerCommand.Next, PlayerCommand.Previous, PlayerCommand.Seek, PlayerCommand.Stop],
    });
    TrackPlayer.registerRemoteHandlers({
      // Nach einem Fehler hält der native Player evtl. noch den vorigen Titel – „Play“ heißt dann „Erneut versuchen“.
      play: (cmd) => {
        if (playerStore.get().error) return AudioPlayerService.retry();
        cmd.performDefault();
      },
      next: (cmd) => {
        if (playerStore.get().error) return AudioPlayerService.next();
        const queue = TrackPlayer.getQueue();
        const active = TrackPlayer.getActiveMediaItemIndex() ?? 0;
        if (queue.length > active + 1) cmd.performDefault();
        else return AudioPlayerService.next();
      },
      previous: () => AudioPlayerService.previous(),
    });
    TrackPlayer.addEventListener(Event.MediaItemTransition, (e) => onTransition(e.item?.mediaId));
    TrackPlayer.addEventListener(Event.PlaybackError, (e) => onPlaybackError(e.code, e.message));
    TrackPlayer.addEventListener(Event.PlaybackStateChanged, (e) => {
      if (e.state === PlaybackState.Ended) onEnded();
    });
    TrackPlayer.addEventListener(Event.SleepTimerTriggered, () => {
      playerStore.set({ sleepTimer: 'off' });
    });
  },

  /** Spielt eine Liste ab Index `start` (z. B. Suchergebnisse, Playlist). */
  async playItems(items: UnifiedItem[], start = 0): Promise<void> {
    const playable = items.filter((i) => i.type === 'track' || i.type === 'station' || i.type === 'audiobook' || i.type === 'podcast_episode' || i.type === 'mix');
    if (playable.length === 0) return;
    const startItem = items[start];
    const startIdx = Math.max(0, playable.findIndex((i) => i === startItem));
    attempts.clear();
    resolved.clear();
    playerStore.set({ queue: playable.map((item) => ({ uid: newUid(), item })), index: startIdx });
    await loadCurrent({ autoplay: true });
  },

  /** Hängt Titel an das Ende der Warteschlange an. */
  addToQueue(items: UnifiedItem[]) {
    const s = playerStore.get();
    playerStore.set({ queue: [...s.queue, ...items.map((item) => ({ uid: newUid(), item }))] });
    if (s.index === s.queue.length - 1) void prepareNext(loadToken);
  },

  /** Springt zu einem Eintrag der Warteschlange. */
  async skipTo(index: number) {
    const s = playerStore.get();
    if (index < 0 || index >= s.queue.length || index === s.index) return;
    playerStore.set({ index });
    await loadCurrent({ autoplay: true });
  },

  removeFromQueue(index: number) {
    const s = playerStore.get();
    if (index === s.index || index < 0 || index >= s.queue.length) return;
    const queue = s.queue.filter((_, i) => i !== index);
    playerStore.set({ queue, index: index < s.index ? s.index - 1 : s.index });
    if (index === s.index + 1) void prepareNext(++loadToken);
  },

  /** „Erneut versuchen“: alle Wege für den aktuellen Song wieder freigeben und neu laden. */
  async retry() {
    const entry = currentEntry();
    if (!entry) return;
    attempts.delete(entry.uid);
    StreamResolver.invalidate(entry.item.id);
    await loadCurrent({ autoplay: true });
  },

  togglePlayPause() {
    if (!currentEntry()) return;
    if (playerStore.get().error) {
      void AudioPlayerService.retry();
      return;
    }
    if (TrackPlayer.isPlaying()) TrackPlayer.pause();
    else {
      const state = TrackPlayer.getPlaybackState();
      if (state === PlaybackState.Error || state === PlaybackState.Idle) void loadCurrent({ autoplay: true });
      else TrackPlayer.play();
    }
  },

  async next() {
    const s = playerStore.get();
    const cur = currentEntry(s);
    if (cur && TrackPlayer.getProgress().position < SKIP_THRESHOLD_SEC && !cur.item.isLive) {
      recordSkip(cur.item).catch(() => undefined);
    }
    if (s.index + 1 >= s.queue.length) return;
    const queue = TrackPlayer.getQueue();
    const active = TrackPlayer.getActiveMediaItemIndex() ?? 0;
    if (!s.error && queue[active + 1]?.mediaId === s.queue[s.index + 1].uid) {
      TrackPlayer.skipToNext(); // Übergang wird in onTransition verarbeitet
      return;
    }
    playerStore.set({ index: s.index + 1 });
    await loadCurrent({ autoplay: true });
  },

  async previous() {
    const s = playerStore.get();
    if (TrackPlayer.getProgress().position > 3 || s.index <= 0) {
      TrackPlayer.seekTo(0);
      return;
    }
    playerStore.set({ index: s.index - 1 });
    await loadCurrent({ autoplay: true });
  },

  seekTo(seconds: number) {
    TrackPlayer.seekTo(seconds);
  },

  /** Sleep-Timer: Aus / 15 / 30 / 60 Min / Titelende (nativ in @rntp/player). */
  setSleepTimer(choice: SleepTimerChoice) {
    playerStore.set({ sleepTimer: choice });
    if (choice === 'off') TrackPlayer.cancelSleepTimer();
    else if (choice === 'endOfTrack') TrackPlayer.sleepAfterMediaItemAtIndex(TrackPlayer.getActiveMediaItemIndex() ?? 0);
    else TrackPlayer.sleepAfterTime(choice * 60, { fadeOutSeconds: 10 });
  },

  /** Nur bei Hörbüchern und Podcasts wirksam. */
  setPlaybackSpeed(speed: number) {
    playerStore.set({ playbackSpeed: speed });
    const cur = currentEntry();
    if (cur && SPEECH_TYPES.has(cur.item.type)) TrackPlayer.setPlaybackSpeed(speed);
  },

  isSpeechContent(item: UnifiedItem | undefined): boolean {
    return !!item && SPEECH_TYPES.has(item.type);
  },
};

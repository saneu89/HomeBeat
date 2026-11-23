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
import { toast } from './toastStore';

/**
 * AudioPlayerService (Abschnitt 5) auf Basis von @rntp/player (react-native-track-player v5):
 * Hintergrundwiedergabe, Sperrbildschirm, Benachrichtigung, Bluetooth-Tasten.
 *
 * Die Warteschlange gehört der App (playerStore). Dem nativen Player werden immer nur der
 * aktuelle und der nächste Titel übergeben – jeweils mit frisch aufgelöster Stream-URL, weil
 * Stream-URLs ablaufen. Fällt ein Stream während der Wiedergabe aus, wird automatisch der
 * nächste Weg/die nächste Quelle genommen und an derselben Stelle weitergespielt.
 */

const MAX_RECOVERIES_PER_ENTRY = 8;
/** Unter dieser Spielzeit zählt „Weiter“ als Überspringen (für Empfehlungen). */
const SKIP_THRESHOLD_SEC = 30;
const SPEECH_TYPES: ReadonlySet<UnifiedItem['type']> = new Set(['audiobook', 'podcast_episode']);

let uidCounter = 0;
const newUid = () => `q${Date.now().toString(36)}${(uidCounter++).toString(36)}`;

/** Pro Warteschlangen-Eintrag: fehlgeschlagene Wege und der zuletzt genutzte Weg. */
const attempts = new Map<string, { exclude: Set<string>; lastKey?: string; recoveries: number }>();
/** Aufgelöste Streams für den nativen Player, je uid. */
const resolved = new Map<string, ResolveResult>();
/** Läuft gerade eine Ladeoperation? Neuere Operationen machen ältere ungültig. */
let loadToken = 0;
let setupDone = false;

function attemptState(uid: string) {
  let a = attempts.get(uid);
  if (!a) {
    a = { exclude: new Set(), recoveries: 0 };
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
  const result = await StreamResolver.resolve(entry.item, { exclude: a.exclude });
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
    },
  });
}

/** Lädt den aktuellen Eintrag neu in den nativen Player (optional ab einer Position). */
async function loadCurrent(options: { autoplay: boolean; startAt?: number }): Promise<void> {
  const token = ++loadToken;
  const s = playerStore.get();
  const entry = currentEntry(s);
  if (!entry) return;
  playerStore.set({ loading: true, error: null });

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
    const message =
      e instanceof StreamUnavailableError
        ? `„${entry.item.title}“ ist gerade nicht abspielbar.`
        : e instanceof Error
          ? e.message
          : String(e);
    toast.show(message);
    playerStore.set({ loading: false, error: message });
    // Nicht abspielbar → automatisch der nächste Titel (ohne Zutun des Nutzers)
    const st = playerStore.get();
    if (st.index + 1 < st.queue.length) {
      playerStore.set({ index: st.index + 1 });
      await loadCurrent({ autoplay: options.autoplay });
      return;
    }
    TrackPlayer.stop();
  }
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
  playerStore.set({ index: idx, error: null });
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
async function onPlaybackError(message: string) {
  const entry = currentEntry();
  if (!entry) return;
  const a = attemptState(entry.uid);
  if (a.lastKey) a.exclude.add(a.lastKey);
  StreamResolver.invalidate(entry.item.id);
  a.recoveries++;
  if (a.recoveries > MAX_RECOVERIES_PER_ENTRY) {
    toast.show(`Wiedergabefehler bei „${entry.item.title}“ – nächster Titel.`);
    return AudioPlayerService.next();
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
      next: (cmd) => {
        const queue = TrackPlayer.getQueue();
        const active = TrackPlayer.getActiveMediaItemIndex() ?? 0;
        if (queue.length > active + 1) cmd.performDefault();
        else return AudioPlayerService.next();
      },
      previous: () => AudioPlayerService.previous(),
    });
    TrackPlayer.addEventListener(Event.MediaItemTransition, (e) => onTransition(e.item?.mediaId));
    TrackPlayer.addEventListener(Event.PlaybackError, (e) => onPlaybackError(e.message));
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

  togglePlayPause() {
    if (!currentEntry()) return;
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
    if (queue[active + 1]?.mediaId === s.queue[s.index + 1].uid) {
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

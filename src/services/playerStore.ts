import { useSyncExternalStore } from 'react';

import type { UnifiedItem } from '@/types/UnifiedItem';

export interface QueueEntry {
  /** Eindeutig pro Eintrag in der Warteschlange (derselbe Song kann mehrfach vorkommen). */
  uid: string;
  item: UnifiedItem;
}

export interface NowPlayingInfo {
  uid: string;
  /** Quelle des tatsächlich gespielten Streams (für das Kürzel). */
  playedSource: UnifiedItem['source'];
  via: string;
  bitrateKbps?: number;
  codec?: string;
  isLocal: boolean;
}

export type SleepTimerChoice = 'off' | 15 | 30 | 60 | 'endOfTrack';

export interface PlayerState {
  queue: QueueEntry[];
  index: number;
  /** loading = Stream wird gerade gesucht/aufgelöst. */
  loading: boolean;
  nowPlaying: NowPlayingInfo | null;
  error: string | null;
  /** Protokoll aller Versuche für den fehlgeschlagenen Song (Quelle/Client, Fehler, HTTP-Status). */
  errorDetails: string[];
  sleepTimer: SleepTimerChoice;
  playbackSpeed: number;
}

const initial: PlayerState = {
  queue: [],
  index: -1,
  loading: false,
  nowPlaying: null,
  error: null,
  errorDetails: [],
  sleepTimer: 'off',
  playbackSpeed: 1,
};

let state: PlayerState = initial;
const listeners = new Set<() => void>();

export const playerStore = {
  get: (): PlayerState => state,
  set(patch: Partial<PlayerState>) {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function usePlayerState<T>(selector: (s: PlayerState) => T): T {
  return useSyncExternalStore(playerStore.subscribe, () => selector(playerStore.get()));
}

export function currentEntry(s: PlayerState = playerStore.get()): QueueEntry | null {
  return s.index >= 0 && s.index < s.queue.length ? s.queue[s.index] : null;
}

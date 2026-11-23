import type { SourceId } from '@/types/UnifiedItem';

import type { MusicProvider } from './MusicProvider';
import { youtubeMusicProvider } from './youtubeMusic';

/**
 * Alle Musikquellen. Es gibt bewusst keine Einstellung zum An-/Abschalten oder Sortieren:
 * Jede Quelle ist immer aktiv; Quellen ohne Schlüssel melden isAvailable() = false.
 */
export const PROVIDERS: readonly MusicProvider[] = [youtubeMusicProvider];

/**
 * Reihenfolge für das Auflösen von Songs ohne eigenen Stream (Abschnitt 2, StreamResolver):
 * YouTube Music, dann JioSaavn, SoundCloud, Audius – soweit vorhanden.
 */
export const MATCH_ORDER: readonly SourceId[] = ['yt', 'jiosaavn', 'sc', 'audius'];

export function getProvider(source: SourceId): MusicProvider | undefined {
  return PROVIDERS.find((p) => p.id === source && p.isAvailable());
}

export function getMatchProviders(): MusicProvider[] {
  return MATCH_ORDER.map((id) => getProvider(id)).filter((p): p is MusicProvider => !!p && !!p.canResolveMatches);
}

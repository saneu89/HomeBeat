/** Kennung jeder Quelle. Wird auch als Präfix der UnifiedItem-ID verwendet (z. B. "yt:dQw4w9WgXcQ"). */
export type SourceId =
  | 'yt'
  | 'sc'
  | 'audius'
  | 'jamendo'
  | 'archive'
  | 'openverse'
  | 'librivox'
  | 'podcastindex'
  | 'hearthis'
  | 'bandcamp'
  | 'mixcloud'
  | 'jiosaavn'
  | 'radiobrowser'
  | 'deezer'
  | 'local';

export type ItemType =
  | 'track'
  | 'album'
  | 'artist'
  | 'playlist'
  | 'station'
  | 'audiobook'
  | 'podcast_episode'
  | 'mix';

/** Einheitliches Datenmodell für alle Quellen. */
export interface UnifiedItem {
  /** Immer mit Quellen-Präfix, z. B. "yt:abc123" oder "sc:98765". */
  id: string;
  type: ItemType;
  title: string;
  artist: string;
  album?: string;
  durationSec?: number;
  /** Höchste verfügbare Auflösung. */
  artworkUrl?: string;
  source: SourceId;
  isLive: boolean;
  isExplicit: boolean;
  /** Offizielle Aufnahme (z. B. YT-Music-Song) statt Nutzer-Upload/Video – für die Rangfolge. */
  isOfficial?: boolean;
  isrc?: string;
  localFileUri?: string;
  bitrateKbps?: number;
  codec?: string;
}

/** Kurzes Quellen-Kürzel für die Anzeige (nur zur Information). */
export const SOURCE_BADGE: Record<SourceId, string> = {
  yt: 'YT',
  sc: 'SC',
  audius: 'AUD',
  jamendo: 'JAM',
  archive: 'ARC',
  openverse: 'OV',
  librivox: 'LV',
  podcastindex: 'POD',
  hearthis: 'HT',
  bandcamp: 'BC',
  mixcloud: 'MC',
  jiosaavn: 'JIO',
  radiobrowser: 'RADIO',
  deezer: 'DZ',
  local: 'OFFLINE',
};

/** Anzeigename der Quellen (Einstellungen → Über HomeBeat). */
export const SOURCE_NAMES: { id: SourceId; name: string }[] = [
  { id: 'yt', name: 'YouTube Music' },
  { id: 'sc', name: 'SoundCloud' },
  { id: 'audius', name: 'Audius' },
  { id: 'jamendo', name: 'Jamendo' },
  { id: 'archive', name: 'Internet Archive' },
  { id: 'openverse', name: 'Openverse' },
  { id: 'librivox', name: 'LibriVox' },
  { id: 'podcastindex', name: 'Podcast Index' },
  { id: 'hearthis', name: 'hearthis.at' },
  { id: 'bandcamp', name: 'Bandcamp' },
  { id: 'mixcloud', name: 'Mixcloud' },
  { id: 'jiosaavn', name: 'JioSaavn' },
  { id: 'radiobrowser', name: 'Radio Browser' },
];

export function makeItemId(source: SourceId, nativeId: string): string {
  return `${source}:${nativeId}`;
}

export function parseItemId(id: string): { source: SourceId; nativeId: string } {
  const idx = id.indexOf(':');
  return { source: id.slice(0, idx) as SourceId, nativeId: id.slice(idx + 1) };
}

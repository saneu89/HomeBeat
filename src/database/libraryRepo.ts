import type { ItemType, SourceId, UnifiedItem } from '@/types/UnifiedItem';

import { getDb } from './db';

export interface TrackRow {
  id: string;
  type: string;
  title: string;
  artist: string;
  album: string | null;
  duration_sec: number | null;
  artwork_url: string | null;
  source: string;
  is_live: number;
  is_explicit: number;
  isrc: string | null;
}

export function rowToItem(row: TrackRow): UnifiedItem {
  return {
    id: row.id,
    type: row.type as ItemType,
    title: row.title,
    artist: row.artist,
    album: row.album ?? undefined,
    durationSec: row.duration_sec ?? undefined,
    artworkUrl: row.artwork_url ?? undefined,
    source: row.source as SourceId,
    isLive: row.is_live === 1,
    isExplicit: row.is_explicit === 1,
    isrc: row.isrc ?? undefined,
  };
}

export interface LibraryCounts {
  favorites: number;
  downloads: number;
  downloadBytes: number;
  playlists: number;
}

export async function getLibraryCounts(): Promise<LibraryCounts> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ favorites: number; downloads: number; download_bytes: number | null; playlists: number }>(
    `SELECT
       (SELECT COUNT(*) FROM favorites) AS favorites,
       (SELECT COUNT(*) FROM downloads WHERE status = 'done') AS downloads,
       (SELECT SUM(bytes_done) FROM downloads WHERE status = 'done') AS download_bytes,
       (SELECT COUNT(*) FROM playlists) AS playlists`,
  );
  return {
    favorites: row?.favorites ?? 0,
    downloads: row?.downloads ?? 0,
    downloadBytes: row?.download_bytes ?? 0,
    playlists: row?.playlists ?? 0,
  };
}

/** „Zuletzt gehört“ aus dem Verlauf. */
export async function getRecentlyPlayed(limit = 10): Promise<UnifiedItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<TrackRow>(
    `SELECT t.* FROM history h JOIN tracks t ON t.id = h.track_id
     ORDER BY h.last_played_at DESC LIMIT ?`,
    limit,
  );
  return rows.map(rowToItem);
}

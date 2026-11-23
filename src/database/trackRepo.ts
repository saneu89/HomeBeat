import type { UnifiedItem } from '@/types/UnifiedItem';

import { getDb } from './db';

/** Speichert/aktualisiert die Metadaten eines Eintrags (Voraussetzung für Favoriten, Verlauf, Playlists). */
export async function upsertTrack(item: UnifiedItem): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO tracks (id, type, title, artist, album, duration_sec, artwork_url, source, is_live, is_explicit, isrc, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       type = excluded.type, title = excluded.title, artist = excluded.artist,
       album = COALESCE(excluded.album, tracks.album),
       duration_sec = COALESCE(excluded.duration_sec, tracks.duration_sec),
       artwork_url = COALESCE(excluded.artwork_url, tracks.artwork_url),
       source = excluded.source, is_live = excluded.is_live, is_explicit = excluded.is_explicit,
       isrc = COALESCE(excluded.isrc, tracks.isrc), updated_at = excluded.updated_at`,
    item.id,
    item.type,
    item.title,
    item.artist,
    item.album ?? null,
    item.durationSec ?? null,
    item.artworkUrl ?? null,
    item.source,
    item.isLive ? 1 : 0,
    item.isExplicit ? 1 : 0,
    item.isrc ?? null,
    Date.now(),
  );
}

/** Abspielzähler erhöhen (Verlauf mit Abspielzähler). */
export async function recordPlay(item: UnifiedItem): Promise<void> {
  await upsertTrack(item);
  const db = await getDb();
  const now = Date.now();
  await db.runAsync(
    `INSERT INTO history (track_id, play_count, skip_count, first_played_at, last_played_at)
     VALUES (?, 1, 0, ?, ?)
     ON CONFLICT(track_id) DO UPDATE SET play_count = play_count + 1, last_played_at = excluded.last_played_at`,
    item.id,
    now,
    now,
  );
}

/** Überspringen merken (fließt später in die Empfehlungen ein). */
export async function recordSkip(item: UnifiedItem): Promise<void> {
  await upsertTrack(item);
  const db = await getDb();
  const now = Date.now();
  await db.runAsync(
    `INSERT INTO history (track_id, play_count, skip_count, first_played_at, last_played_at)
     VALUES (?, 0, 1, ?, ?)
     ON CONFLICT(track_id) DO UPDATE SET skip_count = skip_count + 1`,
    item.id,
    now,
    now,
  );
}

export async function isFavorite(trackId: string): Promise<boolean> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM favorites WHERE track_id = ?', trackId);
  return (row?.n ?? 0) > 0;
}

/** Schaltet den Favoriten-Status um und liefert den neuen Zustand. */
export async function toggleFavorite(item: UnifiedItem): Promise<boolean> {
  await upsertTrack(item);
  const db = await getDb();
  if (await isFavorite(item.id)) {
    await db.runAsync('DELETE FROM favorites WHERE track_id = ?', item.id);
    return false;
  }
  await db.runAsync('INSERT INTO favorites (track_id, added_at) VALUES (?, ?)', item.id, Date.now());
  return true;
}

/** Lokale Datei eines fertigen Downloads, falls vorhanden. */
export async function getDownloadedFile(
  trackId: string,
): Promise<{ fileUri: string; bitrateKbps: number | null; codec: string | null } | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ file_uri: string | null; bitrate_kbps: number | null; codec: string | null }>(
    "SELECT file_uri, bitrate_kbps, codec FROM downloads WHERE track_id = ? AND status = 'done'",
    trackId,
  );
  return row?.file_uri ? { fileUri: row.file_uri, bitrateKbps: row.bitrate_kbps, codec: row.codec } : null;
}

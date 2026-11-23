import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Migrationen. Index + 1 = Schema-Version (gespeichert in PRAGMA user_version).
 * Regel: Bestehende Einträge NIE ändern – nur neue Migrationen anhängen.
 */
export const MIGRATIONS: readonly string[] = [
  // 1 – Grundschema
  `
  CREATE TABLE settings (
    key   TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );

  -- Metadaten aller Songs/Einträge, auf die Bibliothek, Verlauf oder Downloads verweisen.
  CREATE TABLE tracks (
    id           TEXT PRIMARY KEY NOT NULL,   -- UnifiedItem.id mit Quellen-Präfix
    type         TEXT NOT NULL,
    title        TEXT NOT NULL,
    artist       TEXT NOT NULL DEFAULT '',
    album        TEXT,
    duration_sec INTEGER,
    artwork_url  TEXT,
    source       TEXT NOT NULL,
    is_live      INTEGER NOT NULL DEFAULT 0,
    is_explicit  INTEGER NOT NULL DEFAULT 0,
    isrc         TEXT,
    updated_at   INTEGER NOT NULL
  );
  CREATE INDEX idx_tracks_artist_title ON tracks (artist, title);

  CREATE TABLE playlists (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    icon       TEXT NOT NULL DEFAULT '🎶',
    keep_offline INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE playlist_items (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    playlist_id INTEGER NOT NULL REFERENCES playlists (id) ON DELETE CASCADE,
    track_id    TEXT NOT NULL REFERENCES tracks (id),
    position    INTEGER NOT NULL,
    unresolved  INTEGER NOT NULL DEFAULT 0,  -- 1 = beim Import keine Quelle gefunden (markiert, nicht gelöscht)
    added_at    INTEGER NOT NULL
  );
  CREATE INDEX idx_playlist_items_order ON playlist_items (playlist_id, position);

  CREATE TABLE favorites (
    track_id TEXT PRIMARY KEY NOT NULL REFERENCES tracks (id),
    added_at INTEGER NOT NULL
  );

  CREATE TABLE downloads (
    track_id     TEXT PRIMARY KEY NOT NULL REFERENCES tracks (id),
    status       TEXT NOT NULL,              -- queued | downloading | paused | done | error
    file_uri     TEXT,
    artwork_uri  TEXT,
    bytes_total  INTEGER,
    bytes_done   INTEGER NOT NULL DEFAULT 0,
    quality      TEXT,
    bitrate_kbps INTEGER,
    codec        TEXT,
    error        TEXT,
    created_at   INTEGER NOT NULL,
    updated_at   INTEGER NOT NULL
  );
  CREATE INDEX idx_downloads_status ON downloads (status);

  -- Verlauf mit Abspielzähler (ein Eintrag pro Song)
  CREATE TABLE history (
    track_id        TEXT PRIMARY KEY NOT NULL REFERENCES tracks (id),
    play_count      INTEGER NOT NULL DEFAULT 0,
    skip_count      INTEGER NOT NULL DEFAULT 0,
    first_played_at INTEGER NOT NULL,
    last_played_at  INTEGER NOT NULL
  );
  CREATE INDEX idx_history_last ON history (last_played_at DESC);

  CREATE TABLE lyrics_cache (
    cache_key   TEXT PRIMARY KEY NOT NULL,   -- normalisiert: künstler|titel|dauer
    synced      TEXT,
    plain       TEXT,
    instrumental INTEGER NOT NULL DEFAULT 0,
    fetched_at  INTEGER NOT NULL
  );
  `,
];

export async function migrate(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  for (let v = current; v < MIGRATIONS.length; v++) {
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.execAsync(MIGRATIONS[v]);
      await txn.execAsync(`PRAGMA user_version = ${v + 1}`);
    });
  }
  return MIGRATIONS.length;
}

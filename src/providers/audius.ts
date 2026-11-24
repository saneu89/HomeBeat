import { fetchJson } from '@/services/streams/fetchUtils';
import { makeItemId, parseItemId, type UnifiedItem } from '@/types/UnifiedItem';

import type { MusicProvider, SearchOptions } from './MusicProvider';

/**
 * Audius – offene API ohne Schlüssel (https://docs.audius.org/api).
 * `app_name` ist der von Audius gewünschte Kennzeichner der App.
 * Der Stream-Endpunkt leitet auf einen Content-Node weiter (Media3 folgt der Weiterleitung).
 */
const API = 'https://api.audius.co/v1';
const APP_NAME = 'HomeBeat';

interface AudiusTrack {
  id: string;
  title: string;
  duration: number;
  user?: { name?: string };
  artwork?: Record<string, string>;
  is_streamable?: boolean;
  is_stream_gated?: boolean;
  access?: { stream?: boolean };
  isrc?: string;
}

function mapTrack(t: AudiusTrack): UnifiedItem {
  return {
    id: makeItemId('audius', t.id),
    type: 'track',
    source: 'audius',
    title: t.title,
    artist: t.user?.name ?? '',
    durationSec: t.duration || undefined,
    artworkUrl: t.artwork?.['1000x1000'] ?? t.artwork?.['480x480'],
    isLive: false,
    isExplicit: false,
    isrc: t.isrc || undefined,
  };
}

export const audiusProvider: MusicProvider = {
  id: 'audius',
  name: 'Audius',
  supportedTypes: ['track'],
  canResolveMatches: true,
  isAvailable: () => true,

  async search(query: string, options?: SearchOptions): Promise<UnifiedItem[]> {
    const url = `${API}/tracks/search?query=${encodeURIComponent(query)}&limit=${options?.limit ?? 20}&app_name=${APP_NAME}`;
    const data = await fetchJson<{ data?: AudiusTrack[] }>(url, { signal: options?.signal });
    // Nur frei abspielbare Titel (keine bezahlten/gesperrten)
    return (data.data ?? [])
      .filter((t) => t.is_streamable !== false && !t.is_stream_gated && t.access?.stream !== false)
      .map(mapTrack);
  },

  streamAttempts(item) {
    const { nativeId } = parseItemId(item.id);
    return [
      {
        key: 'audius',
        resolve: async () => ({
          url: `${API}/tracks/${encodeURIComponent(nativeId)}/stream?app_name=${APP_NAME}`,
          mimeType: 'audio/mpeg',
          source: 'audius',
          via: 'Audius',
          isLocal: false,
          expiresAt: Date.now() + 10 * 60 * 1000,
        }),
      },
    ];
  },
};

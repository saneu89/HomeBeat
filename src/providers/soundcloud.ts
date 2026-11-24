import { getSecret } from '@/config/keys';
import { fetchJson } from '@/services/streams/fetchUtils';
import { makeItemId, parseItemId, type UnifiedItem } from '@/types/UnifiedItem';

import type { MusicProvider, SearchOptions } from './MusicProvider';

/**
 * SoundCloud – offizielle API (https://developers.soundcloud.com/docs/api/guide), Stand 24.11.2026:
 * Token per client_credentials (HTTP Basic) bei secure.soundcloud.com, Aufrufe mit „Authorization: OAuth …“.
 * Ohne SOUNDCLOUD_CLIENT_ID/-SECRET wird die Quelle still übersprungen.
 * Vorschauen (access = "preview", preview_mp3_128_url) werden nie als ganzer Song gespielt.
 */
const API = 'https://api.soundcloud.com';
const TOKEN_URL = 'https://secure.soundcloud.com/oauth/token';

interface ScTrack {
  urn: string;
  title: string;
  duration: number; // ms
  user?: { username?: string };
  artwork_url?: string | null;
  access?: 'playable' | 'preview' | 'blocked' | null;
  streamable?: boolean;
  isrc?: string;
}

interface ScStreams {
  http_mp3_128_url?: string;
  hls_aac_160_url?: string;
  hls_mp3_128_url?: string;
  preview_mp3_128_url?: string;
}

// shortcut: Token nur im Speicher – je App-Start ein neuer (Limit 50 Tokens/12 h je App); bei vielen Geräten in SQLite ablegen.
let token: { value: string; until: number } | null = null;

async function getToken(signal?: AbortSignal): Promise<string> {
  if (token && token.until > Date.now()) return token.value;
  const id = getSecret('SOUNDCLOUD_CLIENT_ID');
  const secret = getSecret('SOUNDCLOUD_CLIENT_SECRET');
  if (!id || !secret) throw new Error('SoundCloud: kein Schlüssel');
  const data = await fetchJson<{ access_token?: string; expires_in?: number }>(TOKEN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json; charset=utf-8',
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${btoa(`${id}:${secret}`)}`,
    },
    body: 'grant_type=client_credentials',
    signal,
  });
  if (!data.access_token) throw new Error('SoundCloud: kein Token erhalten');
  token = { value: data.access_token, until: Date.now() + ((data.expires_in ?? 3600) - 60) * 1000 };
  return token.value;
}

async function api<T>(path: string, signal?: AbortSignal): Promise<T> {
  const auth = await getToken(signal);
  return fetchJson<T>(`${API}${path}`, { headers: { Authorization: `OAuth ${auth}`, Accept: 'application/json' }, signal });
}

function mapTrack(t: ScTrack): UnifiedItem {
  return {
    id: makeItemId('sc', t.urn),
    type: 'track',
    source: 'sc',
    title: t.title,
    artist: t.user?.username ?? '',
    durationSec: t.duration ? Math.round(t.duration / 1000) : undefined,
    artworkUrl: t.artwork_url?.replace('-large.', '-t500x500.') ?? undefined,
    isLive: false,
    isExplicit: false,
    isrc: t.isrc || undefined,
  };
}

export const soundcloudProvider: MusicProvider = {
  id: 'sc',
  name: 'SoundCloud',
  supportedTypes: ['track'],
  canResolveMatches: true,
  isAvailable: () => !!getSecret('SOUNDCLOUD_CLIENT_ID') && !!getSecret('SOUNDCLOUD_CLIENT_SECRET'),

  async search(query: string, options?: SearchOptions): Promise<UnifiedItem[]> {
    const data = await api<ScTrack[] | { collection?: ScTrack[] }>(
      `/tracks?q=${encodeURIComponent(query)}&access=playable&limit=${options?.limit ?? 20}`,
      options?.signal,
    );
    const list = Array.isArray(data) ? data : (data.collection ?? []);
    return list.filter((t) => t.access === 'playable' && t.streamable !== false).map(mapTrack);
  },

  streamAttempts(item) {
    const { nativeId } = parseItemId(item.id);
    return [
      {
        key: 'sc',
        resolve: async (signal?: AbortSignal) => {
          const streams = await api<ScStreams>(`/tracks/${encodeURIComponent(nativeId)}/streams`, signal);
          // Bewusst ohne preview_mp3_128_url: nur ganze Songs.
          const url = streams.http_mp3_128_url ?? streams.hls_aac_160_url ?? streams.hls_mp3_128_url;
          if (!url) throw new Error('SoundCloud: nur Vorschau oder kein Stream verfügbar');
          const hls = url === streams.hls_aac_160_url || url === streams.hls_mp3_128_url;
          return {
            url,
            headers: { Authorization: `OAuth ${await getToken(signal)}` },
            mimeType: hls ? 'application/x-mpegURL' : 'audio/mpeg',
            bitrateKbps: url === streams.hls_aac_160_url ? 160 : 128,
            codec: url === streams.hls_aac_160_url ? 'aac' : 'mp3',
            source: 'sc' as const,
            via: 'SoundCloud',
            isLocal: false,
            expiresAt: Date.now() + 10 * 60 * 1000,
          };
        },
      },
    ];
  },
};

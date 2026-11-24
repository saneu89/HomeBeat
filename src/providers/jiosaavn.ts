import { fetchJson } from '@/services/streams/fetchUtils';
import { pickFormat } from '@/services/streams/quality';
import { makeItemId, parseItemId, type UnifiedItem } from '@/types/UnifiedItem';

import type { MusicProvider, SearchOptions } from './MusicProvider';

/**
 * JioSaavn – inoffizielle Web-API (dieselbe, die jiosaavn.com nutzt), kein Schlüssel.
 * Stream: `song.generateAuthToken` liefert eine signierte URL auf web.saavncdn.com. Diese ist
 * außerhalb Indiens gesperrt (getestet 24.11.2026: HTTP 403 aus DE); derselbe Pfad auf
 * aac.saavncdn.com ist ohne Signatur abrufbar (HTTP 206, ganze Datei). Daher zuerst dieser Weg.
 * Außerhalb Indiens ist der Katalog stark eingeschränkt (westliche Titel meist nur als Cover).
 */
const API = 'https://www.jiosaavn.com/api.php';
const BASE_PARAMS = '_format=json&_marker=0&api_version=4&ctx=web6dot0';

interface SaavnSong {
  id: string;
  title: string;
  image?: string;
  explicit_content?: string;
  more_info?: {
    album?: string;
    duration?: string;
    encrypted_media_url?: string;
    '320kbps'?: string;
    artistMap?: { primary_artists?: { name: string }[] };
  };
}

/** Die API liefert HTML-Entities in Titeln („&quot;“, „&amp;“). */
function decodeEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

/** Verschlüsselte Media-URL je Song – aus der Suche, sonst per song.getDetails nachgeladen. */
const mediaInfo = new Map<string, { encrypted: string; has320: boolean }>();

function mapSong(s: SaavnSong): UnifiedItem {
  const info = s.more_info ?? {};
  if (info.encrypted_media_url) mediaInfo.set(s.id, { encrypted: info.encrypted_media_url, has320: info['320kbps'] === 'true' });
  return {
    id: makeItemId('jiosaavn', s.id),
    type: 'track',
    source: 'jiosaavn',
    title: decodeEntities(s.title),
    artist: decodeEntities((info.artistMap?.primary_artists ?? []).map((a) => a.name).join(', ')),
    album: info.album ? decodeEntities(info.album) : undefined,
    durationSec: Number(info.duration) || undefined,
    artworkUrl: s.image?.replace(/-\d+x\d+\.(jpg|webp)$/, '-500x500.$1'),
    isLive: false,
    isExplicit: s.explicit_content === '1',
    isOfficial: true,
  };
}

async function getMediaInfo(id: string, signal?: AbortSignal) {
  const known = mediaInfo.get(id);
  if (known) return known;
  const data = await fetchJson<{ songs?: SaavnSong[] }>(`${API}?__call=song.getDetails&pids=${encodeURIComponent(id)}&${BASE_PARAMS}`, { signal });
  const song = data.songs?.[0];
  if (song) mapSong(song);
  const info = mediaInfo.get(id);
  if (!info) throw new Error('JioSaavn: keine Stream-Daten');
  return info;
}

async function authUrl(encrypted: string, bitrate: number, signal?: AbortSignal): Promise<string> {
  const data = await fetchJson<{ auth_url?: string; status?: string }>(
    `${API}?__call=song.generateAuthToken&url=${encodeURIComponent(encrypted)}&bitrate=${bitrate}&${BASE_PARAMS}`,
    { signal },
  );
  if (!data.auth_url) throw new Error(`JioSaavn: keine Stream-URL (${data.status ?? 'unbekannt'})`);
  return data.auth_url;
}

export const jiosaavnProvider: MusicProvider = {
  id: 'jiosaavn',
  name: 'JioSaavn',
  supportedTypes: ['track'],
  canResolveMatches: true,
  isAvailable: () => true,

  async search(query: string, options?: SearchOptions): Promise<UnifiedItem[]> {
    const url = `${API}?__call=search.getResults&n=${options?.limit ?? 20}&p=1&q=${encodeURIComponent(query)}&${BASE_PARAMS}`;
    const data = await fetchJson<{ results?: SaavnSong[] }>(url, { signal: options?.signal });
    return (data.results ?? []).map(mapSong);
  },

  streamAttempts(item, quality) {
    const { nativeId } = parseItemId(item.id);
    const resolve = (signed: boolean) => async (signal?: AbortSignal) => {
      const info = await getMediaInfo(nativeId, signal);
      const variants = [96, 160, ...(info.has320 ? [320] : [])].map((kbps) => ({ bitrateKbps: kbps, mimeType: 'audio/mp4' }));
      const chosen = pickFormat(variants, quality) ?? variants[0];
      const signedUrl = await authUrl(info.encrypted, chosen.bitrateKbps, signal);
      return {
        url: signed ? signedUrl : signedUrl.replace(/^https:\/\/web\.saavncdn\.com/, 'https://aac.saavncdn.com').replace(/\?.*$/, ''),
        mimeType: 'audio/mp4',
        codec: 'aac',
        bitrateKbps: chosen.bitrateKbps,
        source: 'jiosaavn' as const,
        via: signed ? 'JioSaavn (signiert)' : 'JioSaavn',
        isLocal: false,
        expiresAt: Date.now() + 10 * 60 * 1000,
      };
    };
    return [
      { key: 'jiosaavn:aac', resolve: resolve(false) },
      { key: 'jiosaavn:signed', resolve: resolve(true) },
    ];
  },
};

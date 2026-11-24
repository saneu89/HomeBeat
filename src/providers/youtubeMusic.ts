import type { YTNodes } from 'youtubei.js';

import { proxyAttempts } from '@/services/streams/proxyInstances';
import { youtubeDirectAttempts } from '@/services/streams/youtubeStreams';
import { getInnertube } from '@/services/youtube/innertube';
import { makeItemId, parseItemId, type ItemType, type UnifiedItem } from '@/types/UnifiedItem';

import type { MusicProvider, SearchOptions } from './MusicProvider';

type ListItem = YTNodes.MusicResponsiveListItem;
type Thumb = { url: string; width: number; height: number };

/** Höchste Auflösung wählen; YT-Music-Cover (googleusercontent) lassen sich per URL auf 1200 px hochsetzen. */
export function bestArtwork(thumbs: Thumb[] | undefined): string | undefined {
  if (!thumbs || thumbs.length === 0) return undefined;
  const best = [...thumbs].sort((a, b) => b.width * b.height - a.width * a.height)[0];
  if (/googleusercontent\.com|ggpht\.com/.test(best.url)) {
    return best.url.replace(/=w\d+-h\d+[^&?#]*/, '=w1200-h1200-l90-rj');
  }
  return best.url;
}

function isExplicit(item: ListItem): boolean {
  return (item.badges ?? []).some(
    (b) => (b as unknown as { icon_type?: string }).icon_type === 'MUSIC_EXPLICIT_BADGE',
  );
}

function joinNames(list: { name: string }[] | undefined): string {
  return (list ?? []).map((a) => a.name).filter(Boolean).join(', ');
}

function mapItem(item: ListItem): UnifiedItem | null {
  const kind = item.item_type;
  const artwork = bestArtwork(item.thumbnails);
  const base = { source: 'yt' as const, isLive: false, isExplicit: isExplicit(item), artworkUrl: artwork };

  if ((kind === 'song' || kind === 'video') && item.id) {
    return {
      ...base,
      id: makeItemId('yt', item.id),
      type: 'track',
      isOfficial: kind === 'song',
      title: item.title ?? '',
      artist: joinNames(item.artists) || joinNames(item.authors) || item.author?.name || '',
      album: item.album?.name,
      durationSec: item.duration?.seconds || undefined,
    };
  }
  if (kind === 'album' && item.id) {
    return {
      ...base,
      id: makeItemId('yt', `album:${item.id}`),
      type: 'album',
      title: item.title ?? '',
      artist: joinNames(item.artists) || item.author?.name || '',
    };
  }
  if (kind === 'playlist' && item.id) {
    return {
      ...base,
      id: makeItemId('yt', `playlist:${item.id}`),
      type: 'playlist',
      title: item.title ?? '',
      artist: item.author?.name ?? '',
    };
  }
  if (kind === 'artist' && item.id) {
    return {
      ...base,
      id: makeItemId('yt', `artist:${item.id}`),
      type: 'artist',
      title: item.name ?? item.title ?? '',
      artist: '',
    };
  }
  return null;
}

const FILTER_BY_TYPE: Partial<Record<ItemType, 'song' | 'album' | 'playlist' | 'artist'>> = {
  track: 'song',
  album: 'album',
  playlist: 'playlist',
  artist: 'artist',
};

export const youtubeMusicProvider: MusicProvider = {
  id: 'yt',
  name: 'YouTube Music',
  supportedTypes: ['track', 'album', 'artist', 'playlist'],
  canResolveMatches: true,
  isAvailable: () => true,

  streamAttempts(item, quality) {
    const { nativeId } = parseItemId(item.id);
    if (item.type !== 'track' || nativeId.includes(':')) return [];
    return youtubeDirectAttempts(nativeId, quality);
  },

  fallbackStreamAttempts(item, quality) {
    const { nativeId } = parseItemId(item.id);
    if (item.type !== 'track' || nativeId.includes(':')) return [];
    return proxyAttempts(nativeId, quality);
  },

  async search(query: string, options?: SearchOptions): Promise<UnifiedItem[]> {
    const yt = await getInnertube();
    options?.signal?.throwIfAborted();

    const singleType = options?.types?.length === 1 ? FILTER_BY_TYPE[options.types[0]] : undefined;
    const result = await yt.music.search(query, singleType ? { type: singleType } : undefined);
    options?.signal?.throwIfAborted();

    const items: UnifiedItem[] = [];
    const seen = new Set<string>();
    for (const shelf of result.contents ?? []) {
      const entries = (shelf as { contents?: unknown[] }).contents ?? [];
      for (const node of entries) {
        if ((node as { type?: string }).type !== 'MusicResponsiveListItem') continue;
        const mapped = mapItem(node as ListItem);
        if (mapped && !seen.has(mapped.id)) {
          seen.add(mapped.id);
          items.push(mapped);
        }
      }
    }
    const wanted = options?.types;
    const filtered = wanted?.length ? items.filter((i) => wanted.includes(i.type)) : items;
    return options?.limit ? filtered.slice(0, options.limit) : filtered;
  },
};

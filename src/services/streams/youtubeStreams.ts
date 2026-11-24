import { Constants, type Types } from 'youtubei.js';

import { getInnertube } from '@/services/youtube/innertube';
import { getPoToken } from '@/services/youtube/poToken';

import { pickFormat, splitMime } from './quality';
import type { ResolvedStream, StreamAttempt, StreamQuality } from './types';

/**
 * Reihenfolge der InnerTube-Clients für den Direktabruf.
 * YTMUSIC (WEB_REMIX) liefert auf dem Handy getestet funktionierende URLs (Phase 1).
 * ANDROID_VR und TV sind Ausweich-Clients, falls YouTube einen Client sperrt.
 */
const CLIENTS: readonly Types.InnerTubeClient[] = ['YTMUSIC', 'ANDROID_VR', 'TV'];

const BROWSER_UA =
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';

function userAgentFor(client: Types.InnerTubeClient): string {
  const entry = (Constants.CLIENTS as Record<string, { USER_AGENT?: string } | undefined>)[client];
  return entry?.USER_AGENT ?? BROWSER_UA;
}

/** Maximale Gültigkeit im Cache; YouTube-URLs gelten ca. 6 h, wir nehmen sie nur kurz. */
const MAX_TTL_MS = 30 * 60 * 1000;

async function resolveWithClient(
  videoId: string,
  client: Types.InnerTubeClient,
  quality: Exclude<StreamQuality, 'auto'>,
  signal?: AbortSignal,
): Promise<ResolvedStream> {
  const yt = await getInnertube();
  signal?.throwIfAborted();
  const info = client === 'YTMUSIC' ? await yt.music.getInfo(videoId) : await yt.getBasicInfo(videoId, { client });
  signal?.throwIfAborted();

  const status = info.playability_status;
  if (status && status.status !== 'OK') {
    throw new Error(`YouTube (${client}): ${status.status}${status.reason ? ` – ${status.reason}` : ''}`);
  }
  const sd = info.streaming_data;
  if (!sd) throw new Error(`YouTube (${client}): keine Streaming-Daten`);

  const live = sd.hls_manifest_url && (info.basic_info.is_live ?? false);
  if (live && sd.hls_manifest_url) {
    return {
      url: sd.hls_manifest_url,
      mimeType: 'application/x-mpegURL',
      source: 'yt',
      via: `YouTube (${client})`,
      isLocal: false,
      expiresAt: Date.now() + MAX_TTL_MS,
    };
  }

  const audio = sd.adaptive_formats
    .filter((f) => f.has_audio && !f.has_video)
    .map((f) => {
      const { mime, codec } = splitMime(f.mime_type);
      return { format: f, mimeType: mime, codec, bitrateKbps: Math.round((f.average_bitrate ?? f.bitrate) / 1000) };
    });
  const chosen = pickFormat(audio, quality);
  if (!chosen) throw new Error(`YouTube (${client}): keine passende Audio-Variante`);

  let url = await chosen.format.decipher(yt.session.player);
  if (!url) throw new Error(`YouTube (${client}): Stream-URL konnte nicht entschlüsselt werden`);
  if (client === 'YTMUSIC') {
    // Ohne PO-Token liefert YouTube nur ~1 MB (danach HTTP 403) – dann gar nicht erst versuchen.
    try {
      url += `&pot=${encodeURIComponent(await getPoToken(videoId))}`;
    } catch (e) {
      throw new Error(`YouTube (${client}): kein PO-Token – ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const expires = sd.expires instanceof Date ? sd.expires.getTime() - 60_000 : Date.now() + MAX_TTL_MS;
  return {
    url,
    headers: { 'User-Agent': userAgentFor(client) },
    mimeType: chosen.mimeType,
    codec: chosen.codec,
    bitrateKbps: chosen.bitrateKbps,
    loudnessDb: chosen.format.loudness_db,
    source: 'yt',
    via: `YouTube (${client})`,
    isLocal: false,
    expiresAt: Math.min(expires, Date.now() + MAX_TTL_MS),
  };
}

/** Ein Versuch pro Client – der StreamResolver probiert sie der Reihe nach. */
export function youtubeDirectAttempts(videoId: string, quality: Exclude<StreamQuality, 'auto'>): StreamAttempt[] {
  return CLIENTS.map((client) => ({
    key: `yt-direct:${client}`,
    resolve: (signal?: AbortSignal) => resolveWithClient(videoId, client, quality, signal),
  }));
}

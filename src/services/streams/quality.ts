import { NetworkStateType, getNetworkStateAsync } from 'expo-network';
import { Platform } from 'react-native';

import type { FormatCandidate, StreamQuality } from './types';

/** Zuordnung laut Abschnitt 6: Niedrig ≈ 64, Normal ≈ 128, Hoch ≈ 160 kbps, Beste = höchste Variante. */
export const QUALITY_TARGET_KBPS: Record<Exclude<StreamQuality, 'auto' | 'best'>, number> = {
  low: 64,
  normal: 128,
  high: 160,
};

/** „Auto“ = je nach Netz: WLAN/Ethernet → Beste, Mobilfunk/unbekannt → Normal. */
export async function resolveAutoQuality(quality: StreamQuality): Promise<Exclude<StreamQuality, 'auto'>> {
  if (quality !== 'auto') return quality;
  try {
    const state = await getNetworkStateAsync();
    if (state.type === NetworkStateType.WIFI || state.type === NetworkStateType.ETHERNET) return 'best';
    return 'normal';
  } catch {
    return 'normal';
  }
}

/** iOS spielt kein Opus/WebM zuverlässig → dort nur AAC/M4A/MP3 zulassen. */
export function isPlayableOnPlatform(mimeType: string): boolean {
  if (Platform.OS !== 'ios') return true;
  return !/webm|opus|ogg/i.test(mimeType);
}

/**
 * Wählt die Variante passend zur Qualität: bei „Beste“ die höchste Bitrate,
 * sonst die höchste Bitrate bis Ziel + 15 % (bzw. die niedrigste darüber, wenn es keine kleinere gibt).
 * Bei gleicher Bitrate wird AAC/M4A bevorzugt (breiteste Kompatibilität, auch für Cast).
 */
export function pickFormat<T extends FormatCandidate>(formats: T[], quality: Exclude<StreamQuality, 'auto'>): T | undefined {
  const usable = formats.filter((f) => isPlayableOnPlatform(f.mimeType) && f.bitrateKbps > 0);
  if (usable.length === 0) return undefined;
  const byBitrateDesc = [...usable].sort((a, b) => {
    if (b.bitrateKbps !== a.bitrateKbps) return b.bitrateKbps - a.bitrateKbps;
    return Number(/mp4|aac|m4a/i.test(b.mimeType)) - Number(/mp4|aac|m4a/i.test(a.mimeType));
  });
  if (quality === 'best') return byBitrateDesc[0];
  const limit = QUALITY_TARGET_KBPS[quality] * 1.15;
  return byBitrateDesc.find((f) => f.bitrateKbps <= limit) ?? byBitrateDesc[byBitrateDesc.length - 1];
}

/** "audio/webm; codecs=\"opus\"" → { mime: "audio/webm", codec: "opus" } */
export function splitMime(mime: string): { mime: string; codec?: string } {
  const [base, ...rest] = mime.split(';');
  const codecMatch = rest.join(';').match(/codecs="?([^",]+)/i);
  return { mime: base.trim(), codec: codecMatch?.[1]?.split('.')[0] };
}

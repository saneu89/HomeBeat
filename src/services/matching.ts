import type { UnifiedItem } from '@/types/UnifiedItem';

/**
 * Normalisierung und Ähnlichkeit für „gleicher Song?“ – genutzt vom StreamResolver
 * (Songs ohne eigenen Stream) und später vom AggregatorService (Doppelte zusammenfassen).
 */

const NOISE = /\b(official|offizielles?|music|musik|video|audio|lyrics?|lyric video|hd|hq|4k|visualizer|remaster(ed)?(\s+\d{4})?|\d{4}\s+remaster(ed)?|explicit|clean|version)\b/g;

export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\(\[][^\)\]]*(official|video|audio|lyric|remaster|visualizer|hd|4k)[^\)\]]*[\)\]]/g, ' ')
    .replace(/\b(feat|ft|featuring)\.?\s+[^-()[\]]+/g, ' ')
    .replace(NOISE, ' ')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9äöüß\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Erster Künstler, ohne „feat.“ usw. */
export function primaryArtist(artist: string): string {
  return normalizeText(artist.split(/,|;|\s+x\s+|\s+&\s+|\s+und\s+|\s+and\s+|\s+feat\.?\s+|\s+ft\.?\s+/i)[0] ?? artist);
}

function tokens(s: string): Set<string> {
  return new Set(s.split(' ').filter((t) => t.length > 0));
}

/** Jaccard-Ähnlichkeit der Wörter, 0..1 */
export function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const ta = tokens(a);
  const tb = tokens(b);
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const union = ta.size + tb.size - inter;
  return union === 0 ? 0 : inter / union;
}

export interface MatchTarget {
  title: string;
  artist: string;
  album?: string;
  durationSec?: number;
  isrc?: string;
}

/**
 * Bewertet, wie gut `candidate` zum gesuchten Song passt (0..1, < 0 = ausgeschlossen).
 * Regeln (Abschnitt 2): Dauer ±5 s, falls bekannt; sonst Album-Abgleich und offizielle Aufnahme bevorzugen.
 */
export function matchScore(target: MatchTarget, candidate: UnifiedItem): number {
  if (candidate.type !== 'track') return -1;
  if (target.isrc && candidate.isrc) return target.isrc === candidate.isrc ? 1 : -1;

  const hasDurations = !!target.durationSec && !!candidate.durationSec;
  if (hasDurations && Math.abs(target.durationSec! - candidate.durationSec!) > 5) return -1;

  const tTitle = normalizeText(target.title);
  const cTitle = normalizeText(candidate.title);
  const tArtist = primaryArtist(target.artist);
  const cArtistFull = normalizeText(candidate.artist);

  // Bei Videos steht der Künstler oft im Titel („Künstler - Titel“).
  const titleSim = Math.max(similarity(tTitle, cTitle), similarity(`${tArtist} ${tTitle}`, cTitle));
  const artistSim = cArtistFull.includes(tArtist) || tArtist.includes(cArtistFull) ? 1 : similarity(tArtist, cArtistFull);
  if (titleSim < 0.5 || (artistSim < 0.3 && !cTitle.includes(tArtist))) return -1;

  let score = titleSim * 0.55 + Math.max(artistSim, cTitle.includes(tArtist) ? 0.8 : 0) * 0.3;
  if (hasDurations) score += 0.1;
  else {
    if (target.album && candidate.album && similarity(normalizeText(target.album), normalizeText(candidate.album)) >= 0.6) score += 0.08;
    if (candidate.isOfficial) score += 0.07;
  }
  if (candidate.isOfficial && hasDurations) score += 0.03;
  // Live-/Remix-Versionen nur, wenn auch gesucht
  const variant = /\b(live|remix|cover|karaoke|instrumental|slowed|reverb|sped up|nightcore|8d)\b/;
  if (variant.test(cTitle) && !variant.test(tTitle)) score -= 0.3;
  return score;
}

/** Bester Treffer mit Mindestwert, sonst undefined. */
export function bestMatch(target: MatchTarget, candidates: UnifiedItem[], minScore = 0.6): UnifiedItem | undefined {
  let best: UnifiedItem | undefined;
  let bestScore = minScore;
  for (const c of candidates) {
    const s = matchScore(target, c);
    if (s >= bestScore) {
      best = c;
      bestScore = s;
    }
  }
  return best;
}

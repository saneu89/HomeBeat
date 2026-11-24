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

/** Abwandlungen eines Songs – nur erlaubt, wenn der gesuchte Titel das Wort selbst enthält. */
const VARIANT_WORDS = ['slowed', 'reverb', 'sped', 'nightcore', 'remix', 'cover', 'karaoke', 'instrumental', 'live', 'edit', '8d'];

/** Variantenwörter im Rohtext (vor normalizeText, das z. B. Klammern mit „version“ entfernt). */
function variantWords(s: string): Set<string> {
  const words = new Set(s.toLowerCase().split(/[^a-z0-9]+/));
  return new Set(VARIANT_WORDS.filter((w) => words.has(w)));
}

/**
 * Bewertet, wie gut `candidate` zum gesuchten Song passt (0..1, < 0 = ausgeschlossen).
 * Streng (lieber „nicht gefunden“ als ein falscher Song):
 * - Dauer muss auf beiden Seiten bekannt sein und auf ±5 s passen.
 * - Künstler muss passen (im Künstlerfeld, nicht nur irgendwo im Titel).
 * - Varianten (slowed, remix, live …) nur, wenn der gesuchte Titel das Wort selbst enthält.
 */
export function matchScore(target: MatchTarget, candidate: UnifiedItem): number {
  if (candidate.type !== 'track') return -1;
  if (!target.durationSec || !candidate.durationSec) return -1;
  if (Math.abs(target.durationSec - candidate.durationSec) > 5) return -1;
  if (target.isrc && candidate.isrc) return target.isrc === candidate.isrc ? 1 : -1;

  const wanted = variantWords(target.title);
  for (const w of variantWords(candidate.title)) if (!wanted.has(w)) return -1;

  const tArtist = primaryArtist(target.artist);
  const cArtist = normalizeText(candidate.artist);
  if (!tArtist || !cArtist) return -1;
  const artistOk = ` ${cArtist} `.includes(` ${tArtist} `) || similarity(tArtist, primaryArtist(candidate.artist)) >= 0.8;
  if (!artistOk) return -1;

  const tTitle = normalizeText(target.title);
  const cTitle = normalizeText(candidate.title);
  // Bei Videos steht der Künstler oft zusätzlich im Titel („Künstler - Titel“).
  const titleSim = Math.max(similarity(tTitle, cTitle), similarity(tTitle, cTitle.replace(tArtist, '').trim()));
  if (titleSim < 0.7) return -1;

  let score = 0.6 + titleSim * 0.3;
  if (candidate.isOfficial) score += 0.05;
  if (target.album && candidate.album && similarity(normalizeText(target.album), normalizeText(candidate.album)) >= 0.6) score += 0.05;
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

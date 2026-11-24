// Selbsttest für den Künstler-Titel-Abgleich: `node scripts/check-matching.mts`
import assert from 'node:assert/strict';

import { bestMatch } from '../src/services/matching.ts';
import type { UnifiedItem } from '../src/types/UnifiedItem.ts';

const target = { title: 'Shape of You', artist: 'Ed Sheeran', durationSec: 234 };
const track = (title: string, artist: string, durationSec?: number, album?: string): UnifiedItem => ({
  id: `x:${title}|${artist}`, type: 'track', source: 'audius', title, artist, durationSec, album, isLive: false, isExplicit: false,
});

const ok = track('Shape of You', 'Ed Sheeran', 233);
assert.equal(bestMatch(target, [ok]), ok);
assert.equal(bestMatch(target, [track('Ed Sheeran - Shape of You (Official Audio)', 'Ed Sheeran', 236)])?.durationSec, 236);
// falscher Künstler (Uploader), Dauer fehlt/abweichend, Varianten
assert.equal(bestMatch(target, [track('Shape of You', 'chromonicci.', 234)]), undefined);
assert.equal(bestMatch(target, [track('Shape of You', 'Ed Sheeran')]), undefined);
assert.equal(bestMatch(target, [track('Shape of You', 'Ed Sheeran', 240)]), undefined);
for (const v of ['Slowed', 'Sped Up', 'Nightcore', 'Remix', 'Live', 'Edit', 'Karaoke Version', '8D Audio'])
  assert.equal(bestMatch(target, [track(`Shape of You (${v})`, 'Ed Sheeran', 234)]), undefined, v);
// Variante erlaubt, wenn gesucht
const live = { title: 'Shape of You (Live)', artist: 'Ed Sheeran', durationSec: 250 };
assert.ok(bestMatch(live, [track('Shape of You - Live', 'Ed Sheeran', 252)]));
// anderer Song desselben Künstlers
assert.equal(bestMatch(target, [track('Perfect', 'Ed Sheeran', 234)]), undefined);
console.log('matching: ok');

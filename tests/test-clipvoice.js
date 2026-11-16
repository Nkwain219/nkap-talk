// Recorded Pidgin voice: ids, sentence splitting, clip tiling, and the number vocabulary.
const load = require('./load');
const P = load(['values.js', 'phrasebook.js', 'clipvoice.js', 'speech.js']);
const C = P.clipvoice;
const S = P.speech;

let fails = 0, checks = 0;
const check = (cond, msg) => { checks++; if (!cond) { fails++; console.log('FAIL', msg); } };

// 1. ids are filename-safe, stable, and unique even for long text
check(C.slug('Moni wey dey your account na') === 'moni-wey-dey-your-account-na', 'slug of a phrase');
check(C.slug("Lamnso'") === 'lamnso', 'apostrophe dropped');
check(C.slug('  Abeg,  talk   again! ') === 'abeg-talk-again', 'punctuation and spacing');
check(C.slug('five') === C.slug('Five'), 'case does not change the id');
check(/^[a-z0-9-]+$/.test(C.slug('Déjà vu — 5 000 FCFA')), 'id stays filename-safe');
const longA = 'a'.repeat(40) + ' one two three four five six seven eight';
const longB = 'a'.repeat(40) + ' one two three four five six seven nine';
check(C.slug(longA) !== C.slug(longB), 'long texts that share a head get different ids');
check(C.slug(longA).length <= 60, 'long id stays short enough for a filename');
check(C.slug(longA) === C.slug(longA), 'id is deterministic');

// 2. words() splits hyphens, because "twenty-one" is two recordings
check(C.words('twenty-one franc').join('|') === 'twenty|one|franc', 'hyphen splits into words');
check(C.words('Na 5 000 FCFA.').join('|') === 'na|5|000|fcfa', 'digits survive as words');

// 3. sentences(): clips never span a sentence ender
const sents = C.sentences('Dis na your account page. Moni na five franc. You fit talk!');
check(sents.length === 3, `3 sentences, got ${sents.length}`);
check(sents[1] === 'Moni na five franc.', 'middle sentence intact');
check(C.sentences('').length === 0, 'empty text has no sentences');

// 4. plan(): longest match wins, and one missing word disqualifies the sentence
const have = new Set(['moni-wey-dey-your-account-na', 'moni', 'five', 'thousand', 'franc', 'na']);
check(C.plan('Moni wey dey your account na five thousand franc.', have)
  .join('|') === 'moni-wey-dey-your-account-na|five|thousand|franc', 'phrase clip preferred over single words');
check(C.plan('Moni na six franc.', have) === null, 'missing word -> whole sentence refused');
check(C.plan('', have) === null, 'empty sentence -> null');
check(C.plan('five', new Set()) === null, 'no clips -> null');

// 5. coverage() reports per sentence
const cov = C.coverage('Moni na five franc. Moni na six franc.', have);
check(cov.total === 2 && cov.clips === 1, `coverage ${cov.clips}/${cov.total}`);
check(Math.abs(cov.ratio - 0.5) < 1e-9, 'coverage ratio');

// 6. The closed number vocabulary really is closed. Every word speech.js can produce for a
// value must have a clip, or an amount would be read half by a person and half by the robot
// voice. This check fails if speech.js ever starts emitting a word that is not recorded.
const vocab = new Set(C.NUMBERS);
const uncovered = new Set();
const feed = (text) => C.words(text).map(C.clipWord).forEach((w) => { if (!vocab.has(w)) uncovered.add(w); });
const samples = [0, 1, 7, 10, 13, 19, 20, 21, 42, 99, 100, 101, 110, 115, 199, 200, 999,
  1000, 1001, 1100, 5100, 9999, 10000, 25000, 100000, 250000, 900000, 999999,
  1000000, 1500000, 999999999, 1000000000, 1234567890];
samples.forEach((n) => feed(S.numberToWords(String(n))));
for (let n = 0; n <= 1000; n++) feed(S.numberToWords(String(n)));
feed(S.numberToWords('1,5'));
feed(S.numberToWords('250 000'));
feed(S.numberToWords('-75'));
feed(S.numberToWords('+75'));
check(uncovered.size === 0, `number words with no clip: ${[...uncovered].join(', ')}`);

// 7. a whole money reply is coverable by Tier 1 plus the one sentence clip
const spoken = S.toSpeech('Moni wey dey your account na 5 100 FCFA.');
check(/five thousand, one hundred franc/.test(spoken), `toSpeech: ${spoken}`);
const tier1 = new Set(C.NUMBERS.map(C.slug));
tier1.add(C.slug('moni wey dey your account na'));
check(C.plan(spoken, tier1) !== null, `money sentence fully covered: ${spoken}`);

// 8. percent, phone and reference also stay inside the vocabulary
const extra = new Set();
const feedSpoken = (t) => C.words(S.toSpeech(t)).map(C.clipWord).forEach((w) => { if (!vocab.has(w)) extra.add(w); });
feedSpoken('1,5 %');
feedSpoken('+237 6 99 00 11 22');
feedSpoken('SAF-2026-L8NV4F');
check(extra.size === 0, `value words with no clip: ${[...extra].join(', ')}`);

// a bare digit is read from the number clip, not left to the robot voice
check(C.clipWord('2') === 'two', 'digit 2 maps to the "two" clip');
check(C.clipWord('0') === 'zero', 'digit 0 maps to the "zero" clip');
check(C.clipWord('franc') === 'franc', 'a word is left alone');
check(C.plan(S.toSpeech('+237 6 99 00 11 22'), tier1) !== null, 'phone number fully covered by tier 1');
check(C.plan(S.toSpeech('SAF-2026-L8NV4F'), tier1) !== null, 'reference fully covered by tier 1');
check(C.plan(S.toSpeech('1,5 %'), tier1) !== null, 'percentage fully covered by tier 1');

// 9. the generated recording script agrees with the code
let wanted = null;
try { wanted = require('../nkaptalk-extension/audio/pcm/wanted.json'); } catch (e) {}
if (wanted) {
  const ids = new Set(wanted.map((w) => w.id));
  check(ids.size === wanted.length, 'recording script has no duplicate file ids');
  wanted.forEach((w) => { if (w.id !== C.slug(w.text)) check(false, `id drifted for "${w.text}"`); });
  checks++;
  const numbers = wanted.filter((w) => w.tier === 'numbers').map((w) => w.text);
  check(numbers.length === C.NUMBERS.length, `tier 1 has all ${C.NUMBERS.length} number clips`);
} else {
  console.log('note: run `node tools/build-clips.js script` to check the recording script too');
}

console.log(`${checks} checks, failures ${fails}`);
process.exit(fails ? 1 : 0);

// Offline lexicons for the local languages: matching, the review gate, and value safety.
const fs = require('fs');
const path = require('path');
const load = require('./load');
// the sandbox has no fetch; this one answers from `reply`, which the test changes below
let reply = { ok: false };
const P = load(['values.js', 'phrasebook.js', 'localize.js', 'localbook.js'],
  { fetch: async () => reply });
const LB = P.localbook;
const TOOL = require('../tools/build-lexicon.js');

let fails = 0, checks = 0;
const check = (cond, msg) => { checks++; if (!cond) { fails++; console.log('FAIL', msg); } };

// 1. a lexicon source is shaped exactly like a Pidgin phrasebook key, so both match alike
check(LB.shapeOfSource('Solde disponible') === P.phrasebook.norm('solde disponible'), 'plain string shape');
check(LB.shapeOfSource('Numéro de compte : {}') === 'numéro de compte : {}', LB.shapeOfSource('Numéro de compte : {}'));
check(LB.shapeOfSource('Frais : {} pour {}').split('{}').length === 3, 'two slots survive shaping');

// 2. the review gate. Text stands in for a real translation; no real one is invented here.
const fixture = {
  language: 'ewo', name: 'Ewondo',
  entries: [
    { src: 'Solde disponible', pidgin: 'Moni wey dey your account', out: 'REVIEWED-BALANCE', reviewed: true, by: 'A. Speaker' },
    { src: 'Numéro de compte : {}', pidgin: 'Account number : {1}', out: 'REVIEWED-ACCT {1}', reviewed: true, by: 'A. Speaker' },
    { src: 'Effectuer un transfert', pidgin: 'Send moni', out: 'DRAFT-TRANSFER', reviewed: false, by: '' },
    { src: 'Consulter les frais', pidgin: 'Look di charge', out: '', reviewed: false, by: '' },
  ],
};
const tmp = path.join(require('os').tmpdir(), 'nkaptalk-lexicon-test.json');
fs.writeFileSync(tmp, JSON.stringify(fixture));

// load() fetches in the browser; in Node the table is filled from the same shape of data
(function loadFixture() {
  // mirror load()'s table building through the public shaping helper
  const entries = fixture.entries.filter((e) => e.out);
  check(entries.length === 3, 'fixture has three filled lines');
})();

(async () => {
  reply = { ok: true, json: async () => fixture };
  const counts = await LB.load('ewo');
  check(counts.lines === 4, `4 lines, got ${counts.lines}`);
  check(counts.filled === 3, `3 filled, got ${counts.filled}`);
  check(counts.reviewed === 2, `2 reviewed, got ${counts.reviewed}`);

  const ok = LB.lookup('Solde disponible');
  check(ok && ok.text === 'REVIEWED-BALANCE', 'reviewed line is used');
  check(ok && ok.how === 'lexicon', 'reviewed line reports "lexicon"');
  check(ok && ok.by === 'A. Speaker', 'reviewer is carried through');

  check(LB.lookup('Effectuer un transfert') === null, 'unreviewed draft withheld by default');
  const draft = LB.lookup('Effectuer un transfert', true);
  check(draft && draft.text === 'DRAFT-TRANSFER', 'draft used when drafts are allowed');
  check(draft && draft.how === 'draft', 'draft reports "draft", so the panel can say so');

  check(LB.lookup('Consulter les frais', true) === null, 'empty line is not a translation');
  check(LB.lookup('Quelque chose inconnu', true) === null, 'unknown string -> null');

  // 3. the page's own value goes back into the slot, unchanged
  const withVal = LB.lookup('Numéro de compte : SAF-001-2026');
  check(withVal && withVal.text === 'REVIEWED-ACCT SAF-001-2026', `value filled: ${withVal && withVal.text}`);

  // 4. switching to Pidgin clears the table, so no local text leaks into Pidgin mode
  await LB.load('pcm');
  check(LB.lookup('Solde disponible', true) === null, 'Pidgin mode has no lexicon');
  check(LB.counts.lines === 0, 'counts reset for Pidgin');

  // 5. a lexicon that will not load leaves everything null rather than throwing
  reply = { ok: false };
  await LB.load('dua');
  check(LB.lookup('Solde disponible', true) === null, 'missing lexicon file is survivable');

  // 6. the generator refuses lines whose value slots do not line up
  check(TOOL.problems('Solde disponible', 'Mbolo').length === 0, 'no slots, no slots used: fine');
  check(TOOL.problems('Numéro de compte : {}', 'Nomba {1}').length === 0, 'one slot used once: fine');
  check(TOOL.problems('Numéro de compte : {}', 'Nomba').length === 1, 'missing slot refused');
  check(TOOL.problems('Numéro de compte : {}', 'Nomba {1} {1}').length === 1, 'repeated slot refused');
  check(TOOL.problems('Numéro de compte : {}', 'Nomba {2}').length === 1, 'out-of-range slot refused');
  check(TOOL.problems('Solde disponible', 'Mbolo {1}').length === 1, 'slot with no value refused');
  check(TOOL.problems('Frais : {}', 'Nkap 100 {1}').length === 1, 'a digit written by hand refused');
  check(TOOL.problems('Frais : {}', '').length === 0, 'not filled in yet is not an error');
  check(TOOL.slots('Frais : {} pour {}') === 2, 'slot counting');

  // 7. every shipped lexicon is valid JSON, covers the page, and invents nothing
  const dir = path.join(__dirname, '..', 'nkaptalk-extension', 'lexicon');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json')) : [];
  check(files.length === 8, `8 lexicons shipped, found ${files.length}`);
  for (const f of files) {
    const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    check(Array.isArray(data.entries) && data.entries.length > 150, `${f}: covers the page (${data.entries.length} lines)`);
    let bad = 0;
    for (const e of data.entries) {
      if (TOOL.problems(e.src, e.out).length) bad++;
      if (e.reviewed && !e.out) bad++;
    }
    check(bad === 0, `${f}: ${bad} invalid line(s)`);
  }

  fs.unlinkSync(tmp);
  console.log(`${checks} checks, failures ${fails}`);
  process.exit(fails ? 1 : 0);
})();

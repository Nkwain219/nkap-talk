#!/usr/bin/env node
/*
 * NkapTalk — offline lexicons for the local languages.
 *
 *   node tools/build-lexicon.js stub  <lang|--all>        create/refresh the file to fill in
 *   node tools/build-lexicon.js check <lang|--all>        validate and report coverage
 *   node tools/build-lexicon.js merge <lang> <file.json>  fold in translations
 *
 * Pidgin ships a reviewed phrasebook, so the page works offline with no key. This gives the
 * local languages the same thing. The file holds every interface string of the SAFINUM test
 * environment, in French and English, with its reviewed Pidgin alongside so a reviewer can
 * see what the line means.
 *
 * Nothing here invents a translation. `out` starts empty and is filled by native speakers, or
 * by exporting the drafts Gemini already produced in the browser and having speakers check
 * them. Each line carries its own `reviewed` flag and the name of whoever checked it, and by
 * default NkapTalk shows only reviewed lines: an unreviewed line falls back to Pidgin rather
 * than showing a guess to someone moving money.
 *
 * The value rules are the same as everywhere else: {} marks a value in the source, {1}, {2}...
 * put those values back, and a line whose slots do not line up, or that writes a digit of its
 * own, is refused here rather than at runtime.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const EXT = path.join(ROOT, 'nkaptalk-extension');
const DIR = path.join(EXT, 'lexicon');

const NK = require(path.join(ROOT, 'tests', 'load.js'))(['values.js', 'phrasebook.js', 'localbook.js', 'numerals.js', 'clipvoice.js']);
const PB = NK.phrasebook;
const VOICES = NK.clipvoice.VOICES;
const LOCALS = Object.keys(VOICES).filter((l) => l !== 'pcm');

const file = (lang) => path.join(DIR, lang + '.json');
const slots = (src) => src.split('{}').length - 1;

/** Problems with one filled-in line, as messages. Empty means it is usable. */
function problems(src, out) {
  const errs = [];
  if (typeof out !== 'string' || !out.trim()) return errs; // not filled in yet: not an error
  const want = slots(src);
  const used = (out.match(/\{(\d+)\}/g) || []).map((m) => Number(m.slice(1, -1)));
  if (used.length !== want || new Set(used).size !== want || used.some((n) => n < 1 || n > want)) {
    errs.push(want
      ? `needs ${Array.from({ length: want }, (_, i) => `{${i + 1}}`).join(', ')} once each`
      : 'the source has no value, so the translation must have no {1}');
  }
  if (/\d/.test(out.replace(/\{\d+\}/g, ''))) errs.push('digits must come from the page, use {1}, {2}...');
  return errs;
}

function read(lang) {
  const p = file(lang);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function write(lang, data) {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(file(lang), JSON.stringify(data, null, 2) + '\n');
}

function cmdStub(lang) {
  const existing = read(lang) || { language: lang, name: VOICES[lang].name, entries: [] };
  const bySrc = new Map((existing.entries || []).map((e) => [e.src, e]));
  const entries = [];
  const seen = new Set();
  for (const [src, pidgin] of PB.ENTRIES) {
    if (seen.has(src)) continue;
    seen.add(src);
    const old = bySrc.get(src);
    entries.push({
      src,
      pidgin,
      out: (old && old.out) || '',
      reviewed: !!(old && old.reviewed && old.out),
      by: (old && old.by) || '',
    });
  }
  const dropped = [...bySrc.keys()].filter((s) => !seen.has(s)).length;
  write(lang, { language: lang, name: VOICES[lang].name, entries });
  const filled = entries.filter((e) => e.out).length;
  const reviewed = entries.filter((e) => e.reviewed).length;
  console.log(`${VOICES[lang].name} (${lang}): ${entries.length} lines, ${filled} filled, ${reviewed} reviewed`
    + (dropped ? `, ${dropped} dropped (no longer on the page)` : ''));
}

function cmdCheck(lang) {
  const data = read(lang);
  if (!data) { console.log(`${lang}: no lexicon yet, run: build-lexicon.js stub ${lang}`); return 0; }
  let bad = 0;
  const entries = data.entries || [];
  entries.forEach((e, i) => {
    problems(e.src, e.out).forEach((m) => { bad++; console.log(`  line ${i + 1}: ${m}\n    src: ${e.src}\n    out: ${e.out}`); });
    if (e.reviewed && !e.out) { bad++; console.log(`  line ${i + 1}: marked reviewed but empty`); }
  });
  const filled = entries.filter((e) => e.out).length;
  const reviewed = entries.filter((e) => e.reviewed && e.out).length;
  const pct = entries.length ? Math.round((reviewed / entries.length) * 100) : 0;
  console.log(`${String(VOICES[lang].name).padEnd(10)} ${String(reviewed).padStart(4)}/${String(entries.length).padEnd(4)} reviewed ${String(pct).padStart(3)}%`
    + `  (${filled} filled, ${filled - reviewed} awaiting review)` + (bad ? `  ${bad} PROBLEM(S)` : ''));
  return bad;
}

/**
 * Fold in translations. The file may be {src: out} or a list of {src, out, by}.
 * A line already marked reviewed is never overwritten by an unreviewed value.
 */
function cmdMerge(lang, src) {
  const data = read(lang);
  if (!data) { console.error(`no lexicon for ${lang}; run stub first`); process.exit(2); }
  const raw = JSON.parse(fs.readFileSync(src, 'utf8'));
  const incoming = new Map();
  if (Array.isArray(raw)) raw.forEach((r) => r && r.src && incoming.set(r.src, r));
  else Object.entries(raw).forEach(([k, v]) => incoming.set(k, typeof v === 'string' ? { src: k, out: v } : { src: k, ...v }));

  let added = 0, skipped = 0, refused = 0, unknown = 0;
  // match on shape as well as on the exact string: drafts exported from the browser come
  // from real page text, which can carry a value where the canonical source has none
  const shape = (t) => NK.localbook.shapeOfSource(t);
  const byShape = new Map();
  for (const [k, v] of incoming) { try { byShape.set(shape(k), v); } catch (err) { /* skip */ } }
  const matched = new Set();
  for (const e of data.entries) {
    const inc = incoming.get(e.src) || byShape.get(shape(e.src));
    if (inc) matched.add(inc);
    if (!inc || !inc.out) continue;
    if (e.reviewed && !inc.reviewed) { skipped++; continue; }
    const errs = problems(e.src, inc.out);
    if (errs.length) { refused++; console.log(`  refused: ${e.src}\n    ${errs.join('; ')}`); continue; }
    e.out = inc.out;
    e.reviewed = !!inc.reviewed;
    e.by = inc.by || e.by || '';
    added++;
  }
  for (const v of incoming.values()) if (!matched.has(v)) unknown++;
  write(lang, data);
  console.log(`${VOICES[lang].name}: ${added} merged, ${skipped} kept (already reviewed), ${refused} refused`
    + (unknown ? `, ${unknown} not on the page and ignored` : ''));
}

module.exports = { problems, slots };

if (require.main !== module) return;

const cmd = process.argv[2];
const args = process.argv.slice(3);
const all = args.includes('--all');
const targets = all ? LOCALS : args.filter((a) => !a.startsWith('--') && VOICES[a]);
if (cmd === 'merge') {
  const lang = args[0];
  const src = args[1];
  if (!VOICES[lang] || !src) { console.error('usage: build-lexicon.js merge <lang> <file.json>'); process.exit(2); }
  cmdMerge(lang, src);
} else if (cmd === 'stub' || cmd === 'check') {
  const list = targets.length ? targets : LOCALS;
  let bad = 0;
  list.forEach((l) => { bad += (cmd === 'stub' ? (cmdStub(l), 0) : cmdCheck(l)); });
  process.exit(bad ? 1 : 0);
} else {
  console.error('usage: build-lexicon.js stub|check <lang|--all>  |  merge <lang> <file.json>');
  process.exit(2);
}

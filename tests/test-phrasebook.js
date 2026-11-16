const assert = require('assert');
const load = require('./load');
const strings = require('./strings');
const P = load(['values.js', 'phrasebook.js']);
const V = P.values;

let fails = 0;
const check = (cond, msg) => { if (!cond) { fails++; console.log('FAIL', msg); } };

// 1. Value detection on known values
const expect = {
  '250 000 FCFA': ['MONEY:250 000 FCFA'],
  '+180,000 FCFA': ['MONEY:+180,000 FCFA'],
  '-12 500 FCFA': ['MONEY:-12 500 FCFA'],
  'Numéro de compte : CM 001 2345 6789 01': ['ACCOUNT:CM 001 2345 6789 01'],
  '+237 6 99 12 34 56': ['PHONE:+237 6 99 12 34 56'],
  'SAF-2026-L8NV4F': ['REF:SAF-2026-L8NV4F'],
  'SECURITY_001': ['CODE:SECURITY_001'],
  'Frais de 1,5 % (min. 100 FCFA, max. 2 500 FCFA)': ['MONEY:100 FCFA', 'MONEY:2 500 FCFA', 'PERCENT:1,5 %'],
  '1.5% fee (min. 100 FCFA, max. 2,500 FCFA)': ['MONEY:100 FCFA', 'MONEY:2,500 FCFA', 'PERCENT:1.5%'],
  '05 nov. 2026': ['DATE:05 nov. 2026'],
  'Nov 5, 2026': ['DATE:Nov 5, 2026'],
};
for (const [t, v] of Object.entries(expect)) {
  check(JSON.stringify(V.values(t)) === JSON.stringify(v.slice().sort()), `values(${t}) = ${JSON.stringify(V.values(t))}`);
}

// 2. Every string: either nothing to translate, a name, or a phrasebook hit with values intact
let translated = 0, skipped = 0;
for (const lang of ['fr', 'en']) {
  for (const s of strings[lang]) {
    if (!V.hasWords(s) || V.isLikelyName(s)) { skipped++; continue; }
    const r = P.phrasebook.lookup(s);
    check(r, `[${lang}] no translation: "${s}"`);
    if (!r) continue;
    translated++;
    check(V.sameValues(s, r.text), `[${lang}] values changed: "${s}" -> "${r.text}"`);
    check(!/[{}]|⟦/.test(r.text), `[${lang}] leftover placeholder: "${r.text}"`);
  }
}

// 3. Names and brands are not touched
check(V.isLikelyName('Amina Ngo Bell'), 'Amina Ngo Bell is a name');
check(V.isLikelyName('Jean-Paul Mbarga'), 'Jean-Paul Mbarga is a name');
check(!V.hasWords('Safinum Pay'), 'Safinum Pay has nothing to translate');
check(!V.hasWords('AN') && !V.hasWords('EN'), 'initials skipped');

// 4. User-typed values are protected inside sentences
V.addUserValue('Ngwa Paul');
const m = V.mask('Transfert à Ngwa Paul de 5 000 FCFA');
check(m.tokens.some((t) => t.kind === 'NAME' && t.value === 'Ngwa Paul'), 'user name masked');
check(V.unmask(m.masked, m.tokens) === 'Transfert à Ngwa Paul de 5 000 FCFA', 'unmask round trip');

// 5. Tampering is detected
check(!V.sameValues('Total : 5 100 FCFA', 'Total : 5 000 FCFA'), 'changed amount detected');
check(!V.placeholdersMatch('a ⟦1⟧ b ⟦2⟧', 'a ⟦1⟧ b'), 'missing placeholder detected');

console.log(`translated ${translated}, skipped (values/names) ${skipped}, failures ${fails}`);
process.exit(fails ? 1 : 0);

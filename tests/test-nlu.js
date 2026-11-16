// Ways people ask, in Cameroonian Pidgin. Same list as PIDGIN-REVIEW.md.
const load = require('./load');
const P = load(['values.js', 'env.js', 'speech.js', 'nlu.js']);
const N = P.nlu;

const cases = [
  ['How much moni dey my account?', { intent: 'BALANCE' }],
  ['Check my balance', { intent: 'BALANCE' }],
  ['Wetin remain for my account?', { intent: 'BALANCE' }],
  ['Abeg, tell me my balance', { intent: 'BALANCE' }],
  ['How much I get for bank?', { intent: 'BALANCE' }],
  ['Account dey how?', { intent: 'BALANCE' }],
  ['I wan send moni', { intent: 'TRANSFER' }],
  ['I wan send five tausand give my brother', { intent: 'TRANSFER', amount: 5000, name: null }],
  ['Send 10000 give Ngwa Paul', { intent: 'TRANSFER', amount: 10000, name: 'Ngwa Paul' }],
  ['Transfer two thousand five hundred for my mami', { intent: 'TRANSFER', amount: 2500, name: null }],
  ['I wan do momo transfer of 3000', { intent: 'TRANSFER', amount: 3000, type: 'mobile_money' }],
  ['Abeg send 5k for my padi Che Kevin', { intent: 'TRANSFER', amount: 5000, name: 'Che Kevin' }],
  ['Send fifty thousand franc for mobile money', { intent: 'TRANSFER', amount: 50000, type: 'mobile_money' }],
  ['How much dem go cut if I send 20000?', { intent: 'FEES', amount: 20000 }],
  ['Wetin be di charge for mobile money?', { intent: 'FEES', type: 'mobile_money' }],
  ['Show me di fees', { intent: 'FEES' }],
  ['How much e go cost?', { intent: 'FEES' }],
  ['Wetin dey for screen?', { intent: 'READ_SCREEN' }],
  ['Read di page for me', { intent: 'READ_SCREEN' }],
  ['Wetin dis one mean?', { intent: 'READ_SCREEN' }],
  ['Where I dey now?', { intent: 'READ_SCREEN' }],
  ['Wetin I don spend last time?', { intent: 'HISTORY' }],
  ['Yes, send am', { yes: true }],
  ['Na so', { yes: true }],
  ['Oya do am', { yes: true }],
  ['No, wait', { no: true, yes: false }],
  ['E no correct', { no: true, yes: false }],
  ['Go front', { intent: 'CONTINUE' }],
  ['Go back', { intent: 'BACK' }],
  ['I wan change am', { intent: 'EDIT' }],
  ['Confirm am', { intent: 'CONFIRM', yes: true }],
  ['Say am again', { intent: 'REPEAT' }],
  ['Talk small small', { intent: 'SLOW' }],
  ['Who win di match yesterday?', { intent: 'OFF_TOPIC' }],
  ['Tell me one story', { intent: 'OFF_TOPIC' }],
];

let fails = 0;
for (const [text, exp] of cases) {
  const r = N.parseLocal(text, null);
  for (const [k, v] of Object.entries(exp)) {
    if (r[k] !== v) { fails++; console.log(`FAIL "${text}": ${k}=${JSON.stringify(r[k])}, expected ${JSON.stringify(v)}`); }
  }
}

// Answers to a question NkapTalk asked
const ans = [
  [['six seven seven double one two three four five', 'phone'], 'phone', '+237 6 77 11 23 45'],
  [['677 11 23 45', 'phone'], 'phone', '+237 6 77 11 23 45'],
  [['Di name na Mbah Divine', 'name'], 'name', 'Mbah Divine'],
  [['Fon Ernestine', 'name'], 'name', 'Fon Ernestine'],
  [['Na mobile money', 'type'], 'type', 'mobile_money'],
  [['Another bank', 'type'], 'type', 'other_bank'],
  [['cinq mille', 'amount'], 'amount', 5000],
  [['two hundred and fifty thousand', 'amount'], 'amount', 250000],
  [['5 000', 'amount'], 'amount', 5000],
];
for (const [[text, awaiting], key, exp] of ans) {
  const r = N.parseLocal(text, awaiting);
  if (r[key] !== exp) { fails++; console.log(`FAIL answer "${text}" (${awaiting}): ${key}=${JSON.stringify(r[key])}, expected ${JSON.stringify(exp)}`); }
}

// Speech of values
const S = P.speech;
const speechCases = [
  ['Charge na 100 FCFA', 'Charge na one hundred franc'],
  ['Total na 5 100 FCFA', 'Total na five thousand, one hundred franc'],
  ['Balance na 250,000 FCFA', 'Balance na two hundred fifty thousand franc'],
  ['Number na +237 6 99 12 34 56', 'Number na plus 2 3 7 6 9 9 1 2 3 4 5 6'],
  ['Reference na SAF-2026-L8NV4F', 'Reference na S A F, 2 0 2 6, L 8 N V 4 F'],
  ['Charge na 1,5 %', 'Charge na one point five percent'],
];
for (const [t, exp] of speechCases) {
  const got = S.toSpeech(t);
  if (got !== exp) { fails++; console.log(`FAIL speech "${t}" -> "${got}"`); }
}

console.log(`${cases.length + ans.length + speechCases.length} checks, failures ${fails}`);
process.exit(fails ? 1 : 0);

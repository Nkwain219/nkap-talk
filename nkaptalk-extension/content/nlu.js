/*
 * NkapTalk — understanding what the user says (Pidgin, with English/French mixed in).
 * Two engines with the same output:
 *   - local rules (offline, below), built from real ways people ask (see PIDGIN-REVIEW.md)
 *   - Gemini (audio in, structured answer out), when an API key is set
 * Output: { heard, intent, yes, no, amount, phone, type, name, reason }
 * The AI only extracts what the user said. It never sees the screen or its values.
 */
(function () {
  const P = (globalThis.NkapTalk = globalThis.NkapTalk || {});

  const INTENTS = [
    // [intent, regex] — first match wins
    ['STOP', /\b(stop talk|keep quiet|shut up|silence|tais[- ]toi|stop am)\b/],
    ['HELP', /\b(help|wetin you fit do|what can you do|how i go do|i no understand|i no sabi|aide)\b/],
    ['REPEAT', /\b(repeat|say am again|talk am again|tok am again|again|répète|repete|i no hear|wetin you talk|what did you say)\b/],
    ['SLOW', /\b(slow|small small|softly|lentement|no talk fast|talk slow)\b/],
    ['TRANSLATE_OFF', /\b(show (the |di )?(french|english|original)|in french|for french|for english|original text)\b/],
    ['TRANSLATE_ON', /\b(show (the |di )?pidgin|translate (am|the page|di page)|put am for pidgin)\b/],
    ['READ_SCREEN', /\b(wetin dey (here|dis page|di screen|for screen)|what is on (the )?(screen|page)|read (the |di |dis )?(screen|page)|read am|wetin dis (one|page|screen) (talk|say|mean)|wetin e (talk|say|mean)|where i dey|wey place i dey|which page|explain dis|what does it say|wetin dey for screen|wetin happen)\b/],
    ['HISTORY', /\b(transactions?|history|last (moni|money|movement)|wetin i (don )?(spend|pay|buy)|movement|wey don (enter|comot)|historique|recent)\b/],
    ['CONFIRM', /\b(confirm|validate|valider|confirmer|finish am|complete am|send am now|press confirm)\b/],
    ['EDIT', /\b(change am|edit|modify|modifier|correct am|i wan change)\b/],
    ['BACK', /\b(go back|back|return|retour|previous)\b/],
    ['CONTINUE', /\b(continue|next|go front|move on|continuer|suivant|carry go)\b/],
    ['FEES', /\b(fees?|charges?|frais|how much (dem|them|e) go (take|cut|comot|chop)|cost|wetin dem go (take|cut|comot))\b/],
    ['TRANSFER', /\b(send|transfer|transfert|envoy\w*|give (him|her|am|my|dem)|pay (somebody|someone|my)|wan pay|momo|mobile money|dash)\b/],
    ['BALANCE', /\b(balance|solde|how much (moni|money|cash|kwa) (dey|i get|remain|i (still )?get)|wetin remain|my (moni|money|account)|account (dey|be) how|how my account|how much i get|moni (wey )?dey)\b/],
    ['GREET', /^(hello|hi|good (morning|afternoon|evening)|how now|how na|na how|bonjour|bonsoir|nkap ?talk)\b/],
  ];

  const YES = /\b(yes|yeah|yea|yah|ya|oui|ok|okay|oya|na so|na im|na true|correct|e correct|go ahead|press am|do am|send am|confirm am|sure|true|exactly|why not|i agree|abeg do am|carry go)\b/;
  const NO = /\b(no|nope|non|no be so|no do am|wait|cancel|leave am|not correct|e no correct|no send|abeg no|never|stop)\b/;
  const BANKING = /\b(moni|money|cash|kwa|franc|fcfa|account|bank|balance|solde|send|transfer|pay|fee|charge|frais|momo|mobile money|phone|number|name|amount|transaction|confirm|continue|back|change|screen|page|read|repeat|help)\b/;

  const WORDNUM = {
    zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
    twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
    un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12,
    vingt: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60,
  };
  const MULT = {
    hundred: 100, hondred: 100, handred: 100, cent: 100, cents: 100,
    thousand: 1000, tausand: 1000, tauzan: 1000, tousand: 1000, thousan: 1000, mille: 1000, k: 1000,
    million: 1e6, milion: 1e6, millions: 1e6,
  };

  function clean(t) {
    return (t || '').toLowerCase().normalize('NFC').replace(/[’']/g, "'").replace(/[^\p{L}\d\s,.'+-]/gu, ' ').replace(/\s+/g, ' ').trim();
  }

  /** Parses "5000", "5 000", "5,000", "5k", "five thousand", "five tausand one hundred", "cinq mille". */
  function parseAmount(text) {
    const t = clean(text);
    // digits with optional separators and optional multiplier word
    const d = t.match(/(\d{1,3}(?:[ ,.]\d{3})+|\d+)(?:\s*(k|thousand|tausand|tauzan|mille|million|milion))?(?!\d)/);
    if (d) {
      const digitsOnly = d[1].replace(/[ ,.]/g, '');
      if (digitsOnly.length >= 8 && !d[2]) return null; // that is a phone number
      let n = parseInt(digitsOnly, 10);
      if (d[2]) n *= MULT[d[2]] || 1;
      return n > 0 ? n : n === 0 ? 0 : null;
    }
    // number words
    const words = t.split(/[\s-]+/);
    let total = 0, cur = 0, seen = false;
    for (const w of words) {
      if (w in WORDNUM) { cur += WORDNUM[w]; seen = true; }
      else if (w in MULT) {
        const m = MULT[w];
        if (!seen && cur === 0) cur = 1;
        if (m === 100) cur *= 100;
        else { total += cur * m; cur = 0; }
        seen = true;
      } else if (w === 'and' || w === 'et') continue;
      else if (seen && /^(franc|francs|fcfa|cfa|frs?)$/.test(w)) break;
      else if (seen) break;
    }
    return seen ? total + cur : null;
  }

  const DIGIT_WORDS = { zero: '0', oh: '0', o: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', double: 'x2' };

  function parsePhone(text) {
    const t = clean(text);
    // spoken digits "six seven seven ..." -> digits
    let spoken = '';
    let pendingDouble = false;
    for (const w of t.split(/\s+/)) {
      const v = DIGIT_WORDS[w];
      if (v === 'x2') { pendingDouble = true; continue; }
      if (v) { spoken += pendingDouble ? v + v : v; pendingDouble = false; }
      else if (/^\+?\d+$/.test(w)) spoken += w.replace('+', '');
    }
    const raw = t.replace(/[^\d+]/g, '');
    const cand = raw.replace(/\D/g, '').length >= spoken.length ? raw.replace(/\D/g, '') : spoken;
    if (cand.length < 8 || cand.length > 12) return null;
    let n = cand;
    if (n.length === 9 && n[0] === '6') n = '237' + n;
    if (n.startsWith('237') && n.length === 12) return `+237 ${n[3]} ${n.slice(4, 6)} ${n.slice(6, 8)} ${n.slice(8, 10)} ${n.slice(10, 12)}`;
    return n;
  }

  function parseType(text) {
    const t = clean(text);
    if (/\b(mobile money|momo|orange money|mtn|om)\b/.test(t)) return 'mobile_money';
    if (/\b(other bank|another bank|oda bank|odda bank|different bank|autre banque|bank account)\b/.test(t)) return 'other_bank';
    if (/\bsafinum\b/.test(t)) return 'safinum';
    return null;
  }

  const NAME_STOP = new Set(['me', 'di', 'dem', 'am', 'him', 'her', 'my', 'the', 'a', 'one', 'some', 'moni', 'money', 'and', 'for', 'with', 'on', 'by', 'na', 'number', 'phone', 'franc', 'francs', 'fcfa', 'now', 'today', 'please', 'abeg', 'oh', 'o', 'sef']);
  const REL = '(?:my\\s+)?(?:brother|broda|sister|sista|mami|mama|mother|papa|father|friend|padi|pikin|wife|husband|man|woman|uncle|auntie|aunty|cousin|mbanya|bro|sis)';

  function titleCase(s) {
    return s.replace(/\p{L}[\p{L}'-]*/gu, (w) => w[0].toUpperCase() + w.slice(1));
  }

  /** "send 5000 give my brother Ngwa Paul" -> "Ngwa Paul". */
  function parseName(text, { whole = false } = {}) {
    const t = clean(text).replace(/\d[\d\s,.]*/g, ' ');
    let cand = null;
    if (whole) cand = t.replace(/^(na|e na|di name na|name na|him name na|her name na|im name na|call am|my name na)\s+/, '');
    else {
      const m = t.match(new RegExp(`\\b(?:give|to|for|à|a)\\s+(?:${REL}\\s+)?([\\p{L}'-]+(?:\\s+[\\p{L}'-]+){0,2})`, 'u'));
      if (m) cand = m[1];
    }
    if (!cand) return null;
    const words = cand.split(/\s+/).filter((w) => w && !NAME_STOP.has(w) && !/^(thousand|tausand|hundred|mille|k)$/.test(w) && !(w in WORDNUM));
    if (!words.length || words.length > 4) return null;
    if (!whole && new RegExp(`^${REL}$`).test(words.join(' '))) return null;
    return titleCase(words.join(' '));
  }

  /** Offline understanding. `awaiting` says what NkapTalk just asked for. */
  function parseLocal(text, awaiting) {
    const t = clean(text);
    const out = { heard: text, intent: null, yes: false, no: false, amount: null, phone: null, type: null, name: null, reason: null, engine: 'local' };
    if (!t) return out;
    out.yes = YES.test(t) && !/\b(no be so|e no correct|not correct)\b/.test(t);
    out.no = !out.yes && NO.test(t);
    for (const [intent, re] of INTENTS) if (re.test(t)) { out.intent = intent; break; }
    out.amount = parseAmount(t);
    // a lone small number word ("tell me one story") is not an amount unless NkapTalk asked for one
    if (out.amount != null && awaiting !== 'amount' && !/\d/.test(t) && out.amount < 100) out.amount = null;
    out.phone = parsePhone(t);
    out.type = parseType(t);
    out.name = parseName(t);
    if (awaiting === 'name' && !out.intent) out.name = parseName(t, { whole: true });
    if (awaiting === 'reason' && !out.intent) out.reason = text.trim();
    if (awaiting === 'phone' && out.phone) out.amount = null;
    if (!out.intent && !out.yes && !out.no && !awaiting && out.amount == null && !BANKING.test(t)) out.intent = 'OFF_TOPIC';
    return out;
  }

  const INTENT_NAMES = INTENTS.map((i) => i[0]).concat(['OFF_TOPIC']);

  /** Understand an utterance: { text } or { audio (base64 wav) }. */
  async function understand({ text, audio }, awaiting, lastQuestion) {
    const s = P.env.settings;
    if (P.env.online() && s.useGeminiNLU) {
      const res = await P.env.send({ type: 'nlu', text, audio, awaiting, lastQuestion, intents: INTENT_NAMES });
      if (res && res.ok && res.result) {
        const r = res.result;
        const local = parseLocal(r.heard || text || '', awaiting);
        return {
          heard: r.heard || text || '',
          intent: r.intent && INTENT_NAMES.includes(r.intent) ? r.intent : local.intent,
          yes: r.answer === 'yes' || (!r.answer && local.yes),
          no: r.answer === 'no' || (!r.answer && local.no),
          amount: Number.isFinite(r.amount) ? r.amount : local.amount,
          phone: r.phone ? parsePhone(String(r.phone)) || local.phone : local.phone,
          type: ['safinum', 'mobile_money', 'other_bank'].includes(r.transfer_type) ? r.transfer_type : local.type,
          name: r.name ? titleCase(String(r.name)) : local.name,
          reason: r.reason || local.reason,
          unclear: !!r.unclear,
          engine: 'gemini',
        };
      }
      if (audio && !text) return { heard: '', intent: null, engine: 'error', error: res && res.error };
    }
    return parseLocal(text || '', awaiting);
  }

  P.nlu = { understand, parseLocal, parseAmount, parsePhone, parseName, parseType, INTENT_NAMES };
})();

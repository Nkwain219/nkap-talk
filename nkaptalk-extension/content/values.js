/*
 * NkapTalk — value locking.
 * Finds every financial or personal value in a piece of text (amounts, fees,
 * phone numbers, references, account numbers, error codes, dates, names the
 * user typed) so translation can never change them.
 *
 * mask("Frais : 100 FCFA")  -> { masked: "Frais : ⟦1⟧", tokens: [{kind:"MONEY", value:"100 FCFA"}] }
 * unmask(masked, tokens)    -> original values put back, byte for byte
 * sameValues(a, b)          -> true only if both texts carry exactly the same values
 */
(function () {
  const P = (globalThis.NkapTalk = globalThis.NkapTalk || {});

  const MONTHS_FR = 'janv|févr|fevr|mars|avr|mai|juin|juil|août|aout|sept|oct|nov|déc|dec';
  const MONTHS_EN = 'Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept|Sep|Oct|Nov|Dec';
  const SEP = '[\\s\\u00a0\\u202f.,]';
  const NUM = `\\d{1,3}(?:${SEP}\\d{3})+(?:[.,]\\d+)?|\\d+(?:[.,]\\d+)?`;

  // Order = priority when two matches overlap.
  const PATTERNS = [
    ['URL', /\bhttps?:\/\/[^\s]+/g],
    ['EMAIL', /\b[\w.+-]+@[\w-]+\.[\w.]+\b/g],
    ['REF', /\b[A-Z]{2,6}-\d{2,4}-[A-Z0-9]{3,}\b/g],
    ['CODE', /\b[A-Z]{2,}_\d{2,4}\b/g],
    ['ACCOUNT', /\b[A-Z]{2}\s?\d{2,4}(?:\s\d{3,4}){2,}(?:\s\d{2})?\b/g],
    ['MONEY', new RegExp(`[+\\-−]?\\s?(?:${NUM})[\\s\\u00a0\\u202f]?(?:FCFA|F\\s?CFA|XAF|CFA|francs?)(?![\\p{L}])`, 'giu')],
    ['PHONE', /\+\d{1,3}[\s.-]?(?:\d[\s.-]?){7,11}\d|\b6(?:[\s.-]?\d){8}\b/g],
    ['PERCENT', /\d+(?:[.,]\d+)?[\s  ]?%/g],
    ['DATE', new RegExp(`\\b\\d{1,2}\\s(?:${MONTHS_FR})\\.?\\s\\d{4}\\b|\\b(?:${MONTHS_EN})\\.?\\s\\d{1,2},?\\s\\d{4}\\b|\\b\\d{1,2}[\\/.-]\\d{1,2}[\\/.-]\\d{2,4}\\b`, 'giu')],
    ['TIME', /\b\d{1,2}[:h]\d{2}\b/g],
    ['CURRENCY', /\b(?:FCFA|XAF|F CFA|CFA|EUR|USD)\b/g],
    ['NUMBER', new RegExp(`[+\\-−]?(?:${NUM})`, 'g')],
  ];

  // Values the user typed or that are pre-filled in form fields (names, reasons...).
  // Kept in memory only, never stored or sent anywhere: used so translation leaves them alone.
  const userValues = new Set();
  // Proper names and brands that must never be translated.
  const fixedNames = new Set(['Safinum Pay', 'Safinum', 'MTN MoMo', 'Orange Money', 'NkapTalk']);

  function addUserValue(v) {
    if (typeof v !== 'string') return;
    v = v.trim();
    if (v.length >= 2 && v.length <= 80 && /\p{L}/u.test(v)) userValues.add(v);
  }

  function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /** All protected spans in text, non-overlapping, sorted by position. */
  function findSpans(text) {
    if (!text) return [];
    const cands = [];
    const nameList = [...userValues, ...fixedNames].sort((a, b) => b.length - a.length);
    nameList.forEach((name) => {
      const re = new RegExp(`(?<![\\p{L}\\d])${escapeRe(name)}(?![\\p{L}\\d])`, 'gu');
      let m;
      while ((m = re.exec(text))) cands.push({ start: m.index, end: m.index + m[0].length, kind: 'NAME', prio: -1 });
    });
    PATTERNS.forEach(([kind, re], prio) => {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(text))) {
        let s = m.index;
        let v = m[0];
        // trim leading whitespace a pattern may have eaten
        const lead = v.length - v.trimStart().length;
        s += lead;
        v = v.trim();
        if (!v) { re.lastIndex++; continue; }
        cands.push({ start: s, end: s + v.length, kind, prio });
      }
    });
    cands.sort((a, b) => a.prio - b.prio || (b.end - b.start) - (a.end - a.start) || a.start - b.start);
    const taken = [];
    for (const c of cands) {
      if (taken.some((t) => c.start < t.end && t.start < c.end)) continue;
      taken.push(c);
    }
    taken.sort((a, b) => a.start - b.start);
    return taken.map((t) => ({ ...t, value: text.slice(t.start, t.end) }));
  }

  function mask(text) {
    const spans = findSpans(text);
    let out = '';
    let pos = 0;
    const tokens = [];
    spans.forEach((s, i) => {
      out += text.slice(pos, s.start) + `⟦${i + 1}⟧`;
      tokens.push({ kind: s.kind, value: s.value });
      pos = s.end;
    });
    out += text.slice(pos);
    return { masked: out, tokens };
  }

  function unmask(masked, tokens) {
    return masked.replace(/⟦(\d+)⟧/g, (m, n) => {
      const t = tokens[Number(n) - 1];
      return t ? t.value : m;
    });
  }

  /** Placeholders in a masked string, e.g. ["⟦1⟧","⟦2⟧"] (with repeats). */
  function placeholders(s) {
    return (s.match(/⟦\d+⟧/g) || []).slice().sort();
  }

  /** True if every placeholder of src appears exactly as often in out, and no others. */
  function placeholdersMatch(src, out) {
    const a = placeholders(src);
    const b = placeholders(out);
    return a.length === b.length && a.every((x, i) => x === b[i]);
  }

  function values(text) {
    return findSpans(text).map((s) => `${s.kind}:${s.value}`).sort();
  }

  /** Same multiset of protected values in both texts (byte for byte). */
  function sameValues(a, b) {
    const va = values(a);
    const vb = values(b);
    return va.length === vb.length && va.every((x, i) => x === vb[i]);
  }

  const STOP = /\b(le|la|les|de|du|des|et|un|une|pour|avec|votre|vos|est|sur|the|and|of|for|to|your|is|on|with|this|a|an|di|dis|na|wey|go|don|no|fit)\b/i;

  /** "Amina Ngo Bell", "Jean-Paul Mbarga": capitalised words, no common words. */
  function isLikelyName(text) {
    const t = text.trim();
    if (!t || t.length > 60) return false;
    if (STOP.test(t)) return false;
    return /^[\p{Lu}][\p{L}'’.-]*(?:[\s-][\p{Lu}][\p{L}'’.-]*){0,4}$/u.test(t) && /\s/.test(t);
  }

  /** Text with something to translate once values are masked out. */
  function hasWords(text) {
    const { masked } = mask(text);
    const rest = masked.replace(/⟦\d+⟧/g, ' ');
    const letters = rest.match(/\p{L}/gu) || [];
    if (letters.length < 2) return false;
    // initials and language codes like "AN", "EN", "FR"
    if (/^\s*[A-Z]{1,3}\s*$/.test(rest)) return false;
    return true;
  }

  P.values = {
    findSpans, mask, unmask, values, sameValues, placeholders, placeholdersMatch,
    isLikelyName, hasWords, addUserValue, userValues, fixedNames,
  };
})();

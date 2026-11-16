/*
 * NkapTalk — reading the screen and acting on it, like a person would.
 * Finds buttons, fields and label/value rows by what the page says (French or English),
 * reads values exactly as displayed, and fills or clicks without changing the page's code.
 */
(function () {
  const P = (globalThis.NkapTalk = globalThis.NkapTalk || {});
  const T = () => P.translator;

  const BTN = {
    transfer: /^(effectuer un transfert|make a transfer|nouveau transfert|new transfer|faire un transfert|send money)$/i,
    fees: /^(consulter les frais|view fees|voir les frais|see fees)$/i,
    continue: /^(continuer|continue|suivant|next)$/i,
    back: /^(retour|back|précédent|previous)$/i,
    edit: /^(modifier|edit|change)$/i,
    confirm: /^(confirmer le transfert|confirm transfer|confirmer|confirm|valider|validate)$/i,
  };
  // Buttons that move money: NkapTalk always reads back and waits for "yes" before pressing.
  const MONEY_BUTTON = /(confirmer|confirm|valider|validate|payer|^pay|envoyer maintenant|send now|transférer maintenant|transfer now)/i;

  const LABELS = {
    balance: ['Solde disponible', 'Available balance'],
    amount: ['Montant', 'Amount', 'Montant à envoyer', 'Amount to send'],
    fee: ['Frais', 'Fee', 'Fees'],
    total: ['Total débité', 'Total debited', 'Total à débiter', 'Total to debit'],
    after: ['Solde après opération', 'Balance after transfer'],
    beneficiary: ['Bénéficiaire', 'Beneficiary'],
    phone: ['Téléphone', 'Phone'],
    reference: ['Référence', 'Reference'],
    operation: ['Opération', 'Operation'],
    status: ['Statut', 'Status'],
  };

  function visible(el) {
    if (!el || !el.isConnected) return false;
    if (el.closest('#nkaptalk-root')) return false;
    const r = el.getClientRects();
    if (!r.length) return false;
    const st = getComputedStyle(el);
    return st.visibility !== 'hidden' && st.display !== 'none';
  }

  const txt = (el) => T().origText(el);
  const norm = (s) => P.phrasebook.norm(s || '');

  function buttons() {
    return [...document.querySelectorAll('button, a[href], [role="button"], input[type="submit"], input[type="button"]')].filter(visible);
  }

  function findButton(key) {
    const re = BTN[key] || key;
    return buttons().find((b) => re.test(txt(b) || b.value || b.getAttribute('aria-label') || ''));
  }

  /** Label text for a form field. */
  function labelOf(input) {
    if (input.labels && input.labels.length) return txt(input.labels[0]);
    const aria = input.getAttribute('aria-label');
    if (aria) return aria;
    for (let e = input.parentElement, i = 0; e && i < 3; e = e.parentElement, i++) {
      const lab = [...e.children].find((c) => c.tagName === 'LABEL' && !c.contains(input));
      if (lab) return txt(lab);
    }
    const wrap = input.closest('label');
    if (wrap) return txt(wrap);
    return input.placeholder || input.name || '';
  }

  function fields() {
    return [...document.querySelectorAll('input, select, textarea')].filter((i) => visible(i) && i.type !== 'hidden');
  }

  function findField(kind) {
    const fs = fields();
    const by = (re) => fs.find((f) => re.test(labelOf(f)));
    switch (kind) {
      case 'type': return fs.find((f) => f.tagName === 'SELECT') || null;
      case 'amount': return fs.find((f) => f.type === 'number') || by(/montant|amount/i) || null;
      case 'name': return by(/nom|name/i) || null;
      case 'phone': return fs.find((f) => f.type === 'tel') || by(/téléphone|telephone|phone/i) || null;
      case 'reason': return by(/motif|reason|raison|purpose/i) || null;
      case 'note': return fs.find((f) => f.tagName === 'TEXTAREA') || by(/note/i) || null;
      case 'attest': return fs.find((f) => f.type === 'checkbox') || null;
      default: return null;
    }
  }

  function isSecret(f) {
    return f.type === 'password' || /pin|otp|password|mot de passe|code secret|cvv/i.test(`${f.name} ${f.id} ${f.autocomplete} ${labelOf(f)}`);
  }

  /** Sets a value the way a person typing would, so the page reacts normally. */
  function setValue(f, value) {
    if (isSecret(f)) throw new Error('NkapTalk never fills PIN, password or code fields.');
    const proto = f.tagName === 'SELECT' ? HTMLSelectElement.prototype : f.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    f.focus();
    setter.call(f, String(value));
    f.dispatchEvent(new Event('input', { bubbles: true }));
    f.dispatchEvent(new Event('change', { bubbles: true }));
    if (f.tagName !== 'SELECT' && f.type !== 'number') P.values.addUserValue(String(value));
  }

  function selectType(kind) {
    const sel = findField('type');
    if (!sel) return false;
    const opt = [...sel.options].find((o) => o.value === kind)
      || [...sel.options].find((o) => (kind === 'mobile_money' && /mobile|momo/i.test(o.text)) || (kind === 'other_bank' && /autre|other/i.test(o.text)) || (kind === 'safinum' && /safinum/i.test(o.text)));
    if (!opt) return false;
    setValue(sel, opt.value);
    return true;
  }

  function selectedTypeText(sel) {
    sel = sel || findField('type');
    if (!sel) return '';
    const o = sel.options[sel.selectedIndex];
    return o ? T().originalOf(o.firstChild || o) || o.text : '';
  }

  function check(box, value = true) {
    if (box && box.checked !== value) box.click();
  }

  function click(el) {
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el.click();
  }

  /** Label -> value rows as displayed: { fee: "100 FCFA", total: "5 100 FCFA", ... } */
  function readPairs() {
    const out = {};
    const els = [...document.querySelectorAll('p, span, dt, label, div, h3, h4, strong, th, td')].filter((e) => !e.closest('#nkaptalk-root'));
    const texts = els.map((e) => txt(e));
    // Pass 1: the label element says exactly the label ("Frais", "Total débité").
    // Pass 2: label plus a small word badge ("Frais Gratuit"), never a whole row with its value.
    for (const pass of [1, 2]) {
      els.forEach((el, i) => {
        const own = texts[i];
        if (!own || own.length > 40) return;
        for (const [key, labels] of Object.entries(LABELS)) {
          if (out[key]) continue;
          const n = norm(own);
          const hit = labels.some((l) => {
            const nl = norm(l);
            if (pass === 1) return n === nl;
            if (!n.startsWith(nl + ' ')) return false;
            const rest = n.slice(nl.length + 1);
            return !/\d/.test(rest) && rest.split(' ').length <= 2;
          });
          if (!hit || !visible(el)) continue;
          let sib = el.nextElementSibling;
          while (sib && !txt(sib)) sib = sib.nextElementSibling;
          if (!sib) continue;
          const val = txt(sib);
          if (!val || val.length > 60) continue;
          if (['balance', 'amount', 'fee', 'total', 'after'].includes(key) && !/FCFA|XAF|CFA|\d/.test(val)) continue;
          if (labels.some((l) => norm(val) === norm(l))) continue;
          out[key] = val;
          if (key === 'fee' && pass === 2) out.feeNote = own.replace(/^(frais|fees?)\s*/i, '');
        }
      });
    }
    return out;
  }

  /** The account number shown on the page, if any. */
  function readAccount() {
    const all = txt(document.body);
    const m = P.values.findSpans(all).find((s) => s.kind === 'ACCOUNT');
    return m ? m.value : null;
  }

  function readTransactions() {
    const rows = [];
    const dates = [...document.querySelectorAll('p, span, div')].filter((e) => visible(e) && !e.children.length && P.values.findSpans(txt(e)).some((s) => s.kind === 'DATE' && s.value === txt(e)));
    for (const d of dates.slice(0, 6)) {
      const title = d.previousElementSibling ? txt(d.previousElementSibling) : '';
      const row = d.parentElement && d.parentElement.parentElement ? d.parentElement.parentElement : null;
      const amountEl = row ? [...row.querySelectorAll('p, span')].find((e) => /FCFA/.test(txt(e)) && !e.children.length) : null;
      rows.push({ title, date: txt(d), amount: amountEl ? txt(amountEl) : '' });
    }
    return rows;
  }

  /** Visible error or security alert: { title, message, code } or null. */
  function readAlert() {
    const codeEl = [...document.querySelectorAll('p, span, div, small, code')].find((e) => visible(e) && !e.children.length && /^[A-Z]{2,}_\d{2,4}$/.test(txt(e)));
    const roleEl = [...document.querySelectorAll('[role="alert"], [aria-live="assertive"]')].find((e) => visible(e) && txt(e));
    let box = null;
    let code = null;
    if (codeEl) {
      code = txt(codeEl);
      box = codeEl.parentElement;
      while (box && txt(box).length < code.length + 15 && box.parentElement) box = box.parentElement;
    } else if (roleEl) box = roleEl;
    if (!box) return null;
    const leaves = [...box.querySelectorAll('*')].filter((e) => !e.children.length && txt(e) && txt(e) !== code).map(txt);
    const parts = leaves.length ? leaves : [txt(box)];
    return { title: parts[0] || '', message: parts.slice(1).join(' '), code, all: parts };
  }

  function detect() {
    const body = txt(document.body);
    if (/(Transfert effectué|Transfer completed)/i.test(body)) return 'receipt';
    if (findButton('confirm')) return 'summary';
    const phone = findField('phone');
    if (phone && findField('name')) return 'beneficiary';
    if (findField('type') && findField('amount')) return 'fees';
    if (findButton('transfer') && findButton('fees')) return 'dashboard';
    return 'unknown';
  }

  /** Main headings and paragraphs, in the page's words, for reading an unknown screen. */
  function mainTexts(limit = 8) {
    const els = [...document.querySelectorAll('h1, h2, h3, p, li, dt, dd, label')].filter((e) => visible(e) && txt(e) && e.children.length < 3);
    const seen = new Set();
    const out = [];
    for (const e of els) {
      const t = txt(e);
      if (seen.has(t) || t.length < 3) continue;
      seen.add(t);
      out.push(t);
      if (out.length >= limit) break;
    }
    return out;
  }

  function waitFor(pred, timeout = 2500) {
    return new Promise((resolve) => {
      const t0 = performance.now();
      const tick = () => {
        let v = null;
        try { v = pred(); } catch (e) {}
        if (v) return resolve(v);
        if (performance.now() - t0 > timeout) return resolve(null);
        setTimeout(tick, 80);
      };
      tick();
    });
  }

  P.screen = {
    BTN, MONEY_BUTTON, detect, findButton, findField, labelOf, setValue, selectType, selectedTypeText,
    check, click, readPairs, readAccount, readTransactions, readAlert, mainTexts, buttons, waitFor, visible, isSecret,
  };
})();

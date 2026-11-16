/*
 * NkapTalk — recorded native-speaker Pidgin voice.
 *
 * Chrome's English voice reads Pidgin spelling, which is only close enough. A real Pidgin
 * speaker reading the same words is better, and for amounts it removes the last bit of doubt
 * about what the customer heard. The clips sit on the computer, so this works offline.
 *
 * Clips are never a translation layer. Text reaching here has already been through
 * P.speech.toSpeech(), so every amount is words produced by code ("5 100 FCFA" -> "five
 * thousand, one hundred franc"). This file only chooses which recording says a word that is
 * already decided. It can change how a reply sounds, never what it says.
 *
 * The number vocabulary is closed (see NUMBERS), so 63 clips cover every amount, percentage,
 * phone number and reference. Reply sentences are not closed: the screen can carry text the
 * phrasebook does not know, and the jury injects new messages on purpose. So a sentence plays
 * from clips only if every one of its words is recorded, and otherwise goes to the browser
 * voice whole. Half a sentence in a real voice and half in a robot voice sounds worse than
 * either on its own, so the two are never mixed inside one sentence.
 */
(function () {
  const P = (globalThis.NkapTalk = globalThis.NkapTalk || {});

  // ---- Closed vocabulary: everything P.speech.toSpeech() can emit for a value.
  // Kept in step with speech.js by a property test (tests/test-clipvoice.js).
  const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const TENS = ['twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  const SCALES = ['hundred', 'thousand', 'million', 'billion'];
  const UNITS = ['franc', 'percent', 'point', 'minus', 'plus'];
  const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');

  const NUMBERS = [...ONES, ...TENS, ...SCALES, ...UNITS, ...LETTERS];

  function hash32(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(36);
  }

  /**
   * Filename-safe id for a piece of text. Stable: the recording script uses the same ids.
   * Long text keeps a readable head plus a hash of the whole string, so two different long
   * sentences can never share one file and play each other's recording.
   */
  function slug(text) {
    const clean = String(text)
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (clean.length <= 60) return clean;
    return clean.slice(0, 52).replace(/-+$/, '') + '-' + hash32(clean);
  }

  /** Spoken text -> comparable words. Punctuation carries no sound of its own. */
  function norm(text) {
    return String(text)
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9\s-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Words of a phrase. "twenty-one" is two recordings, so hyphens split. */
  function words(text) {
    return norm(text).split(/[\s-]+/).filter(Boolean);
  }

  /**
   * One spoken word -> the word whose clip says it.
   * speech.js reads phone numbers and references character by character ("plus 2 3 7",
   * "S A F , 2 0 2 6"), so a bare digit arrives here as "2". The browser voice says that
   * correctly on its own, but a clip is a file: it needs the name "two". Mapping here means
   * the same ten number recordings serve both amounts and digit-by-digit reading.
   */
  function clipWord(w) {
    return /^[0-9]$/.test(w) ? ONES[Number(w)] : w;
  }

  /** Split a reply into sentences, each of which is clip-played or spoken, never both. */
  function sentences(text) {
    return String(text)
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  /**
   * Tile a sentence with the longest recordings available.
   * `have` is a Set of slugs that exist. Returns an array of slugs, or null if any
   * word has no recording (then the caller speaks the sentence with the browser voice).
   */
  function plan(sentence, have, maxWords = 12) {
    const w = words(sentence).map(clipWord);
    if (!w.length) return null;
    const out = [];
    let i = 0;
    while (i < w.length) {
      let hit = null;
      for (let n = Math.min(maxWords, w.length - i); n >= 1; n--) {
        const s = slug(w.slice(i, i + n).join(' '));
        if (have.has(s)) { hit = { s, n }; break; }
      }
      if (!hit) return null; // one missing word disqualifies the sentence
      out.push(hit.s);
      i += hit.n;
    }
    return out;
  }

  /** How much of a reply the recordings can carry, per sentence. For the settings page. */
  function coverage(text, have) {
    const all = sentences(text);
    const done = all.filter((s) => plan(s, have));
    return { total: all.length, clips: done.length, ratio: all.length ? done.length / all.length : 0 };
  }

  P.clipvoice = { NUMBERS, ONES, TENS, SCALES, UNITS, LETTERS, slug, norm, words, clipWord, sentences, plan, coverage };

  // ---------- Playback (browser only; the logic above stays testable in Node) ----------
  if (typeof document === 'undefined') return;

  let index = null;          // { slug: "filename.webm" }
  let indexTried = false;
  let ctx = null;
  const buffers = new Map(); // slug -> AudioBuffer
  let playing = [];
  let gen = 0; // bumped by stop(), so an interrupted reply stops scheduling the rest

  const url = (p) =>
    (globalThis.chrome && chrome.runtime && chrome.runtime.getURL)
      ? chrome.runtime.getURL('audio/pcm/' + p)
      : 'audio/pcm/' + p;

  /** audio/pcm/index.json maps slug -> real filename, so no format guessing. */
  async function loadIndex() {
    if (indexTried) return index;
    indexTried = true;
    try {
      const res = await fetch(url('index.json'));
      if (res.ok) index = await res.json();
    } catch (e) { index = null; }
    return index;
  }

  async function have() {
    const idx = await loadIndex();
    return new Set(idx ? Object.keys(idx) : []);
  }

  async function buffer(s) {
    if (buffers.has(s)) return buffers.get(s);
    const file = index && index[s];
    if (!file) return null;
    try {
      const res = await fetch(url(file));
      if (!res.ok) throw new Error(res.status);
      ctx = ctx || new AudioContext();
      const buf = await ctx.decodeAudioData(await res.arrayBuffer());
      buffers.set(s, buf);
      return buf;
    } catch (e) {
      buffers.set(s, null); // don't retry a bad file every reply
      return null;
    }
  }

  function stop() {
    gen++;
    playing.forEach((s) => { try { s.stop(); } catch (e) {} });
    playing = [];
  }

  /**
   * Speak `spoken` (already value-to-words) with recordings where possible.
   * Returns the sentences it could NOT play, for the browser voice to say.
   * `rate` stretches playback the way the speaking-speed setting does.
   */
  async function speak(spoken, rate = 1) {
    const my = ++gen;
    const hv = await have();
    if (!hv.size) return [{ text: spoken, reason: 'no-clips' }];
    const missed = [];
    for (const sentence of sentences(spoken)) {
      if (my !== gen) return missed; // stop() was called: drop the rest of the reply
      const ids = plan(sentence, hv);
      if (!ids) { missed.push({ text: sentence, reason: 'not-recorded' }); continue; }
      const bufs = [];
      for (const id of ids) {
        const b = await buffer(id);
        if (!b) break;
        bufs.push(b);
      }
      if (bufs.length !== ids.length) { missed.push({ text: sentence, reason: 'load-failed' }); continue; }
      ctx = ctx || new AudioContext();
      if (ctx.state === 'suspended') { try { await ctx.resume(); } catch (e) {} }
      let at = ctx.currentTime + 0.03;
      const speed = Math.max(0.5, Math.min(2, rate));
      for (const b of bufs) {
        const src = ctx.createBufferSource();
        src.buffer = b;
        src.playbackRate.value = speed;
        src.connect(ctx.destination);
        src.start(at);
        playing.push(src);
        at += b.duration / speed;
      }
      const wait = (at - ctx.currentTime) * 1000;
      await new Promise((r) => setTimeout(r, Math.max(0, wait)));
    }
    if (my === gen) playing = [];
    return missed;
  }

  P.clipvoice.speak = speak;
  P.clipvoice.stop = stop;
  P.clipvoice.have = have;
  P.clipvoice.reload = () => { indexTried = false; index = null; buffers.clear(); };
})();

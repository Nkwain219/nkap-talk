const DEFAULTS = {
  apiKey: '', model: 'gemini-2.5-flash', ttsModel: 'gemini-2.5-flash-preview-tts',
  useGeminiNLU: true, useGeminiTranslate: true, useGeminiTTS: false,
  autoTranslate: true, rate: 0.95, voiceName: '', pageLanguage: 'pcm',
};
const LOC = globalThis.NkapTalk.localize;
const $ = (id) => document.getElementById(id);
const BOOLS = ['useGeminiNLU', 'useGeminiTranslate', 'useGeminiTTS', 'autoTranslate'];
const TEXTS = ['apiKey', 'model', 'ttsModel'];

function fillVoices(selected) {
  const sel = $('voiceName');
  const voices = speechSynthesis.getVoices().filter((v) => /^en/i.test(v.lang));
  sel.length = 1;
  voices.forEach((v) => {
    const o = new Option(`${v.name} (${v.lang})${v.localService ? ' · on this device' : ' · online'}`, v.name);
    sel.add(o);
  });
  sel.value = selected || '';
}

chrome.storage.sync.get(DEFAULTS, (s) => {
  TEXTS.forEach((k) => ($(k).value = s[k]));
  BOOLS.forEach((k) => ($(k).checked = !!s[k]));
  $('rate').value = s.rate;
  $('rateVal').textContent = s.rate;
  fillVoices(s.voiceName);
  fillLanguages(s.pageLanguage);
  showLanguage($('pageLanguage').value);
  speechSynthesis.onvoiceschanged = () => fillVoices(s.voiceName);
});

// ---- page language + native-speaker corrections (stored on this computer only)
let shownLang = 'pcm';

function fillLanguages(selected) {
  const sel = $('pageLanguage');
  sel.length = 0;
  for (const [code, l] of Object.entries(LOC.LANGUAGES)) {
    sel.add(new Option(code === 'pcm' ? 'Pidgin (built in, works offline)' : `${l.name} · ${l.where} (needs Gemini)`, code));
  }
  sel.value = selected in LOC.LANGUAGES ? selected : 'pcm';
}

function showLanguage(code) {
  shownLang = code;
  const local = code !== 'pcm';
  ['fixes', 'clearCache'].forEach((id) => ($(id).disabled = !local));
  $('fixesFor').textContent = local ? `(${LOC.LANGUAGES[code].name})` : '(choose a local language)';
  $('langNote').textContent = local
    ? `Gemini translates the page into ${LOC.LANGUAGES[code].name} with every amount, name, phone number and reference hidden first. Until a line is ready, or with no internet, the page shows Pidgin. Gemini's ${LOC.LANGUAGES[code].name} can be wrong: have native speakers check it and add corrections below.`
    : 'Pidgin comes from the reviewed phrasebook, plus Gemini for new text if you added a key.';
  $('fixErrors').textContent = '';
  const k = `fix:${code}`;
  chrome.storage.local.get({ [k]: '' }, (r) => { $('fixes').value = local ? r[k] : ''; });
}

$('pageLanguage').addEventListener('change', () => showLanguage($('pageLanguage').value));

$('clearCache').addEventListener('click', () => {
  chrome.storage.local.remove(`lt:${shownLang}`, () => {
    $('saved').textContent = 'Saved translations forgotten';
    setTimeout(() => ($('saved').textContent = ''), 2500);
  });
});

$('rate').addEventListener('input', () => ($('rateVal').textContent = $('rate').value));

$('save').addEventListener('click', () => {
  const s = {};
  TEXTS.forEach((k) => (s[k] = $(k).value.trim() || DEFAULTS[k]));
  if (!$('apiKey').value.trim()) s.apiKey = '';
  BOOLS.forEach((k) => (s[k] = $(k).checked));
  s.rate = Number($('rate').value);
  s.voiceName = $('voiceName').value;
  s.pageLanguage = $('pageLanguage').value;
  if (s.pageLanguage !== 'pcm') {
    const { errors } = LOC.parseFixes($('fixes').value);
    $('fixErrors').textContent = errors.length ? `Not saved: ${errors.join('; ')}` : '';
    if (errors.length) return;
    chrome.storage.local.set({ [`fix:${s.pageLanguage}`]: $('fixes').value });
  }
  chrome.storage.sync.set(s, () => {
    $('saved').textContent = 'Saved';
    setTimeout(() => ($('saved').textContent = ''), 2000);
  });
});

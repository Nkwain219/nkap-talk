const DEFAULTS = {
  apiKey: '', model: 'gemini-2.5-flash', ttsModel: 'gemini-2.5-flash-preview-tts',
  useGeminiNLU: true, useGeminiTranslate: true, useGeminiTTS: false,
  autoTranslate: true, rate: 0.95, voiceName: '',
};
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
  speechSynthesis.onvoiceschanged = () => fillVoices(s.voiceName);
});

$('rate').addEventListener('input', () => ($('rateVal').textContent = $('rate').value));

$('save').addEventListener('click', () => {
  const s = {};
  TEXTS.forEach((k) => (s[k] = $(k).value.trim() || DEFAULTS[k]));
  if (!$('apiKey').value.trim()) s.apiKey = '';
  BOOLS.forEach((k) => (s[k] = $(k).checked));
  s.rate = Number($('rate').value);
  s.voiceName = $('voiceName').value;
  chrome.storage.sync.set(s, () => {
    $('saved').textContent = 'Saved';
    setTimeout(() => ($('saved').textContent = ''), 2000);
  });
});

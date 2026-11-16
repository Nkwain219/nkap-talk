/* NkapTalk — start-up: translate the page, watch for new content, show the floating button. */
(function () {
  const P = globalThis.NkapTalk;
  if (!P || P.started) return;
  P.started = true;

  async function init() {
    await P.env.loadSettings();
    P.translator.start();
    if (P.env.settings.autoTranslate) P.translator.setOn(true);
    P.env.on('new-text', (r) => P.assistant.onNewText(r));
    P.env.on('translated-late', (r) => P.assistant.onLate(r));
    P.ui.mount();
    if (P.env.hasChrome) {
      chrome.runtime.onMessage.addListener((msg) => {
        if (msg && msg.type === 'toggle-panel') P.ui.toggle();
        if (msg && msg.type === 'toggle-translate') P.translator.setOn(!P.translator.on);
        if (msg && msg.type === 'talk') { if (!P.ui.open) P.ui.setOpen(true); P.ui.toggleMic(); }
      });
    }
  }

  if (document.body) init();
  else document.addEventListener('DOMContentLoaded', init, { once: true });
})();

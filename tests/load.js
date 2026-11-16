// Loads NkapTalk content scripts into a plain Node context (no DOM) for unit tests.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

module.exports = function load(files) {
  const ctx = { console, globalThis: null, setTimeout, clearTimeout };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of files) {
    const code = fs.readFileSync(path.join(__dirname, '..', 'nkaptalk-extension', 'content', f), 'utf8');
    vm.runInContext(code, ctx, { filename: f });
  }
  return ctx.NkapTalk;
};

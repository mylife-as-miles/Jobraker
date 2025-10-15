// JS runtime mirror of prismjs.ts for environments attempting to require('prismjs/...') before TS transpile.
const Prism = {
  languages: { plaintext: {}, css: {}, javascript: {}, typescript: {}, json: {} },
  highlight(code) { return code; },
  util: { clone(o){ try { return JSON.parse(JSON.stringify(o)); } catch { return o; } } },
  plugins: {},
};
module.exports = Prism;
module.exports.Prism = Prism;
module.exports.default = Prism;

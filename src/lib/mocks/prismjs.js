const Prism = {
  languages: {
    plaintext: {},
    css: {},
    javascript: {},
    typescript: {},
    json: {},
  },
  highlight(code) {
    return code;
  },
  util: {
    clone(value) {
      try {
        return JSON.parse(JSON.stringify(value));
      } catch {
        return value;
      }
    },
  },
  plugins: {},
};

if (typeof globalThis === "object" && globalThis && !globalThis.Prism) {
  globalThis.Prism = Prism;
}

export default Prism;
export { Prism };

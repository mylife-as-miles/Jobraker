// Minimal Prism mock (JS compatible) to satisfy refractor / prismjs consumer expectations in build.
// Avoid TypeScript-only constructs so Node can evaluate it if needed pre-transpile.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Prism: any = {
  languages: { plaintext: {}, css: {}, javascript: {}, typescript: {}, json: {} },
  highlight(code: string) {
    return code; // no-op highlight
  },
  util: { clone: (o: any) => JSON.parse(JSON.stringify(o)) },
  plugins: {},
};

// Provide a fake default export and named export (some libs import * as Prism)
export default Prism;
export { Prism };

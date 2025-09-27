// Minimal Prism mock to satisfy refractor / prismjs consumer expectations in build.
// Refractor tries to require('prismjs/components/prism-core') and individual language files.
// By aliasing 'prismjs' to this file we provide just enough surface so that downstream code
// using highlight(...) does not explode during SSR / build on Vercel.

interface PrismLike {
  languages: Record<string, any>;
  highlight: (code: string, grammar?: any, lang?: string) => string;
  util: { clone: (o: any) => any };
  plugins?: Record<string, any>;
}

const Prism: PrismLike = {
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

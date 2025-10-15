# PrismJS / Refractor Mock Strategy

Vercel build previously failed with:

```
Could not load .../src/lib/mocks/prismjs.ts/components/prism-core: ENOTDIR
```

Cause: The alias `prismjs -> prismjs.ts` made CommonJS dynamic requires inside `refractor` like:

```js
require('prismjs/components/prism-core');
```
resolve to a path that appended `/components/prism-core` onto the *file* `prismjs.ts`, producing a non-directory path.

## Fix

1. Provide a directory alias for the subpath first: `prismjs/components -> src/lib/mocks/prismjs-components`.
2. Replace the bare import only using a terminal match: `prismjs$ -> src/lib/mocks/prismjs.ts`.

Ordering matters: the more specific `prismjs/components` must appear before the terminal alias.

## Files

- `prismjs.ts` / `prismjs.js`: Lightweight mock exporting minimal API used by `refractor` consumer code.
- `prismjs-components/` : Contains `prism-core.js` and an `index.js` re-export to satisfy dynamic requires.

Add additional component shims (e.g. `prism-javascript.js`) if future dynamic imports are added.

## Extending
If you later need real highlighting locally but still want fast builds in prod, you can:

- Detect env (`process.env.VERCEL`) and conditionally export the real library vs mock.
- Or swap the alias only in `defineConfig` based on `mode`.


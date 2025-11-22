import react from "@vitejs/plugin-react";
import tailwind from "tailwindcss";
import { defineConfig } from "vite";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Use absolute base so assets resolve from root on deep routes (Vercel)
  base: "/",
  // For production builds (like Vercel), explicitly define the env vars
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(process.env.VITE_SUPABASE_URL),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY),
    appVersion: JSON.stringify(process.env.VERCEL_GIT_COMMIT_SHA?.slice(0,7) || process.env.npm_package_version || 'dev'),
  },
  // Vite automatically loads VITE_ prefixed variables from .env files for development
  envPrefix: ['VITE_'],
  css: {
    postcss: {
      plugins: [tailwind()],
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@reactive-resume/schema": path.resolve(__dirname, "src/lib/reactive-resume-schema.ts"),
      "@reactive-resume/utils": path.resolve(__dirname, "src/lib/reactive-resume-utils.ts"),
      "@reactive-resume/hooks": path.resolve(__dirname, "src/lib/reactive-resume-hooks.ts"),
      "@reactive-resume/ui": path.resolve(__dirname, "src/lib/reactive-resume-ui.tsx"),
      "@reactive-resume/dto": path.resolve(__dirname, "src/lib/reactive-resume-dto.ts"),
      "@reactive-resume/parser": path.resolve(__dirname, "src/lib/reactive-resume-parser.ts"),
      "@lingui/macro": path.resolve(__dirname, "src/lib/mocks/lingui-macro.ts"),
      "@lingui/core": path.resolve(__dirname, "src/lib/mocks/lingui-core.ts"),
      "@lingui/react": path.resolve(__dirname, "src/lib/mocks/lingui-react.tsx"),
      "@lingui/detect-locale": path.resolve(__dirname, "src/lib/mocks/lingui-detect-locale.ts"),
      "qrcode.react": path.resolve(__dirname, "src/lib/mocks/qrcode-react.tsx"),
      "@radix-ui/react-visually-hidden": path.resolve(__dirname, "src/lib/mocks/radix-visually-hidden.tsx"),
      "@radix-ui/react-label": path.resolve(__dirname, "src/lib/mocks/radix-label.tsx"),
      "@radix-ui/react-select": path.resolve(__dirname, "src/lib/mocks/radix-select.tsx"),
      "@radix-ui/react-checkbox": path.resolve(__dirname, "src/lib/mocks/radix-checkbox.tsx"),
      "@radix-ui/react-switch": path.resolve(__dirname, "src/lib/mocks/radix-switch.tsx"),
      "@radix-ui/react-separator": path.resolve(__dirname, "src/lib/mocks/radix-separator.tsx"),
      "@sindresorhus/slugify": path.resolve(__dirname, "src/lib/mocks/slugify.ts"),
      "react-parallax-tilt": path.resolve(__dirname, "src/lib/mocks/react-parallax-tilt.tsx"),
      // Refractor performs dynamic requires like 'prismjs/components/prism-core'. If we alias 'prismjs' directly
      // to a file, Vite's commonjs resolver was expanding that to '<mock-file>/components/prism-core' (ENOTDIR).
      // Solution: provide a directory alias for the components subpath first, and use a regex-style terminal match
      // ('prismjs$') for the core mock so that only bare 'prismjs' is replaced.
      "prismjs/components": path.resolve(__dirname, "src/lib/mocks/prismjs-components"),
      "prismjs$": path.resolve(__dirname, "src/lib/mocks/prismjs.ts"),
      "react-colorful": path.resolve(__dirname, "src/lib/mocks/react-colorful.tsx"),
      "react-simple-code-editor": path.resolve(__dirname, "src/lib/mocks/react-simple-code-editor.tsx"),
      "openai": path.resolve(__dirname, "src/lib/mocks/openai.ts"),
      "@dnd-kit/core": path.resolve(__dirname, "src/lib/mocks/dnd-kit-core.tsx"),
      "@dnd-kit/sortable": path.resolve(__dirname, "src/lib/mocks/dnd-kit-sortable.tsx"),
      "@dnd-kit/utilities": path.resolve(__dirname, "src/lib/mocks/dnd-kit-utilities.ts"),
      "@dnd-kit/modifiers": path.resolve(__dirname, "src/lib/mocks/dnd-kit-modifiers.ts"),
      "file-saver": path.resolve(__dirname, "src/lib/mocks/file-saver.ts"),
    },
  },
});

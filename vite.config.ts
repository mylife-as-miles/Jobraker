import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
  // Use absolute base so assets resolve from root on deep routes (Vercel)
  base: "/",
  define: {
    appVersion: JSON.stringify(
      process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
        process.env.npm_package_version ||
        "dev",
    ),
  },
  // Vite automatically loads VITE_ prefixed variables from .env files for development
  envPrefix: ["VITE_"],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@reactive-resume/schema": path.resolve(
        __dirname,
        "src/lib/reactive-resume-schema.ts",
      ),
      "@reactive-resume/utils": path.resolve(
        __dirname,
        "src/lib/reactive-resume-utils.ts",
      ),
      "@reactive-resume/hooks": path.resolve(
        __dirname,
        "src/lib/reactive-resume-hooks.ts",
      ),
      "@reactive-resume/ui": path.resolve(
        __dirname,
        "src/lib/reactive-resume-ui.tsx",
      ),
      "@reactive-resume/dto": path.resolve(
        __dirname,
        "src/lib/reactive-resume-dto.ts",
      ),
      "@reactive-resume/parser": path.resolve(
        __dirname,
        "src/lib/reactive-resume-parser.ts",
      ),
      "@lingui/macro": path.resolve(__dirname, "src/lib/mocks/lingui-macro.ts"),
      "@lingui/core": path.resolve(__dirname, "src/lib/mocks/lingui-core.ts"),
      "@lingui/react": path.resolve(
        __dirname,
        "src/lib/mocks/lingui-react.tsx",
      ),
      "@lingui/detect-locale": path.resolve(
        __dirname,
        "src/lib/mocks/lingui-detect-locale.ts",
      ),
      "qrcode.react": path.resolve(__dirname, "src/lib/mocks/qrcode-react.tsx"),
      "@radix-ui/react-visually-hidden": path.resolve(
        __dirname,
        "src/lib/mocks/radix-visually-hidden.tsx",
      ),
      "@radix-ui/react-label": path.resolve(
        __dirname,
        "src/lib/mocks/radix-label.tsx",
      ),
      "@radix-ui/react-select": path.resolve(
        __dirname,
        "src/lib/mocks/radix-select.tsx",
      ),
      "@radix-ui/react-checkbox": path.resolve(
        __dirname,
        "src/lib/mocks/radix-checkbox.tsx",
      ),
      "@radix-ui/react-switch": path.resolve(
        __dirname,
        "src/lib/mocks/radix-switch.tsx",
      ),
      "@radix-ui/react-separator": path.resolve(
        __dirname,
        "src/lib/mocks/radix-separator.tsx",
      ),
      "@sindresorhus/slugify": path.resolve(
        __dirname,
        "src/lib/mocks/slugify.ts",
      ),
      "react-parallax-tilt": path.resolve(
        __dirname,
        "src/lib/mocks/react-parallax-tilt.tsx",
      ),
      // Refractor performs dynamic requires like 'prismjs/components/prism-core'. If we alias 'prismjs' directly
      // to a file, Vite's commonjs resolver was expanding that to '<mock-file>/components/prism-core' (ENOTDIR).
      // Solution: provide a directory alias for the components subpath first, and use a regex-style terminal match
      // ('prismjs$') for the core mock so that only bare 'prismjs' is replaced.
      "prismjs/components": path.resolve(
        __dirname,
        "src/lib/mocks/prismjs-components",
      ),
      prismjs$: path.resolve(__dirname, "src/lib/mocks/prismjs.ts"),
      "react-colorful": path.resolve(
        __dirname,
        "src/lib/mocks/react-colorful.tsx",
      ),
      "react-simple-code-editor": path.resolve(
        __dirname,
        "src/lib/mocks/react-simple-code-editor.tsx",
      ),
      openai: path.resolve(__dirname, "src/lib/mocks/openai.ts"),
      "@dnd-kit/core": path.resolve(
        __dirname,
        "src/lib/mocks/dnd-kit-core.tsx",
      ),
      "@dnd-kit/sortable": path.resolve(
        __dirname,
        "src/lib/mocks/dnd-kit-sortable.tsx",
      ),
      "@dnd-kit/utilities": path.resolve(
        __dirname,
        "src/lib/mocks/dnd-kit-utilities.ts",
      ),
      "@dnd-kit/modifiers": path.resolve(
        __dirname,
        "src/lib/mocks/dnd-kit-modifiers.ts",
      ),
      "file-saver": path.resolve(__dirname, "src/lib/mocks/file-saver.ts"),
    },
  },
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Rollup's CommonJS interop helpers (getDefaultExportFromCjs et al.)
          // live in a virtual module that contains no "node_modules" segment, so
          // it used to fall through this function unassigned. Rollup then placed
          // it in whichever vendor chunk claimed it first -- vendor-charts -- and
          // every other chunk, vendor-react included, imported it back out of
          // there. That single edge produced a
          // vendor-react -> vendor-charts -> vendor-ui -> vendor-react cycle, and
          // inside a cycle vendor-ui's module body ran before vendor-react had
          // initialised its React export, so lucide-react's top-level
          // `React.forwardRef(...)` threw "Cannot read properties of undefined".
          // The helper module has no imports of its own, so giving it a dedicated
          // leaf chunk makes the cycle structurally impossible.
          if (id.includes("commonjsHelpers") || id.includes("commonjs-dynamic-modules")) {
            return "vendor-cjs-helpers";
          }
          if (id.includes("node_modules")) {
            if (
              id.includes("three") ||
              id.includes("@react-three") ||
              id.includes("three-stdlib")
            ) {
              return "vendor-three";
            }
            if (
              id.includes("recharts") ||
              id.includes("d3-") ||
              id.includes("victory-vendor")
            ) {
              return "vendor-charts";
            }
            if (
              id.includes("jspdf") ||
              id.includes("docx") ||
              id.includes("jszip") ||
              id.includes("pdfjs-dist")
            ) {
              return "vendor-pdf";
            }
            if (
              id.includes("framer-motion") ||
              id.includes("gsap") ||
              id.includes("animejs") ||
              id.includes("lenis")
            ) {
              return "vendor-motion";
            }
            if (
              id.includes("@supabase/") ||
              id.includes("@supabase/supabase-js") ||
              id.includes("@supabase/auth-ui-react")
            ) {
              return "vendor-supabase";
            }
            if (
              id.includes("@tanstack/react-query") ||
              id.includes("@tanstack/react-table") ||
              id.includes("jotai") ||
              id.includes("immer")
            ) {
              return "vendor-data";
            }
            if (
              id.includes("@sentry/") ||
              id.includes("posthog-js")
            ) {
              return "vendor-observability";
            }
            if (
              id.includes("@radix-ui/") ||
              id.includes("lucide-react") ||
              id.includes("class-variance-authority") ||
              id.includes("clsx") ||
              id.includes("tailwind-merge")
            ) {
              return "vendor-ui";
            }
            if (
              id.includes("/react/") ||
              id.includes("/react-dom/") ||
              id.includes("/react-router/") ||
              id.includes("/react-router-dom/") ||
              id.includes("/scheduler/") ||
              id.endsWith("/react/index.js") ||
              id.endsWith("/react-dom/index.js")
            ) {
              return "vendor-react";
            }
          }
        },
      },
    },
  },
  server: {
    host: "127.0.0.1", // force IPv4
    port: 3000, // use your usual dev port
    strictPort: true, // fail if the port is already in use
  },
});

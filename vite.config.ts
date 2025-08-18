import react from "@vitejs/plugin-react";
import tailwind from "tailwindcss";
import { defineConfig } from "vite";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/",
  define: {
    // Inject a global appVersion for client usage (e.g., in footer)
    appVersion: JSON.stringify(process.env.npm_package_version || "0.0.0"),
  },
  css: {
    postcss: {
      plugins: [tailwind()],
    },
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
  "@sindresorhus/slugify": path.resolve(__dirname, "src/lib/mocks/slugify.ts"),
  "react-parallax-tilt": path.resolve(__dirname, "src/lib/mocks/react-parallax-tilt.tsx"),
  "openai": path.resolve(__dirname, "src/lib/mocks/openai.ts"),
    },
  },
});

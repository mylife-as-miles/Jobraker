import react from "@vitejs/plugin-react";
import { defineConfig, searchForWorkspaceRoot } from "vite";

export default defineConfig({
  base: "/artboard/",

  cacheDir: "../../node_modules/.vite/artboard",

  build: {
    sourcemap: true,
    emptyOutDir: true,
  },

  server: {
    host: true,
    port: 6173,
    fs: { allow: [searchForWorkspaceRoot(process.cwd())] },
  },

  plugins: [react()],

  resolve: {
    alias: {
  "@/artboard/": `${searchForWorkspaceRoot(process.cwd())}/src/resume-builder/artboard/src/`,
    },
  },
});

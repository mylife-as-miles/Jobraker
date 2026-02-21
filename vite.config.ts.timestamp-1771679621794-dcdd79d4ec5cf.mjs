// vite.config.ts
import react from "file:///C:/Users/Onyedika/Desktop/Jobraker-fixes/node_modules/@vitejs/plugin-react/dist/index.mjs";
import tailwind from "file:///C:/Users/Onyedika/Desktop/Jobraker-fixes/node_modules/tailwindcss/lib/index.js";
import { defineConfig } from "file:///C:/Users/Onyedika/Desktop/Jobraker-fixes/node_modules/vite/dist/node/index.js";
import path from "path";
var __vite_injected_original_dirname = "C:\\Users\\Onyedika\\Desktop\\Jobraker-fixes";
var vite_config_default = defineConfig({
  plugins: [react()],
  // Use absolute base so assets resolve from root on deep routes (Vercel)
  base: "/",
  define: {
    appVersion: JSON.stringify(
      process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || process.env.npm_package_version || "dev"
    )
  },
  // Vite automatically loads VITE_ prefixed variables from .env files for development
  envPrefix: ["VITE_"],
  css: {
    postcss: {
      plugins: [tailwind()]
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src"),
      "@reactive-resume/schema": path.resolve(
        __vite_injected_original_dirname,
        "src/lib/reactive-resume-schema.ts"
      ),
      "@reactive-resume/utils": path.resolve(
        __vite_injected_original_dirname,
        "src/lib/reactive-resume-utils.ts"
      ),
      "@reactive-resume/hooks": path.resolve(
        __vite_injected_original_dirname,
        "src/lib/reactive-resume-hooks.ts"
      ),
      "@reactive-resume/ui": path.resolve(
        __vite_injected_original_dirname,
        "src/lib/reactive-resume-ui.tsx"
      ),
      "@reactive-resume/dto": path.resolve(
        __vite_injected_original_dirname,
        "src/lib/reactive-resume-dto.ts"
      ),
      "@reactive-resume/parser": path.resolve(
        __vite_injected_original_dirname,
        "src/lib/reactive-resume-parser.ts"
      ),
      "@lingui/macro": path.resolve(__vite_injected_original_dirname, "src/lib/mocks/lingui-macro.ts"),
      "@lingui/core": path.resolve(__vite_injected_original_dirname, "src/lib/mocks/lingui-core.ts"),
      "@lingui/react": path.resolve(
        __vite_injected_original_dirname,
        "src/lib/mocks/lingui-react.tsx"
      ),
      "@lingui/detect-locale": path.resolve(
        __vite_injected_original_dirname,
        "src/lib/mocks/lingui-detect-locale.ts"
      ),
      "qrcode.react": path.resolve(__vite_injected_original_dirname, "src/lib/mocks/qrcode-react.tsx"),
      "@radix-ui/react-visually-hidden": path.resolve(
        __vite_injected_original_dirname,
        "src/lib/mocks/radix-visually-hidden.tsx"
      ),
      "@radix-ui/react-label": path.resolve(
        __vite_injected_original_dirname,
        "src/lib/mocks/radix-label.tsx"
      ),
      "@radix-ui/react-select": path.resolve(
        __vite_injected_original_dirname,
        "src/lib/mocks/radix-select.tsx"
      ),
      "@radix-ui/react-checkbox": path.resolve(
        __vite_injected_original_dirname,
        "src/lib/mocks/radix-checkbox.tsx"
      ),
      "@radix-ui/react-switch": path.resolve(
        __vite_injected_original_dirname,
        "src/lib/mocks/radix-switch.tsx"
      ),
      "@radix-ui/react-separator": path.resolve(
        __vite_injected_original_dirname,
        "src/lib/mocks/radix-separator.tsx"
      ),
      "@sindresorhus/slugify": path.resolve(
        __vite_injected_original_dirname,
        "src/lib/mocks/slugify.ts"
      ),
      "react-parallax-tilt": path.resolve(
        __vite_injected_original_dirname,
        "src/lib/mocks/react-parallax-tilt.tsx"
      ),
      // Refractor performs dynamic requires like 'prismjs/components/prism-core'. If we alias 'prismjs' directly
      // to a file, Vite's commonjs resolver was expanding that to '<mock-file>/components/prism-core' (ENOTDIR).
      // Solution: provide a directory alias for the components subpath first, and use a regex-style terminal match
      // ('prismjs$') for the core mock so that only bare 'prismjs' is replaced.
      "prismjs/components": path.resolve(
        __vite_injected_original_dirname,
        "src/lib/mocks/prismjs-components"
      ),
      prismjs$: path.resolve(__vite_injected_original_dirname, "src/lib/mocks/prismjs.ts"),
      "react-colorful": path.resolve(
        __vite_injected_original_dirname,
        "src/lib/mocks/react-colorful.tsx"
      ),
      "react-simple-code-editor": path.resolve(
        __vite_injected_original_dirname,
        "src/lib/mocks/react-simple-code-editor.tsx"
      ),
      openai: path.resolve(__vite_injected_original_dirname, "src/lib/mocks/openai.ts"),
      "@dnd-kit/core": path.resolve(
        __vite_injected_original_dirname,
        "src/lib/mocks/dnd-kit-core.tsx"
      ),
      "@dnd-kit/sortable": path.resolve(
        __vite_injected_original_dirname,
        "src/lib/mocks/dnd-kit-sortable.tsx"
      ),
      "@dnd-kit/utilities": path.resolve(
        __vite_injected_original_dirname,
        "src/lib/mocks/dnd-kit-utilities.ts"
      ),
      "@dnd-kit/modifiers": path.resolve(
        __vite_injected_original_dirname,
        "src/lib/mocks/dnd-kit-modifiers.ts"
      ),
      "file-saver": path.resolve(__vite_injected_original_dirname, "src/lib/mocks/file-saver.ts")
    }
  },
  server: {
    host: "127.0.0.1",
    // force IPv4
    port: 3e3,
    // use your usual dev port
    strictPort: true
    // fail if the port is already in use
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxPbnllZGlrYVxcXFxEZXNrdG9wXFxcXEpvYnJha2VyLWZpeGVzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxPbnllZGlrYVxcXFxEZXNrdG9wXFxcXEpvYnJha2VyLWZpeGVzXFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9PbnllZGlrYS9EZXNrdG9wL0pvYnJha2VyLWZpeGVzL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdFwiO1xuaW1wb3J0IHRhaWx3aW5kIGZyb20gXCJ0YWlsd2luZGNzc1wiO1xuaW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVcIjtcbmltcG9ydCBwYXRoIGZyb20gXCJwYXRoXCI7XG5cbi8vIGh0dHBzOi8vdml0ZS5kZXYvY29uZmlnL1xuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgcGx1Z2luczogW3JlYWN0KCldLFxuICAvLyBVc2UgYWJzb2x1dGUgYmFzZSBzbyBhc3NldHMgcmVzb2x2ZSBmcm9tIHJvb3Qgb24gZGVlcCByb3V0ZXMgKFZlcmNlbClcbiAgYmFzZTogXCIvXCIsXG4gIGRlZmluZToge1xuICAgIGFwcFZlcnNpb246IEpTT04uc3RyaW5naWZ5KFxuICAgICAgcHJvY2Vzcy5lbnYuVkVSQ0VMX0dJVF9DT01NSVRfU0hBPy5zbGljZSgwLCA3KSB8fFxuICAgICAgICBwcm9jZXNzLmVudi5ucG1fcGFja2FnZV92ZXJzaW9uIHx8XG4gICAgICAgIFwiZGV2XCIsXG4gICAgKSxcbiAgfSxcbiAgLy8gVml0ZSBhdXRvbWF0aWNhbGx5IGxvYWRzIFZJVEVfIHByZWZpeGVkIHZhcmlhYmxlcyBmcm9tIC5lbnYgZmlsZXMgZm9yIGRldmVsb3BtZW50XG4gIGVudlByZWZpeDogW1wiVklURV9cIl0sXG4gIGNzczoge1xuICAgIHBvc3Rjc3M6IHtcbiAgICAgIHBsdWdpbnM6IFt0YWlsd2luZCgpXSxcbiAgICB9LFxuICB9LFxuICByZXNvbHZlOiB7XG4gICAgYWxpYXM6IHtcbiAgICAgIFwiQFwiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4vc3JjXCIpLFxuICAgICAgXCJAcmVhY3RpdmUtcmVzdW1lL3NjaGVtYVwiOiBwYXRoLnJlc29sdmUoXG4gICAgICAgIF9fZGlybmFtZSxcbiAgICAgICAgXCJzcmMvbGliL3JlYWN0aXZlLXJlc3VtZS1zY2hlbWEudHNcIixcbiAgICAgICksXG4gICAgICBcIkByZWFjdGl2ZS1yZXN1bWUvdXRpbHNcIjogcGF0aC5yZXNvbHZlKFxuICAgICAgICBfX2Rpcm5hbWUsXG4gICAgICAgIFwic3JjL2xpYi9yZWFjdGl2ZS1yZXN1bWUtdXRpbHMudHNcIixcbiAgICAgICksXG4gICAgICBcIkByZWFjdGl2ZS1yZXN1bWUvaG9va3NcIjogcGF0aC5yZXNvbHZlKFxuICAgICAgICBfX2Rpcm5hbWUsXG4gICAgICAgIFwic3JjL2xpYi9yZWFjdGl2ZS1yZXN1bWUtaG9va3MudHNcIixcbiAgICAgICksXG4gICAgICBcIkByZWFjdGl2ZS1yZXN1bWUvdWlcIjogcGF0aC5yZXNvbHZlKFxuICAgICAgICBfX2Rpcm5hbWUsXG4gICAgICAgIFwic3JjL2xpYi9yZWFjdGl2ZS1yZXN1bWUtdWkudHN4XCIsXG4gICAgICApLFxuICAgICAgXCJAcmVhY3RpdmUtcmVzdW1lL2R0b1wiOiBwYXRoLnJlc29sdmUoXG4gICAgICAgIF9fZGlybmFtZSxcbiAgICAgICAgXCJzcmMvbGliL3JlYWN0aXZlLXJlc3VtZS1kdG8udHNcIixcbiAgICAgICksXG4gICAgICBcIkByZWFjdGl2ZS1yZXN1bWUvcGFyc2VyXCI6IHBhdGgucmVzb2x2ZShcbiAgICAgICAgX19kaXJuYW1lLFxuICAgICAgICBcInNyYy9saWIvcmVhY3RpdmUtcmVzdW1lLXBhcnNlci50c1wiLFxuICAgICAgKSxcbiAgICAgIFwiQGxpbmd1aS9tYWNyb1wiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcInNyYy9saWIvbW9ja3MvbGluZ3VpLW1hY3JvLnRzXCIpLFxuICAgICAgXCJAbGluZ3VpL2NvcmVcIjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCJzcmMvbGliL21vY2tzL2xpbmd1aS1jb3JlLnRzXCIpLFxuICAgICAgXCJAbGluZ3VpL3JlYWN0XCI6IHBhdGgucmVzb2x2ZShcbiAgICAgICAgX19kaXJuYW1lLFxuICAgICAgICBcInNyYy9saWIvbW9ja3MvbGluZ3VpLXJlYWN0LnRzeFwiLFxuICAgICAgKSxcbiAgICAgIFwiQGxpbmd1aS9kZXRlY3QtbG9jYWxlXCI6IHBhdGgucmVzb2x2ZShcbiAgICAgICAgX19kaXJuYW1lLFxuICAgICAgICBcInNyYy9saWIvbW9ja3MvbGluZ3VpLWRldGVjdC1sb2NhbGUudHNcIixcbiAgICAgICksXG4gICAgICBcInFyY29kZS5yZWFjdFwiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcInNyYy9saWIvbW9ja3MvcXJjb2RlLXJlYWN0LnRzeFwiKSxcbiAgICAgIFwiQHJhZGl4LXVpL3JlYWN0LXZpc3VhbGx5LWhpZGRlblwiOiBwYXRoLnJlc29sdmUoXG4gICAgICAgIF9fZGlybmFtZSxcbiAgICAgICAgXCJzcmMvbGliL21vY2tzL3JhZGl4LXZpc3VhbGx5LWhpZGRlbi50c3hcIixcbiAgICAgICksXG4gICAgICBcIkByYWRpeC11aS9yZWFjdC1sYWJlbFwiOiBwYXRoLnJlc29sdmUoXG4gICAgICAgIF9fZGlybmFtZSxcbiAgICAgICAgXCJzcmMvbGliL21vY2tzL3JhZGl4LWxhYmVsLnRzeFwiLFxuICAgICAgKSxcbiAgICAgIFwiQHJhZGl4LXVpL3JlYWN0LXNlbGVjdFwiOiBwYXRoLnJlc29sdmUoXG4gICAgICAgIF9fZGlybmFtZSxcbiAgICAgICAgXCJzcmMvbGliL21vY2tzL3JhZGl4LXNlbGVjdC50c3hcIixcbiAgICAgICksXG4gICAgICBcIkByYWRpeC11aS9yZWFjdC1jaGVja2JveFwiOiBwYXRoLnJlc29sdmUoXG4gICAgICAgIF9fZGlybmFtZSxcbiAgICAgICAgXCJzcmMvbGliL21vY2tzL3JhZGl4LWNoZWNrYm94LnRzeFwiLFxuICAgICAgKSxcbiAgICAgIFwiQHJhZGl4LXVpL3JlYWN0LXN3aXRjaFwiOiBwYXRoLnJlc29sdmUoXG4gICAgICAgIF9fZGlybmFtZSxcbiAgICAgICAgXCJzcmMvbGliL21vY2tzL3JhZGl4LXN3aXRjaC50c3hcIixcbiAgICAgICksXG4gICAgICBcIkByYWRpeC11aS9yZWFjdC1zZXBhcmF0b3JcIjogcGF0aC5yZXNvbHZlKFxuICAgICAgICBfX2Rpcm5hbWUsXG4gICAgICAgIFwic3JjL2xpYi9tb2Nrcy9yYWRpeC1zZXBhcmF0b3IudHN4XCIsXG4gICAgICApLFxuICAgICAgXCJAc2luZHJlc29yaHVzL3NsdWdpZnlcIjogcGF0aC5yZXNvbHZlKFxuICAgICAgICBfX2Rpcm5hbWUsXG4gICAgICAgIFwic3JjL2xpYi9tb2Nrcy9zbHVnaWZ5LnRzXCIsXG4gICAgICApLFxuICAgICAgXCJyZWFjdC1wYXJhbGxheC10aWx0XCI6IHBhdGgucmVzb2x2ZShcbiAgICAgICAgX19kaXJuYW1lLFxuICAgICAgICBcInNyYy9saWIvbW9ja3MvcmVhY3QtcGFyYWxsYXgtdGlsdC50c3hcIixcbiAgICAgICksXG4gICAgICAvLyBSZWZyYWN0b3IgcGVyZm9ybXMgZHluYW1pYyByZXF1aXJlcyBsaWtlICdwcmlzbWpzL2NvbXBvbmVudHMvcHJpc20tY29yZScuIElmIHdlIGFsaWFzICdwcmlzbWpzJyBkaXJlY3RseVxuICAgICAgLy8gdG8gYSBmaWxlLCBWaXRlJ3MgY29tbW9uanMgcmVzb2x2ZXIgd2FzIGV4cGFuZGluZyB0aGF0IHRvICc8bW9jay1maWxlPi9jb21wb25lbnRzL3ByaXNtLWNvcmUnIChFTk9URElSKS5cbiAgICAgIC8vIFNvbHV0aW9uOiBwcm92aWRlIGEgZGlyZWN0b3J5IGFsaWFzIGZvciB0aGUgY29tcG9uZW50cyBzdWJwYXRoIGZpcnN0LCBhbmQgdXNlIGEgcmVnZXgtc3R5bGUgdGVybWluYWwgbWF0Y2hcbiAgICAgIC8vICgncHJpc21qcyQnKSBmb3IgdGhlIGNvcmUgbW9jayBzbyB0aGF0IG9ubHkgYmFyZSAncHJpc21qcycgaXMgcmVwbGFjZWQuXG4gICAgICBcInByaXNtanMvY29tcG9uZW50c1wiOiBwYXRoLnJlc29sdmUoXG4gICAgICAgIF9fZGlybmFtZSxcbiAgICAgICAgXCJzcmMvbGliL21vY2tzL3ByaXNtanMtY29tcG9uZW50c1wiLFxuICAgICAgKSxcbiAgICAgIHByaXNtanMkOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcInNyYy9saWIvbW9ja3MvcHJpc21qcy50c1wiKSxcbiAgICAgIFwicmVhY3QtY29sb3JmdWxcIjogcGF0aC5yZXNvbHZlKFxuICAgICAgICBfX2Rpcm5hbWUsXG4gICAgICAgIFwic3JjL2xpYi9tb2Nrcy9yZWFjdC1jb2xvcmZ1bC50c3hcIixcbiAgICAgICksXG4gICAgICBcInJlYWN0LXNpbXBsZS1jb2RlLWVkaXRvclwiOiBwYXRoLnJlc29sdmUoXG4gICAgICAgIF9fZGlybmFtZSxcbiAgICAgICAgXCJzcmMvbGliL21vY2tzL3JlYWN0LXNpbXBsZS1jb2RlLWVkaXRvci50c3hcIixcbiAgICAgICksXG4gICAgICBvcGVuYWk6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwic3JjL2xpYi9tb2Nrcy9vcGVuYWkudHNcIiksXG4gICAgICBcIkBkbmQta2l0L2NvcmVcIjogcGF0aC5yZXNvbHZlKFxuICAgICAgICBfX2Rpcm5hbWUsXG4gICAgICAgIFwic3JjL2xpYi9tb2Nrcy9kbmQta2l0LWNvcmUudHN4XCIsXG4gICAgICApLFxuICAgICAgXCJAZG5kLWtpdC9zb3J0YWJsZVwiOiBwYXRoLnJlc29sdmUoXG4gICAgICAgIF9fZGlybmFtZSxcbiAgICAgICAgXCJzcmMvbGliL21vY2tzL2RuZC1raXQtc29ydGFibGUudHN4XCIsXG4gICAgICApLFxuICAgICAgXCJAZG5kLWtpdC91dGlsaXRpZXNcIjogcGF0aC5yZXNvbHZlKFxuICAgICAgICBfX2Rpcm5hbWUsXG4gICAgICAgIFwic3JjL2xpYi9tb2Nrcy9kbmQta2l0LXV0aWxpdGllcy50c1wiLFxuICAgICAgKSxcbiAgICAgIFwiQGRuZC1raXQvbW9kaWZpZXJzXCI6IHBhdGgucmVzb2x2ZShcbiAgICAgICAgX19kaXJuYW1lLFxuICAgICAgICBcInNyYy9saWIvbW9ja3MvZG5kLWtpdC1tb2RpZmllcnMudHNcIixcbiAgICAgICksXG4gICAgICBcImZpbGUtc2F2ZXJcIjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCJzcmMvbGliL21vY2tzL2ZpbGUtc2F2ZXIudHNcIiksXG4gICAgfSxcbiAgfSxcbiAgc2VydmVyOiB7XG4gICAgaG9zdDogXCIxMjcuMC4wLjFcIiwgLy8gZm9yY2UgSVB2NFxuICAgIHBvcnQ6IDMwMDAsIC8vIHVzZSB5b3VyIHVzdWFsIGRldiBwb3J0XG4gICAgc3RyaWN0UG9ydDogdHJ1ZSwgLy8gZmFpbCBpZiB0aGUgcG9ydCBpcyBhbHJlYWR5IGluIHVzZVxuICB9LFxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQW9ULE9BQU8sV0FBVztBQUN0VSxPQUFPLGNBQWM7QUFDckIsU0FBUyxvQkFBb0I7QUFDN0IsT0FBTyxVQUFVO0FBSGpCLElBQU0sbUNBQW1DO0FBTXpDLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVMsQ0FBQyxNQUFNLENBQUM7QUFBQTtBQUFBLEVBRWpCLE1BQU07QUFBQSxFQUNOLFFBQVE7QUFBQSxJQUNOLFlBQVksS0FBSztBQUFBLE1BQ2YsUUFBUSxJQUFJLHVCQUF1QixNQUFNLEdBQUcsQ0FBQyxLQUMzQyxRQUFRLElBQUksdUJBQ1o7QUFBQSxJQUNKO0FBQUEsRUFDRjtBQUFBO0FBQUEsRUFFQSxXQUFXLENBQUMsT0FBTztBQUFBLEVBQ25CLEtBQUs7QUFBQSxJQUNILFNBQVM7QUFBQSxNQUNQLFNBQVMsQ0FBQyxTQUFTLENBQUM7QUFBQSxJQUN0QjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLFNBQVM7QUFBQSxJQUNQLE9BQU87QUFBQSxNQUNMLEtBQUssS0FBSyxRQUFRLGtDQUFXLE9BQU87QUFBQSxNQUNwQywyQkFBMkIsS0FBSztBQUFBLFFBQzlCO0FBQUEsUUFDQTtBQUFBLE1BQ0Y7QUFBQSxNQUNBLDBCQUEwQixLQUFLO0FBQUEsUUFDN0I7QUFBQSxRQUNBO0FBQUEsTUFDRjtBQUFBLE1BQ0EsMEJBQTBCLEtBQUs7QUFBQSxRQUM3QjtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQUEsTUFDQSx1QkFBdUIsS0FBSztBQUFBLFFBQzFCO0FBQUEsUUFDQTtBQUFBLE1BQ0Y7QUFBQSxNQUNBLHdCQUF3QixLQUFLO0FBQUEsUUFDM0I7QUFBQSxRQUNBO0FBQUEsTUFDRjtBQUFBLE1BQ0EsMkJBQTJCLEtBQUs7QUFBQSxRQUM5QjtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQUEsTUFDQSxpQkFBaUIsS0FBSyxRQUFRLGtDQUFXLCtCQUErQjtBQUFBLE1BQ3hFLGdCQUFnQixLQUFLLFFBQVEsa0NBQVcsOEJBQThCO0FBQUEsTUFDdEUsaUJBQWlCLEtBQUs7QUFBQSxRQUNwQjtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQUEsTUFDQSx5QkFBeUIsS0FBSztBQUFBLFFBQzVCO0FBQUEsUUFDQTtBQUFBLE1BQ0Y7QUFBQSxNQUNBLGdCQUFnQixLQUFLLFFBQVEsa0NBQVcsZ0NBQWdDO0FBQUEsTUFDeEUsbUNBQW1DLEtBQUs7QUFBQSxRQUN0QztBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQUEsTUFDQSx5QkFBeUIsS0FBSztBQUFBLFFBQzVCO0FBQUEsUUFDQTtBQUFBLE1BQ0Y7QUFBQSxNQUNBLDBCQUEwQixLQUFLO0FBQUEsUUFDN0I7QUFBQSxRQUNBO0FBQUEsTUFDRjtBQUFBLE1BQ0EsNEJBQTRCLEtBQUs7QUFBQSxRQUMvQjtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQUEsTUFDQSwwQkFBMEIsS0FBSztBQUFBLFFBQzdCO0FBQUEsUUFDQTtBQUFBLE1BQ0Y7QUFBQSxNQUNBLDZCQUE2QixLQUFLO0FBQUEsUUFDaEM7QUFBQSxRQUNBO0FBQUEsTUFDRjtBQUFBLE1BQ0EseUJBQXlCLEtBQUs7QUFBQSxRQUM1QjtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQUEsTUFDQSx1QkFBdUIsS0FBSztBQUFBLFFBQzFCO0FBQUEsUUFDQTtBQUFBLE1BQ0Y7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BS0Esc0JBQXNCLEtBQUs7QUFBQSxRQUN6QjtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQUEsTUFDQSxVQUFVLEtBQUssUUFBUSxrQ0FBVywwQkFBMEI7QUFBQSxNQUM1RCxrQkFBa0IsS0FBSztBQUFBLFFBQ3JCO0FBQUEsUUFDQTtBQUFBLE1BQ0Y7QUFBQSxNQUNBLDRCQUE0QixLQUFLO0FBQUEsUUFDL0I7QUFBQSxRQUNBO0FBQUEsTUFDRjtBQUFBLE1BQ0EsUUFBUSxLQUFLLFFBQVEsa0NBQVcseUJBQXlCO0FBQUEsTUFDekQsaUJBQWlCLEtBQUs7QUFBQSxRQUNwQjtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQUEsTUFDQSxxQkFBcUIsS0FBSztBQUFBLFFBQ3hCO0FBQUEsUUFDQTtBQUFBLE1BQ0Y7QUFBQSxNQUNBLHNCQUFzQixLQUFLO0FBQUEsUUFDekI7QUFBQSxRQUNBO0FBQUEsTUFDRjtBQUFBLE1BQ0Esc0JBQXNCLEtBQUs7QUFBQSxRQUN6QjtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQUEsTUFDQSxjQUFjLEtBQUssUUFBUSxrQ0FBVyw2QkFBNkI7QUFBQSxJQUNyRTtBQUFBLEVBQ0Y7QUFBQSxFQUNBLFFBQVE7QUFBQSxJQUNOLE1BQU07QUFBQTtBQUFBLElBQ04sTUFBTTtBQUFBO0FBQUEsSUFDTixZQUFZO0FBQUE7QUFBQSxFQUNkO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K

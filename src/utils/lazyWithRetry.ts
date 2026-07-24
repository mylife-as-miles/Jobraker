import React from "react";

/**
 * Handles missing script chunk load failures (404 Not Found after new deployments)
 * by refreshing the page once so the browser fetches the latest build manifest.
 */
export function handleChunkError(error: unknown) {
  if (typeof window === "undefined") return;
  console.warn("Chunk loading failed (likely due to a new deployment). Refreshing page...", error);
  const reloadKey = "jobraker_chunk_reload";
  const lastReload = sessionStorage.getItem(reloadKey);
  const now = Date.now();
  // Prevent infinite reload loop: only auto-reload if last reload was > 10s ago
  if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
    sessionStorage.setItem(reloadKey, String(now));
    window.location.reload();
  }
}

/**
 * Wraps dynamic React.lazy imports with automated retry and auto-reload on 404 chunk failure.
 */
export function lazyWithRetry<T extends React.ComponentType<any>>(
  importer: () => Promise<any>,
  exportName?: string
): React.LazyExoticComponent<T> {
  return React.lazy(async () => {
    try {
      const module = await importer();
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("jobraker_chunk_reload");
      }
      return exportName ? { default: module[exportName] as T } : module;
    } catch (error) {
      handleChunkError(error);
      return new Promise<{ default: T }>(() => {});
    }
  });
}

// Global window event listeners for Vite chunk load errors
if (typeof window !== "undefined") {
  window.addEventListener("vite:preloadError", (event) => {
    event.preventDefault();
    handleChunkError("vite:preloadError");
  });

  window.addEventListener(
    "error",
    (e) => {
      const message = e.message || "";
      const target = e.target as HTMLElement | null;
      const isChunkScriptError =
        target &&
        (target.tagName === "SCRIPT" || target.tagName === "LINK") &&
        (target as any).src?.includes("/assets/");
      if (
        isChunkScriptError ||
        message.includes("Failed to fetch dynamically imported module") ||
        message.includes("Importing a module script failed") ||
        message.includes("Loading chunk")
      ) {
        handleChunkError(e);
      }
    },
    true
  );
}

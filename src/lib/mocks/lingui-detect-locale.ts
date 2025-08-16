// Minimal mock implementation of @lingui/detect-locale used by the client LocaleProvider
// Provides: detect, fromUrl, fromStorage

type Detector = (() => string | null | undefined) | string | null | undefined;

export const fromUrl = (param: string) => () => {
  try {
    const url = new URL(window.location.href);
    return url.searchParams.get(param);
  } catch {
    return null;
  }
};

export const fromStorage = (key: string) => () => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

export function detect(...detectors: Detector[]): string | null {
  for (const d of detectors) {
    if (typeof d === "function") {
      try {
        const v = d();
        if (typeof v === "string" && v) return v;
      } catch {/* noop */}
    } else if (typeof d === "string" && d) {
      return d;
    }
  }
  return null;
}

export default { detect, fromUrl, fromStorage };

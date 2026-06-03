const STORAGE_KEY = "jobraker_posthog_utm";

type AttributionKey =
  | "utm_source"
  | "utm_campaign"
  | "utm_medium"
  | "utm_term"
  | "utm_content"
  | "gclid"
  | "fbclid"
  | "msclkid"
  | "landing_path"
  | "landing_url"
  | "captured_at";

type AttributionState = Partial<Record<AttributionKey, string>>;

const ATTRIBUTION_PARAM_KEYS: AttributionKey[] = [
  "utm_source",
  "utm_campaign",
  "utm_medium",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
  "msclkid",
];

function readStoredAttribution(): AttributionState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as AttributionState;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStoredAttribution(next: AttributionState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage failures in private / restricted contexts.
  }
}

export function persistAttributionFromSearch(
  search = window.location.search,
  pathname = window.location.pathname,
) {
  const params = new URLSearchParams(search || "");
  const nextEntries = ATTRIBUTION_PARAM_KEYS.reduce<AttributionState>(
    (acc, key) => {
      const value = params.get(key);
      if (value) {
        acc[key] = value;
      }
      return acc;
    },
    {},
  );

  if (Object.keys(nextEntries).length === 0) {
    return;
  }

  const current = readStoredAttribution();
  writeStoredAttribution({
    ...current,
    ...nextEntries,
    landing_path: current.landing_path || pathname || "/",
    landing_url:
      current.landing_url ||
      `${window.location.origin}${pathname}${search || ""}`,
    captured_at: current.captured_at || new Date().toISOString(),
  });
}

export function getStoredAttributionProperties(): Record<string, string> {
  const stored = readStoredAttribution();
  return Object.fromEntries(
    Object.entries(stored).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0,
    ),
  );
}

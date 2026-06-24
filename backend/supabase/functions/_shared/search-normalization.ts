// search-normalization.ts — Canonical Search Scope Normalization
// ─────────────────────────────────────────────────────────────────────────────

export interface CanonicalLocation {
  scope: "country" | "city" | "remote" | "global";
  locationKey: string | null;
  countryCode: string | null;
  city: string | null;
  displayName: string | null;
}

export interface CanonicalSearchScope {
  originalQuery: string;
  normalizedQuery: string;
  location: CanonicalLocation;
  fingerprint: string;
}

const COUNTRY_MAP: Record<string, { code: string; name: string }> = {
  "nigeria": { code: "NG", name: "Nigeria" },
  "ng": { code: "NG", name: "Nigeria" },
  "united states": { code: "US", name: "United States" },
  "united states of america": { code: "US", name: "United States" },
  "usa": { code: "US", name: "United States" },
  "us": { code: "US", name: "United States" },
  "united kingdom": { code: "GB", name: "United Kingdom" },
  "uk": { code: "GB", name: "United Kingdom" },
  "great britain": { code: "GB", name: "United Kingdom" },
  "gb": { code: "GB", name: "United Kingdom" },
  "canada": { code: "CA", name: "Canada" },
  "ca": { code: "CA", name: "Canada" },
  "germany": { code: "DE", name: "Germany" },
  "de": { code: "DE", name: "Germany" },
  "india": { code: "IN", name: "India" },
  "in": { code: "IN", name: "India" },
  "australia": { code: "AU", name: "Australia" },
  "au": { code: "AU", name: "Australia" },
};

const CITY_MAP: Record<string, { city: string; countryCode: string; countryName: string }> = {
  "lagos": { city: "Lagos", countryCode: "NG", countryName: "Nigeria" },
  "london": { city: "London", countryCode: "GB", countryName: "United Kingdom" },
  "berlin": { city: "Berlin", countryCode: "DE", countryName: "Germany" },
  "new york": { city: "New York", countryCode: "US", countryName: "United States" },
  "new york city": { city: "New York", countryCode: "US", countryName: "United States" },
  "nyc": { city: "New York", countryCode: "US", countryName: "United States" },
  "san francisco": { city: "San Francisco", countryCode: "US", countryName: "United States" },
  "sf": { city: "San Francisco", countryCode: "US", countryName: "United States" },
  "toronto": { city: "Toronto", countryCode: "CA", countryName: "Canada" },
  "sydney": { city: "Sydney", countryCode: "AU", countryName: "Australia" },
};

async function computeSHA256(text: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function normalizeSearchScope(
  originalQuery: string,
  rawLocation: string,
  locationScope: "city" | "country" | "global" | "remote" | string,
): Promise<CanonicalSearchScope> {
  const normQuery = String(originalQuery || "").trim().toLowerCase().replace(/\s+/g, " ");
  const cleanLoc = String(rawLocation || "").trim();
  const lowerLoc = cleanLoc.toLowerCase();

  let scope: "country" | "city" | "remote" | "global" = "global";
  let locationKey: string | null = "global";
  let countryCode: string | null = null;
  let city: string | null = null;
  let displayName: string | null = "Global";

  const isRemote =
    locationScope === "remote" ||
    lowerLoc === "remote" ||
    lowerLoc === "anywhere" ||
    lowerLoc.includes("work from home") ||
    lowerLoc.includes("wfh");

  if (isRemote) {
    scope = "remote";
    locationKey = "remote";
    displayName = "Remote";
  } else if (locationScope === "global" || lowerLoc === "global" || !cleanLoc) {
    scope = "global";
    locationKey = "global";
    displayName = "Global";
  } else if (locationScope === "country") {
    scope = "country";
    let matchedCode = "US"; // default fallback
    let matchedName = cleanLoc;

    for (const [key, val] of Object.entries(COUNTRY_MAP)) {
      if (lowerLoc === key || lowerLoc.includes(key)) {
        matchedCode = val.code;
        matchedName = val.name;
        break;
      }
    }

    countryCode = matchedCode;
    locationKey = matchedCode;
    displayName = matchedName;
  } else {
    // Treat as city
    scope = "city";
    let matchedCity = cleanLoc;
    let matchedCountryCode = "US";
    let matchedCountryName = "United States";

    // Check for comma, e.g. "Lagos, Nigeria"
    const parts = lowerLoc.split(",").map(p => p.trim());
    if (parts.length > 1) {
      matchedCity = cleanLoc.substring(0, cleanLoc.indexOf(",")).trim();
      const countryPart = parts[1];
      for (const [key, val] of Object.entries(COUNTRY_MAP)) {
        if (countryPart === key || countryPart.includes(key)) {
          matchedCountryCode = val.code;
          matchedCountryName = val.name;
          break;
        }
      }
    } else {
      // Look up in city map
      const mapped = CITY_MAP[lowerLoc];
      if (mapped) {
        matchedCity = mapped.city;
        matchedCountryCode = mapped.countryCode;
        matchedCountryName = mapped.countryName;
      }
    }

    city = matchedCity;
    countryCode = matchedCountryCode;
    locationKey = `${matchedCountryCode}:${matchedCity.toLowerCase().replace(/\s+/g, "_")}`;
    displayName = `${matchedCity}, ${matchedCountryName}`;
  }

  // Compute unique fingerprint
  const fingerprintInput = `${normQuery}|${scope}|${locationKey || ""}`;
  const fingerprint = await computeSHA256(fingerprintInput);

  return {
    originalQuery,
    normalizedQuery: normQuery,
    location: {
      scope,
      locationKey,
      countryCode,
      city,
      displayName,
    },
    fingerprint,
  };
}

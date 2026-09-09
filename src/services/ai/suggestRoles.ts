import { invokeProtectedFunction } from "../supabase/invokeProtectedFunction";

export interface SuggestSearchPreferencesOptions {
  type?: "roles" | "locations" | "all";
  currentRole?: string;
  currentLocation?: string;
  skills?: string[];
  experiences?: Array<{ title?: string; company?: string; location?: string; description?: string }>;
}

export interface SuggestSearchPreferencesResult {
  roles: string[];
  locations: string[];
}

export async function fetchAiSuggestedPreferences(
  options: SuggestSearchPreferencesOptions = {},
): Promise<SuggestSearchPreferencesResult> {
  try {
    const data = await invokeProtectedFunction<{ roles?: string[]; locations?: string[] }>(
      "suggest-roles",
      {
        body: options,
      },
    );

    if (data) {
      return {
        roles: Array.isArray(data.roles) && data.roles.length > 0 ? data.roles : [],
        locations: Array.isArray(data.locations) && data.locations.length > 0 ? data.locations : [],
      };
    }
  } catch (err) {
    console.warn("[fetchAiSuggestedPreferences] Edge function fallback:", err);
  }

  // Fallbacks
  const defaultRoles = [
    options.currentRole,
    "Senior AI & Backend Developer",
    "Full Stack Engineer",
    "AI Engineer",
    "Backend Developer",
    "Machine Learning Engineer",
    "DevOps Engineer",
  ].filter(Boolean) as string[];

  const defaultLocations = [
    "Remote",
    options.currentLocation || "Enugu, Nigeria",
    "Lagos, Nigeria",
    "United States",
    "United Kingdom",
    "Canada",
    "Germany",
  ].filter(Boolean) as string[];

  return {
    roles: Array.from(new Set(defaultRoles)),
    locations: Array.from(new Set(defaultLocations)),
  };
}

export async function fetchAiSuggestedRoles(
  options: SuggestSearchPreferencesOptions = {},
): Promise<string[]> {
  const res = await fetchAiSuggestedPreferences({ ...options, type: "roles" });
  return res.roles;
}

export async function fetchAiSuggestedLocations(
  options: SuggestSearchPreferencesOptions = {},
): Promise<string[]> {
  const res = await fetchAiSuggestedPreferences({ ...options, type: "locations" });
  return res.locations;
}

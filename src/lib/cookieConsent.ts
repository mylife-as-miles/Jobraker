export const COOKIE_CONSENT_STORAGE_KEY = "jobraker-cookie-consent";
export const COOKIE_CONSENT_VERSION = "1.0";
export const COOKIE_CONSENT_CHANGED_EVENT = "jobraker:cookie-consent-changed";

export type CookieConsentChoice = "accepted" | "essential_only";

export interface CookieConsentPreference {
  choice: CookieConsentChoice;
  version: string;
  updatedAt: string;
}

type PrivacySettingsClient = {
  from: (table: string) => {
    upsert: (
      values: Record<string, unknown>,
      options: { onConflict: string },
    ) => PromiseLike<{ error: { message?: string } | null }>;
  };
};

export function createCookieConsentPreference(
  choice: CookieConsentChoice,
  now = new Date(),
): CookieConsentPreference {
  return {
    choice,
    version: COOKIE_CONSENT_VERSION,
    updatedAt: now.toISOString(),
  };
}

export function readCookieConsent(
  storage: Pick<Storage, "getItem"> = window.localStorage,
): CookieConsentPreference | null {
  try {
    const raw = storage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<CookieConsentPreference>;

    if (
      (value.choice !== "accepted" && value.choice !== "essential_only") ||
      value.version !== COOKIE_CONSENT_VERSION ||
      typeof value.updatedAt !== "string" ||
      Number.isNaN(Date.parse(value.updatedAt))
    ) {
      return null;
    }

    return value as CookieConsentPreference;
  } catch {
    return null;
  }
}

export function writeCookieConsent(
  preference: CookieConsentPreference,
  storage: Pick<Storage, "setItem"> = window.localStorage,
) {
  storage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(preference));
}

export function hasAnalyticsConsent() {
  return typeof window !== "undefined" && readCookieConsent()?.choice === "accepted";
}

export function getPrivacySettingsPatch(
  userId: string,
  preference: CookieConsentPreference,
) {
  const acceptsOptionalCookies = preference.choice === "accepted";

  return {
    id: userId,
    allow_cookie_tracking: acceptsOptionalCookies,
    allow_functional_cookies: true,
    allow_analytics_cookies: acceptsOptionalCookies,
    allow_advertising_cookies: acceptsOptionalCookies,
    cookie_consent_status: preference.choice,
    cookie_consent_version: preference.version,
    cookie_consent_updated_at: preference.updatedAt,
    updated_at: preference.updatedAt,
  };
}

export function preferenceFromPrivacySettings(
  row: Record<string, unknown> | null,
): CookieConsentPreference | null {
  if (
    !row ||
    (row.cookie_consent_status !== "accepted" &&
      row.cookie_consent_status !== "essential_only") ||
    row.cookie_consent_version !== COOKIE_CONSENT_VERSION ||
    typeof row.cookie_consent_updated_at !== "string"
  ) {
    return null;
  }

  return {
    choice: row.cookie_consent_status,
    version: row.cookie_consent_version,
    updatedAt: row.cookie_consent_updated_at,
  };
}

export async function persistCookieConsent(
  client: PrivacySettingsClient,
  userId: string,
  preference: CookieConsentPreference,
) {
  const { error } = await client
    .from("privacy_settings")
    .upsert(getPrivacySettingsPatch(userId, preference), { onConflict: "id" });

  if (error) {
    throw new Error(error.message || "Could not save cookie preferences.");
  }
}

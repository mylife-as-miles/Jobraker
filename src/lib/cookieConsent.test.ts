import { describe, expect, it, vi } from "vitest";
import {
  COOKIE_CONSENT_VERSION,
  createCookieConsentPreference,
  getPrivacySettingsPatch,
  persistCookieConsent,
  readCookieConsent,
  writeCookieConsent,
} from "./cookieConsent";

function createMemoryStorage() {
  const values = new Map<string, string>();

  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  } as unknown as Storage;
}

describe("cookie consent", () => {
  it("stores and restores a versioned acceptance decision", () => {
    const storage = createMemoryStorage();
    const preference = createCookieConsentPreference(
      "accepted",
      new Date("2026-09-06T12:00:00.000Z"),
    );

    writeCookieConsent(preference, storage);

    expect(readCookieConsent(storage)).toEqual(preference);
    expect(preference.version).toBe(COOKIE_CONSENT_VERSION);
  });

  it("ignores malformed or outdated stored decisions", () => {
    const storage = createMemoryStorage();
    storage.setItem("jobraker-cookie-consent", "not-json");
    expect(readCookieConsent(storage)).toBeNull();

    storage.setItem(
      "jobraker-cookie-consent",
      JSON.stringify({
        choice: "accepted",
        version: "outdated",
        updatedAt: "2026-09-06T12:00:00.000Z",
      }),
    );
    expect(readCookieConsent(storage)).toBeNull();
  });

  it("maps essential-only consent to privacy-safe database values", () => {
    const preference = createCookieConsentPreference(
      "essential_only",
      new Date("2026-09-06T12:00:00.000Z"),
    );

    expect(getPrivacySettingsPatch("user-1", preference)).toEqual({
      id: "user-1",
      allow_cookie_tracking: false,
      allow_functional_cookies: true,
      allow_analytics_cookies: false,
      allow_advertising_cookies: false,
      cookie_consent_status: "essential_only",
      cookie_consent_version: COOKIE_CONSENT_VERSION,
      cookie_consent_updated_at: "2026-09-06T12:00:00.000Z",
      updated_at: "2026-09-06T12:00:00.000Z",
    });
  });

  it("upserts the authenticated user's decision", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const client = { from: vi.fn(() => ({ upsert })) };
    const preference = createCookieConsentPreference(
      "accepted",
      new Date("2026-09-06T12:00:00.000Z"),
    );

    await persistCookieConsent(client, "user-1", preference);

    expect(client.from).toHaveBeenCalledWith("privacy_settings");
    expect(upsert).toHaveBeenCalledWith(
      getPrivacySettingsPatch("user-1", preference),
      { onConflict: "id" },
    );
  });
});

export const LOW_CREDIT_RESCUE_CODE = "LOWCREDIT_RESCUE";
export const LOW_CREDIT_RESCUE_LEGACY_CODES = ["JOBRAKER_PERSONAL"] as const;
export const LOW_CREDIT_RESCUE_ACCEPTED_CODES = [
  LOW_CREDIT_RESCUE_CODE,
  ...LOW_CREDIT_RESCUE_LEGACY_CODES,
] as const;
export const LOW_CREDIT_RESCUE_DISCOUNT_PCT = 15;
export const LOW_CREDIT_RESCUE_MULTIPLIER =
  (100 - LOW_CREDIT_RESCUE_DISCOUNT_PCT) / 100;
export const LOW_CREDIT_RESCUE_DURATION_MS = 1000 * 60 * 60;
export const LOW_CREDIT_RESCUE_EXPIRY_KEY = "jobraker_low_credit_rescue_expiry";
const LEGACY_EXPIRY_KEY = "jobraker_promo_expiry";

export function isLowCreditRescueCode(value?: string | null) {
  if (!value) return false;
  return LOW_CREDIT_RESCUE_ACCEPTED_CODES.includes(
    value.toUpperCase() as (typeof LOW_CREDIT_RESCUE_ACCEPTED_CODES)[number],
  );
}

export function normalizeLowCreditRescueCode(value?: string | null) {
  return isLowCreditRescueCode(value) ? LOW_CREDIT_RESCUE_CODE : null;
}

export function readLowCreditRescueExpiry() {
  if (typeof window === "undefined") return 0;

  const keys = [LOW_CREDIT_RESCUE_EXPIRY_KEY, LEGACY_EXPIRY_KEY];
  for (const key of keys) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = parseInt(raw, 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    } catch {
      continue;
    }
  }

  return 0;
}

export function ensureLowCreditRescueExpiry() {
  if (typeof window === "undefined") return 0;

  const current = readLowCreditRescueExpiry();
  if (current > Date.now()) {
    try {
      window.localStorage.setItem(LOW_CREDIT_RESCUE_EXPIRY_KEY, String(current));
    } catch {
      // Ignore storage write failures; caller only needs the timestamp.
    }
    return current;
  }

  const next = Date.now() + LOW_CREDIT_RESCUE_DURATION_MS;
  try {
    window.localStorage.setItem(LOW_CREDIT_RESCUE_EXPIRY_KEY, String(next));
  } catch {
    // Ignore storage write failures and return the in-memory value.
  }
  return next;
}

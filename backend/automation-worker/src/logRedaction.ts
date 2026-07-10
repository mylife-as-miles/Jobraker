const SECRET_KEY_PATTERN = /(api[_-]?key|authorization|password|cookie|token|totp|secret|service[_-]?role|signature)/i;
const SECRET_VALUE_PATTERN =
  /(rtrvr_[A-Za-z0-9._-]+|mcp_at_[A-Za-z0-9._-]+|eyJ[A-Za-z0-9._-]+|Bearer\s+[A-Za-z0-9._-]+)/g;

export function redactSensitiveValue(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(SECRET_VALUE_PATTERN, "[redacted]");
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveValue(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
      key,
      SECRET_KEY_PATTERN.test(key) ? "[redacted]" : redactSensitiveValue(nested),
    ]),
  );
}

import { createRtrvrClient, type RtrvrSdk } from "@rtrvr-ai/sdk";

export interface RtrvrClientEnv {
  RTRVR_API_KEY?: string;
  RTRVR_ENABLED?: string;
  RTRVR_DEFAULT_TARGET?: string;
  RTRVR_PREFER_EXTENSION?: string;
  RTRVR_TIMEOUT_MS?: string;
}

export function parseEnvBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value.trim() === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function parseTimeout(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 300_000;
}

export function isRtrvrEnabled(env: RtrvrClientEnv = process.env): boolean {
  return parseEnvBoolean(env.RTRVR_ENABLED, true);
}

export function assertRtrvrSdkContract(client: unknown): asserts client is RtrvrSdk {
  const root = client as Partial<RtrvrSdk> | null | undefined;
  const checks: Array<[string, unknown]> = [
    ["client.run", root?.run],
    ["client.scrape.route", root?.scrape?.route],
    ["client.devices.list", root?.devices?.list],
    ["client.profile.capabilities", root?.profile?.capabilities],
    ["client.tools.extract", root?.tools?.extract],
    ["client.tools.act", root?.tools?.act],
  ];
  const missing = checks
    .filter(([, value]) => typeof value !== "function")
    .map(([name]) => name);
  if (missing.length > 0) {
    throw new Error(`Unsupported @rtrvr-ai/sdk contract. Missing: ${missing.join(", ")}.`);
  }
}

export function createJobrakerRtrvrClient(
  env: RtrvrClientEnv = process.env,
): RtrvrSdk {
  if (!isRtrvrEnabled(env)) {
    throw new Error("RTRVR_ENABLED is false; rtrvr automation is disabled.");
  }

  const apiKey = env.RTRVR_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("RTRVR_API_KEY is required for the automation worker.");
  }

  const defaultTarget =
    env.RTRVR_DEFAULT_TARGET === "cloud" || env.RTRVR_DEFAULT_TARGET === "extension"
      ? env.RTRVR_DEFAULT_TARGET
      : "auto";

  const client = createRtrvrClient({
    apiKey,
    defaultTarget,
    preferExtensionByDefault: parseEnvBoolean(env.RTRVR_PREFER_EXTENSION, false),
    timeoutMs: parseTimeout(env.RTRVR_TIMEOUT_MS),
    retryPolicy: {
      maxAttempts: 2,
      baseDelayMs: 500,
      maxDelayMs: 5_000,
    },
  });
  assertRtrvrSdkContract(client);
  return client;
}

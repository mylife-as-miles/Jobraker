import type { RtrvrSdk } from "@rtrvr-ai/sdk";
import { validateAutomationUrl } from "./urlSecurity.js";

export type RtrvrToolName =
  | "rtrvr_run"
  | "rtrvr_scrape"
  | "rtrvr_list_devices"
  | "rtrvr_capabilities"
  | "rtrvr_extract_from_page"
  | "rtrvr_act_on_page";

export const RTRVR_AI_CHAT_TOOLS: Array<{
  name: RtrvrToolName;
  permission: "read" | "mutate";
  timeoutMs: number;
  auditEvent: string;
}> = [
  { name: "rtrvr_list_devices", permission: "read", timeoutMs: 15_000, auditEvent: "rtrvr.devices.list" },
  { name: "rtrvr_capabilities", permission: "read", timeoutMs: 15_000, auditEvent: "rtrvr.capabilities" },
  { name: "rtrvr_scrape", permission: "read", timeoutMs: 120_000, auditEvent: "rtrvr.scrape" },
  { name: "rtrvr_extract_from_page", permission: "read", timeoutMs: 120_000, auditEvent: "rtrvr.extract" },
  { name: "rtrvr_run", permission: "mutate", timeoutMs: 300_000, auditEvent: "rtrvr.run" },
  { name: "rtrvr_act_on_page", permission: "mutate", timeoutMs: 120_000, auditEvent: "rtrvr.act" },
];

export function isRtrvrToolName(value: unknown): value is RtrvrToolName {
  return (
    typeof value === "string" &&
    RTRVR_AI_CHAT_TOOLS.some((tool) => tool.name === value)
  );
}

function urlsFromArgs(args: Record<string, unknown>): string[] {
  const raw = Array.isArray(args.urls)
    ? args.urls
    : typeof args.url === "string"
      ? [args.url]
      : [];
  return raw.map((url) => validateAutomationUrl(String(url)).toString());
}

export async function executeRtrvrTool(
  client: RtrvrSdk,
  name: RtrvrToolName,
  args: Record<string, unknown>,
): Promise<unknown> {
  if (name === "rtrvr_list_devices") return client.devices.list();
  if (name === "rtrvr_capabilities") return client.profile.capabilities();

  if (name === "rtrvr_scrape") {
    return client.scrape.route({
      urls: urlsFromArgs(args),
      target: args.target === "cloud" || args.target === "extension" ? args.target : "auto",
      requireLocalSession: args.require_local_session === true,
      deviceId: typeof args.device_id === "string" ? args.device_id : undefined,
      response: { inlineOutputMaxBytes: 50_000 },
    });
  }

  if (name === "rtrvr_extract_from_page") {
    return client.tools.extract({
      user_input: String(args.instruction || args.user_input || "Extract structured information from the page."),
      tab_urls: urlsFromArgs(args),
      schema: args.schema,
    }, typeof args.device_id === "string" ? args.device_id : undefined);
  }

  if (name === "rtrvr_act_on_page") {
    return client.tools.act({
      user_input: String(args.instruction || args.user_input || ""),
      tab_urls: urlsFromArgs(args),
    }, typeof args.device_id === "string" ? args.device_id : undefined);
  }

  return client.run({
    input: String(args.instruction || args.input || ""),
    urls: urlsFromArgs(args),
    target: args.target === "cloud" || args.target === "extension" ? args.target : "auto",
    preferExtension: args.prefer_extension === true,
    requireLocalSession: args.require_local_session === true,
    deviceId: typeof args.device_id === "string" ? args.device_id : undefined,
    schema: args.schema && typeof args.schema === "object" ? (args.schema as Record<string, unknown>) : undefined,
    response: {
      verbosity: "steps",
      inlineOutputMaxBytes: 50_000,
    },
  });
}

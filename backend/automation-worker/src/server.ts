import { createHash, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import { createJobrakerRtrvrClient } from "./rtrvrClient.js";
import {
  claimAutomationWorkerNonce,
  createServiceSupabaseClientFromEnv,
  type ServiceSupabaseClient,
} from "./database.js";
import { executeRtrvrTool, isRtrvrToolName } from "./tools.js";
import { redactSensitiveValue } from "./logRedaction.js";
import {
  verifyWorkerHmacRequest,
  workerAuthHeaderValue,
  type WorkerAuthHeaders,
} from "./workerAuth.js";

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    req.on("error", reject);
  });
}

function parseJsonBody(rawBody: string): Record<string, unknown> {
  return rawBody ? JSON.parse(rawBody) : {};
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function hasStaticWorkerSecret(req: IncomingMessage, expected: string): boolean {
  const auth = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  const header = String(req.headers["x-jobraker-worker-secret"] || "").trim();
  return [auth, header].some((provided) => provided && constantTimeEquals(provided, expected));
}

function hasAnyWorkerHmacHeader(headers: WorkerAuthHeaders): boolean {
  return Boolean(
    workerAuthHeaderValue(headers, "x-jobraker-worker-timestamp") ||
      workerAuthHeaderValue(headers, "x-jobraker-worker-nonce") ||
      workerAuthHeaderValue(headers, "x-jobraker-worker-body-sha256") ||
      workerAuthHeaderValue(headers, "x-jobraker-worker-signature")
  );
}

async function hasWorkerAuth(
  req: IncomingMessage,
  rawBody: string,
  supabase: ServiceSupabaseClient,
): Promise<boolean> {
  const expected = process.env.AUTOMATION_WORKER_SECRET?.trim();
  if (!expected) return false;
  const rawMaxAgeSeconds = Number(process.env.AUTOMATION_WORKER_HMAC_MAX_AGE_SECONDS || 300);
  const maxAgeSeconds = Number.isFinite(rawMaxAgeSeconds)
    ? Math.max(30, Math.min(rawMaxAgeSeconds, 900))
    : 300;
  const hmac = await verifyWorkerHmacRequest({
    headers: req.headers,
    rawBody,
    secret: expected,
    maxAgeSeconds,
    claimNonce: (nonce, expiresAt) => claimAutomationWorkerNonce(supabase, nonce, expiresAt),
  });
  if (hmac.ok) return true;
  if (hasAnyWorkerHmacHeader(req.headers)) {
    return false;
  }
  return process.env.AUTOMATION_WORKER_ALLOW_STATIC_SECRET === "true" &&
    hasStaticWorkerSecret(req, expected);
}

function hasRtrvrWebhookSecret(req: IncomingMessage): boolean {
  const expected = process.env.RTRVR_WEBHOOK_SECRET?.trim();
  if (!expected) return false;
  const auth = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  const header = String(req.headers["x-rtrvr-webhook-secret"] || "").trim();
  return [auth, header].some((provided) => provided && constantTimeEquals(provided, expected));
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function eventIdForPayload(payload: Record<string, unknown>): string {
  return (
    asString(payload.event_id) ||
    asString(payload.id) ||
    asString(payload.requestId) ||
    createHash("sha256").update(JSON.stringify(payload)).digest("hex")
  );
}

async function handleTool(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const rawBody = await readBody(req);
  const supabase = createServiceSupabaseClientFromEnv();
  if (!await hasWorkerAuth(req, rawBody, supabase)) {
    sendJson(res, 401, { error: "Unauthorized" });
    return;
  }

  const body = parseJsonBody(rawBody);
  const tool = asString(body.tool);
  if (!isRtrvrToolName(tool)) {
    sendJson(res, 400, { error: "Unsupported rtrvr tool" });
    return;
  }
  const args =
    body.args && typeof body.args === "object" && !Array.isArray(body.args)
      ? (body.args as Record<string, unknown>)
      : {};
  const client = createJobrakerRtrvrClient();
  const result = await executeRtrvrTool(client, tool, args);
  sendJson(res, 200, { success: true, data: redactSensitiveValue(result) });
}

async function handleRtrvrWebhook(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!hasRtrvrWebhookSecret(req)) {
    sendJson(res, 401, { error: "Unauthorized webhook request" });
    return;
  }

  const payload = parseJsonBody(await readBody(req));
  const supabase = createServiceSupabaseClientFromEnv();
  const eventId = eventIdForPayload(payload);
  const applicationId =
    asString(payload.applicationId) ||
    asString(payload.application_id) ||
    asString(payload.trajectoryId) ||
    asString(payload.trajectory_id);
  const eventType = asString(payload.event) || asString(payload.type) || "rtrvr_event";

  await supabase.from("rtrvr_webhook_events").upsert(
    {
      event_id: eventId,
      application_id: applicationId,
      event_type: eventType,
      payload: redactSensitiveValue(payload),
      received_at: new Date().toISOString(),
    },
    { onConflict: "event_id" },
  );

  if (applicationId) {
    await supabase
      .from("application_automation_attempts")
      .update({ last_activity_at: new Date().toISOString() })
      .eq("application_id", applicationId)
      .eq("provider", "rtrvr");
  }

  sendJson(res, 200, { success: true, event_id: eventId });
}

export function startAutomationWorkerServer(): void {
  const port = Number(process.env.AUTOMATION_WORKER_PORT || 8787);
  const server = createServer((req, res) => {
    const path = new URL(req.url || "/", "http://localhost").pathname;
    if (req.method === "POST" && path === "/tools/rtrvr") {
      void handleTool(req, res).catch((error) => {
        console.error("automation_worker.tool_error", redactSensitiveValue(error));
        sendJson(res, 500, { error: error instanceof Error ? error.message : "Tool failed" });
      });
      return;
    }
    if (req.method === "POST" && path === "/webhooks/rtrvr") {
      void handleRtrvrWebhook(req, res).catch((error) => {
        console.error("automation_worker.webhook_error", redactSensitiveValue(error));
        sendJson(res, 500, { error: error instanceof Error ? error.message : "Webhook failed" });
      });
      return;
    }
    sendJson(res, 404, { error: "Not found" });
  });

  server.listen(port, () => {
    console.log(`automation_worker.http_ready port=${port}`);
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  startAutomationWorkerServer();
}

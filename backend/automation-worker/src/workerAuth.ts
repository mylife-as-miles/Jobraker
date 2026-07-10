import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export interface WorkerAuthHeaders {
  [key: string]: string | string[] | undefined;
}

export interface WorkerHmacVerificationOptions {
  headers: WorkerAuthHeaders;
  rawBody: string;
  secret: string;
  nowMs?: number;
  maxAgeSeconds?: number;
  claimNonce: (nonce: string, expiresAt: Date) => Promise<boolean>;
}

export interface WorkerHmacVerificationResult {
  ok: boolean;
  reason?: "missing_header" | "bad_timestamp" | "expired" | "body_hash" | "signature" | "replay";
}

function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function workerAuthHeaderValue(headers: WorkerAuthHeaders, name: string): string {
  const value = headers[name.toLowerCase()];
  if (Array.isArray(value)) return String(value[0] || "").trim();
  return String(value || "").trim();
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function createWorkerRequestSignature(opts: {
  secret: string;
  timestamp: string;
  nonce: string;
  bodyHash: string;
}): string {
  const payload = `${opts.timestamp}.${opts.nonce}.${opts.bodyHash}`;
  return `sha256=${createHmac("sha256", opts.secret).update(payload).digest("hex")}`;
}

export async function verifyWorkerHmacRequest(
  opts: WorkerHmacVerificationOptions,
): Promise<WorkerHmacVerificationResult> {
  const timestamp = workerAuthHeaderValue(opts.headers, "x-jobraker-worker-timestamp");
  const nonce = workerAuthHeaderValue(opts.headers, "x-jobraker-worker-nonce");
  const bodyHash = workerAuthHeaderValue(opts.headers, "x-jobraker-worker-body-sha256");
  const signature = workerAuthHeaderValue(opts.headers, "x-jobraker-worker-signature");
  if (!timestamp || !nonce || !bodyHash || !signature) {
    return { ok: false, reason: "missing_header" };
  }

  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) {
    return { ok: false, reason: "bad_timestamp" };
  }

  const nowMs = opts.nowMs ?? Date.now();
  const maxAgeSeconds = Math.max(30, Math.min(opts.maxAgeSeconds ?? 300, 900));
  if (Math.abs(nowMs / 1000 - timestampSeconds) > maxAgeSeconds) {
    return { ok: false, reason: "expired" };
  }

  if (!constantTimeEquals(bodyHash, sha256Hex(opts.rawBody))) {
    return { ok: false, reason: "body_hash" };
  }

  const expectedSignature = createWorkerRequestSignature({
    secret: opts.secret,
    timestamp,
    nonce,
    bodyHash,
  });
  if (!constantTimeEquals(signature, expectedSignature)) {
    return { ok: false, reason: "signature" };
  }

  const claimed = await opts.claimNonce(
    nonce,
    new Date(nowMs + maxAgeSeconds * 1000),
  );
  return claimed ? { ok: true } : { ok: false, reason: "replay" };
}

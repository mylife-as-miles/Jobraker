// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(content));
  return bytesToHex(new Uint8Array(digest));
}

async function hmacSha256Hex(secret: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(data),
  );
  return bytesToHex(new Uint8Array(signature));
}

/** Timing-safe string comparison to prevent side-channel timing attacks */
function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export interface VerifyWorkerResult {
  valid: boolean;
  reason?: string;
}

export async function verifyWorkerSignature(
  req: Request,
  rawBody: string,
  workerSecret: string,
  serviceClient: any,
): Promise<VerifyWorkerResult> {
  if (!workerSecret) {
    return { valid: false, reason: "worker_secret_not_configured" };
  }

  const timestampHeader = req.headers.get("x-jobraker-worker-timestamp");
  const nonce = req.headers.get("x-jobraker-worker-nonce");
  const bodyHashHeader = req.headers.get("x-jobraker-worker-body-sha256");
  const signatureHeader = req.headers.get("x-jobraker-worker-signature");

  if (!timestampHeader || !nonce || !bodyHashHeader || !signatureHeader) {
    return { valid: false, reason: "missing_worker_security_headers" };
  }

  // 1. Verify timestamp maximum 5 minutes (300 seconds) age
  const timestamp = parseInt(timestampHeader, 10);
  if (Number.isNaN(timestamp)) {
    return { valid: false, reason: "invalid_timestamp" };
  }
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > 300) {
    return { valid: false, reason: "timestamp_expired" };
  }

  // 2. Verify raw body SHA-256 hash match
  const calculatedBodyHash = await sha256Hex(rawBody);
  if (!constantTimeEquals(calculatedBodyHash, bodyHashHeader)) {
    return { valid: false, reason: "body_hash_mismatch" };
  }

  // 3. Verify HMAC-SHA256 signature
  const expectedRawSignature = signatureHeader.replace(/^sha256=/i, "").trim();
  const calculatedSignature = await hmacSha256Hex(
    workerSecret,
    `${timestampHeader}.${nonce}.${calculatedBodyHash}`,
  );

  if (!constantTimeEquals(calculatedSignature, expectedRawSignature)) {
    return { valid: false, reason: "signature_mismatch" };
  }

  // 4. Replay protection check via worker_request_nonces
  if (serviceClient) {
    const { data: replayData, error: replayErr } = await serviceClient
      .from("worker_request_nonces")
      .insert({
        nonce,
        signature: expectedRawSignature,
        expires_at: new Date(Date.now() + 600_000).toISOString(),
      })
      .select("id")
      .maybeSingle();

    if (replayErr || !replayData) {
      return { valid: false, reason: "replayed_nonce_rejected" };
    }
  }

  return { valid: true };
}

/**
 * HMAC-signed tokens so external services (e.g. Skyvern) can GET a resume PDF
 * without Supabase Storage signed URLs (often fail validation from server-side fetchers).
 */

function getSecretBytes(): Promise<ArrayBuffer> {
  const s = Deno.env.get("RESUME_SKYVERN_PROXY_SECRET") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!s) throw new Error("RESUME_SKYVERN_PROXY_SECRET or service role key required");
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
}

async function getHmacKey(): Promise<CryptoKey> {
  const hash = await getSecretBytes();
  return crypto.subtle.importKey(
    "raw",
    hash,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function b64urlEncode(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export type ResumeProxyPayload = {
  /** Storage object path under bucket `resumes`, e.g. `userId/file.pdf` */
  path: string;
  /** Owner user id — must match path prefix */
  uid: string;
  /** Unix seconds */
  exp: number;
};

export async function signResumeProxyToken(
  payload: ResumeProxyPayload,
): Promise<string> {
  const enc = new TextEncoder();
  const body = JSON.stringify(payload);
  const key = await getHmacKey();
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return `${b64urlEncode(enc.encode(body))}.${b64urlEncode(sig)}`;
}

export async function verifyResumeProxyToken(
  token: string,
): Promise<ResumeProxyPayload | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const bodyBytes = b64urlDecode(parts[0]);
    const sigBytes = b64urlDecode(parts[1]);
    const enc = new TextEncoder();
    const key = await getHmacKey();
    const ok = await crypto.subtle.verify("HMAC", key, sigBytes, bodyBytes);
    if (!ok) return null;
    const body = new TextDecoder().decode(bodyBytes);
    const payload = JSON.parse(body) as ResumeProxyPayload;
    if (
      typeof payload.path !== "string" ||
      typeof payload.uid !== "string" ||
      typeof payload.exp !== "number"
    ) {
      return null;
    }
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (!payload.path.startsWith(`${payload.uid}/`)) return null;
    return payload;
  } catch {
    return null;
  }
}

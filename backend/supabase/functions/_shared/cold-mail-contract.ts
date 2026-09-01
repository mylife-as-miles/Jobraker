export type ColdMailConfidence = "high" | "medium";

export type ColdMailPreparation = {
  userId: string;
  jobId: string | null;
  companyName: string;
  jobTitle: string;
  recipient: {
    email: string;
    name?: string;
    title?: string;
    source: string;
    confidence: ColdMailConfidence;
  };
  subject: string;
  body: string;
};

type SignedColdMailPreparation = ColdMailPreparation & { exp: number };

type TokenOptions = {
  nowMs?: number;
  ttlMs?: number;
};

const DEFAULT_TOKEN_TTL_MS = 15 * 60 * 1_000;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const asNonEmptyString = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : "";

const bytesToBase64Url = (bytes: Uint8Array) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
};

const base64UrlToBytes = (value: string) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const importSigningKey = (secret: string) => {
  if (!secret.trim()) throw new Error("Cold Mail signing secret is unavailable.");
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
};

const parseSignedPreparation = (value: unknown): SignedColdMailPreparation => {
  if (!value || typeof value !== "object") {
    throw new Error("Cold Mail preparation token is invalid.");
  }

  const record = value as Record<string, unknown>;
  const recipient = record.recipient as Record<string, unknown> | undefined;
  const confidence = recipient?.confidence;
  const parsed: SignedColdMailPreparation = {
    userId: asNonEmptyString(record.userId),
    jobId: asNonEmptyString(record.jobId) || null,
    companyName: asNonEmptyString(record.companyName),
    jobTitle: asNonEmptyString(record.jobTitle),
    recipient: {
      email: asNonEmptyString(recipient?.email),
      name: asNonEmptyString(recipient?.name) || undefined,
      title: asNonEmptyString(recipient?.title) || undefined,
      source: asNonEmptyString(recipient?.source),
      confidence:
        confidence === "high" || confidence === "medium"
          ? confidence
          : "medium",
    },
    subject: asNonEmptyString(record.subject),
    body: asNonEmptyString(record.body),
    exp: typeof record.exp === "number" ? record.exp : 0,
  };

  if (
    !parsed.userId ||
    !parsed.companyName ||
    !parsed.jobTitle ||
    !parsed.recipient.email ||
    !parsed.recipient.source ||
    !parsed.subject ||
    !parsed.body ||
    !parsed.exp
  ) {
    throw new Error("Cold Mail preparation token is invalid.");
  }

  return parsed;
};

export async function createColdMailPreparationToken(
  preparation: ColdMailPreparation,
  secret: string,
  options: TokenOptions = {},
) {
  const nowMs = options.nowMs ?? Date.now();
  const ttlMs = options.ttlMs ?? DEFAULT_TOKEN_TTL_MS;
  const payload: SignedColdMailPreparation = {
    ...preparation,
    exp: nowMs + ttlMs,
  };
  const payloadSegment = bytesToBase64Url(
    encoder.encode(JSON.stringify(payload)),
  );
  const key = await importSigningKey(secret);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payloadSegment),
  );
  return `${payloadSegment}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

export async function verifyColdMailPreparationToken(
  token: string,
  secret: string,
  options: Pick<TokenOptions, "nowMs"> = {},
): Promise<ColdMailPreparation> {
  const [payloadSegment, signatureSegment, extra] = token.split(".");
  if (!payloadSegment || !signatureSegment || extra) {
    throw new Error("Cold Mail preparation token is invalid.");
  }

  try {
    const key = await importSigningKey(secret);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlToBytes(signatureSegment),
      encoder.encode(payloadSegment),
    );
    if (!valid) throw new Error("Cold Mail preparation token is invalid.");

    const signed = parseSignedPreparation(
      JSON.parse(decoder.decode(base64UrlToBytes(payloadSegment))),
    );
    if (signed.exp <= (options.nowMs ?? Date.now())) {
      throw new Error("Cold Mail preparation token has expired.");
    }

    const { exp: _exp, ...preparation } = signed;
    return preparation;
  } catch (error) {
    if (error instanceof Error && /expired/i.test(error.message)) throw error;
    throw new Error("Cold Mail preparation token is invalid.");
  }
}

export function confirmGmailDraftResult(result: unknown) {
  const record =
    result && typeof result === "object"
      ? (result as Record<string, unknown>)
      : {};
  const draftId = asNonEmptyString(record.draftId);

  if (record.success !== true || !draftId) {
    return {
      success: false as const,
      error:
        record.success === true
          ? "Gmail did not return a draft ID, so draft creation could not be confirmed."
          : asNonEmptyString(record.error) || "Gmail draft creation failed.",
      code:
        record.success === true
          ? "gmail_draft_unconfirmed"
          : asNonEmptyString(record.code) || "gmail_draft_failed",
    };
  }

  return {
    success: true as const,
    draftId,
    messageId: asNonEmptyString(record.messageId) || null,
    threadId: asNonEmptyString(record.threadId) || null,
    draftFrom: asNonEmptyString(record.draftFrom),
    to: asNonEmptyString(record.to),
  };
}

const isEmailAddress = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const isWebUrl = (value: string) => /^https?:\/\/\S+$/i.test(value);

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;

export function selectColdMailRecipient(
  scoutResult: unknown,
): ColdMailPreparation["recipient"] | null {
  const scout = asRecord(scoutResult);
  if (!scout) return null;

  const verifiedRecruiters = (Array.isArray(scout.recruiterContacts)
    ? scout.recruiterContacts
    : [])
    .map(asRecord)
    .filter((contact): contact is Record<string, unknown> => Boolean(contact))
    .filter((contact) => {
      const email = asNonEmptyString(contact.workEmail);
      const status = asNonEmptyString(contact.emailStatus);
      const source = asNonEmptyString(contact.emailSourceUrl);
      return (
        contact.safeToContact === true &&
        isEmailAddress(email) &&
        ["source_verified", "provider_verified"].includes(status) &&
        isWebUrl(source)
      );
    })
    .sort(
      (left, right) =>
        Number(right.relevanceScore || 0) - Number(left.relevanceScore || 0),
    );

  const recruiter = verifiedRecruiters[0];
  if (recruiter) {
    return {
      email: asNonEmptyString(recruiter.workEmail),
      name: asNonEmptyString(recruiter.fullName) || undefined,
      title: asNonEmptyString(recruiter.title) || undefined,
      source: asNonEmptyString(recruiter.emailSourceUrl),
      confidence:
        Number(recruiter.emailConfidence || 0) >= 0.8 ? "high" : "medium",
    };
  }

  const contactEmail = asNonEmptyString(scout.contactEmail);
  if (!isEmailAddress(contactEmail)) return null;

  const evidenceLine = (Array.isArray(scout.publicContactChannels)
    ? scout.publicContactChannels
    : [])
    .map(asNonEmptyString)
    .find(
      (line) =>
        line.toLowerCase().includes("verified recruitment inbox") &&
        line.toLowerCase().includes(contactEmail.toLowerCase()) &&
        /\bsource=https?:\/\//i.test(line),
    );
  const source = evidenceLine?.match(/\bsource=(https?:\/\/\S+)/i)?.[1] || "";
  if (!source) return null;

  return {
    email: contactEmail,
    source,
    confidence: scout.confidence === "high" ? "high" : "medium",
  };
}

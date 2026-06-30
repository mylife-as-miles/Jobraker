import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { getCorsHeaders } from "../_shared/cors.ts";
import {
  SubscriptionAccessError,
  requireSubscriptionTier,
  subscriptionErrorResponse,
} from "../_shared/subscription.ts";

const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  /** Needed for JobRaker Agent job-related outbound mail (recruiter follow-ups, thank-yous). */
  "https://www.googleapis.com/auth/gmail.send",
  /** Needed for approved draft creation and job-search mailbox labels. Existing users may need to reconnect. */
  "https://www.googleapis.com/auth/gmail.modify",
];

type Action = "initiate" | "callback" | "status" | "disconnect";

type RequestBody = {
  action?: Action;
  redirectUri?: string;
  code?: string;
  state?: string;
};

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

type GmailProfileResponse = {
  emailAddress?: string;
  historyId?: string;
};

const encoder = new TextEncoder();

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  corsHeaders: Record<string, string>,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function requireEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function randomToken(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return toBase64(bytes)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function getEncryptionKey() {
  const secret = requireEnv("GMAIL_TOKEN_ENCRYPTION_KEY");
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

async function encryptSecret(value: string | null | undefined) {
  if (!value) return null;
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const key = await getEncryptionKey();
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      encoder.encode(value),
    ),
  );
  return `${toBase64(iv)}.${toBase64(ciphertext)}`;
}

async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
): Promise<GoogleTokenResponse> {
  const params = new URLSearchParams({
    client_id: requireEnv("GOOGLE_GMAIL_CLIENT_ID"),
    client_secret: requireEnv("GOOGLE_GMAIL_CLIENT_SECRET"),
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  const data = await response.json() as GoogleTokenResponse;
  if (!response.ok) {
    throw new Error(
      data.error_description || data.error || "Google token exchange failed",
    );
  }
  return data;
}

async function getGmailProfile(accessToken: string) {
  const response = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/profile",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!response.ok) {
    return null;
  }

  return await response.json() as GmailProfileResponse;
}

function validateRedirectUri(value: unknown, origin: string | null) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("redirectUri is required");
  }

  const redirectUri = new URL(value);
  if (origin) {
    const originUrl = new URL(origin);
    if (redirectUri.origin !== originUrl.origin) {
      throw new Error("redirectUri origin does not match request origin");
    }
  }
  if (redirectUri.pathname !== "/auth/callback/gmail") {
    throw new Error("redirectUri must use /auth/callback/gmail");
  }
  return redirectUri.toString();
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin") || undefined);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, corsHeaders);
  }

  try {
    const { user, serviceClient } = await requireSubscriptionTier(
      req,
      "Pro",
      "Gmail integration",
    );

    const body = await req.json().catch(() => ({})) as RequestBody;
    const action = body.action || "status";

    if (action === "initiate") {
      const redirectUri = validateRedirectUri(
        body.redirectUri,
        req.headers.get("origin"),
      );
      const state = randomToken();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      await serviceClient
        .from("gmail_oauth_states")
        .delete()
        .lt("expires_at", new Date().toISOString());

      const { error: stateError } = await serviceClient
        .from("gmail_oauth_states")
        .insert({
          state,
          user_id: user.id,
          redirect_uri: redirectUri,
          expires_at: expiresAt,
        });
      if (stateError) throw stateError;

      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.search = new URLSearchParams({
        client_id: requireEnv("GOOGLE_GMAIL_CLIENT_ID"),
        redirect_uri: redirectUri,
        response_type: "code",
        scope: GMAIL_SCOPES.join(" "),
        access_type: "offline",
        include_granted_scopes: "true",
        prompt: "consent",
        state,
      }).toString();

      return jsonResponse({ redirectUrl: authUrl.toString() }, 200, corsHeaders);
    }

    if (action === "callback") {
      if (!body.code || !body.state) {
        return jsonResponse(
          { error: "code and state are required" },
          400,
          corsHeaders,
        );
      }

      const { data: stateRow, error: stateError } = await serviceClient
        .from("gmail_oauth_states")
        .select("state, user_id, redirect_uri, expires_at")
        .eq("state", body.state)
        .eq("user_id", user.id)
        .maybeSingle();
      if (stateError) throw stateError;
      if (!stateRow || Date.parse(stateRow.expires_at) < Date.now()) {
        return jsonResponse(
          { error: "Gmail authorization expired. Please connect again." },
          400,
          corsHeaders,
        );
      }

      const tokens = await exchangeCodeForTokens(
        body.code,
        stateRow.redirect_uri,
      );
      if (!tokens.access_token) {
        throw new Error("Google did not return an access token");
      }

      const { data: existingConnection } = await serviceClient
        .from("gmail_connections")
        .select("refresh_token_ciphertext")
        .eq("user_id", user.id)
        .maybeSingle();

      const profile = await getGmailProfile(tokens.access_token);
      const tokenExpiresAt = new Date(
        Date.now() + Math.max(30, tokens.expires_in || 3600) * 1000,
      ).toISOString();
      const refreshTokenCiphertext = tokens.refresh_token
        ? await encryptSecret(tokens.refresh_token)
        : existingConnection?.refresh_token_ciphertext ?? null;

      if (!refreshTokenCiphertext) {
        throw new Error(
          "Google did not return a refresh token. Revoke JobRaker access in Google Account permissions, then connect Gmail again.",
        );
      }

      const { error: upsertError } = await serviceClient
        .from("gmail_connections")
        .upsert(
          {
            user_id: user.id,
            email: profile?.emailAddress ?? user.email ?? null,
            scope: (tokens.scope || GMAIL_SCOPES.join(" ")).split(/\s+/),
            access_token_ciphertext: await encryptSecret(tokens.access_token),
            refresh_token_ciphertext: refreshTokenCiphertext,
            token_expires_at: tokenExpiresAt,
            sync_history_id: profile?.historyId ?? null,
            connected_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );
      if (upsertError) throw upsertError;

      await serviceClient
        .from("gmail_oauth_states")
        .delete()
        .eq("state", body.state);

      return jsonResponse(
        { ok: true, email: profile?.emailAddress ?? user.email ?? null },
        200,
        corsHeaders,
      );
    }

    if (action === "disconnect") {
      const { error } = await serviceClient
        .from("gmail_connections")
        .delete()
        .eq("user_id", user.id);
      if (error) throw error;
      return jsonResponse({ ok: true, isConnected: false }, 200, corsHeaders);
    }

    const { data: connection, error } = await serviceClient
      .from("gmail_connections")
      .select("email, connected_at, last_sync_at, token_expires_at")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;

    return jsonResponse(
      {
        isConnected: Boolean(connection),
        email: connection?.email ?? null,
        connectedAt: connection?.connected_at ?? null,
        lastSyncAt: connection?.last_sync_at ?? null,
        tokenExpiresAt: connection?.token_expires_at ?? null,
      },
      200,
      corsHeaders,
    );
  } catch (error) {
    if (error instanceof SubscriptionAccessError) {
      return subscriptionErrorResponse(error, corsHeaders);
    }
    console.error("gmail-auth error", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Gmail auth failed" },
      500,
      corsHeaders,
    );
  }
});

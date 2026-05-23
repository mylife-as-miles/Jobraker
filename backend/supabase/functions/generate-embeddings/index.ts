import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { embedBatch, embedText } from "../_shared/embeddings.ts";
import {
  requireAuthenticatedUser,
  SubscriptionAccessError,
  subscriptionErrorResponse,
} from "../_shared/subscription.ts";

const MAX_BATCH_SIZE = 32;
const MAX_TEXT_LENGTH = 8000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const rateLimitBuckets = new Map<string, number[]>();

const jsonResponse = (body: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, corsHeaders);
  }

  try {
    // Authenticate request before invoking embedding models
    const { user } = await requireAuthenticatedUser(req);

    const now = Date.now();
    const recentRequests = (rateLimitBuckets.get(user.id) || []).filter(
      (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS,
    );
    if (recentRequests.length >= RATE_LIMIT_MAX_REQUESTS) {
      rateLimitBuckets.set(user.id, recentRequests);
      return jsonResponse({ error: "Rate limit exceeded. Try again shortly." }, 429, corsHeaders);
    }
    recentRequests.push(now);
    rateLimitBuckets.set(user.id, recentRequests);

    const body = await req.json();
    const { text, texts, model } = body;

    if (Array.isArray(texts)) {
      if (texts.length > MAX_BATCH_SIZE) {
        return jsonResponse(
          { error: `Batch size must be ${MAX_BATCH_SIZE} or fewer texts.` },
          400,
          corsHeaders,
        );
      }
      if (!texts.every((item) => typeof item === "string")) {
        return jsonResponse({ error: "'texts' must contain only strings." }, 400, corsHeaders);
      }
      if (texts.some((item) => item.length > MAX_TEXT_LENGTH)) {
        return jsonResponse(
          { error: `Each text must be ${MAX_TEXT_LENGTH} characters or fewer.` },
          400,
          corsHeaders,
        );
      }

      const embeddings = await embedBatch(texts, { model });
      return jsonResponse({ embeddings, userId: user.id }, 200, corsHeaders);
    }

    if (typeof text === "string") {
      if (text.length > MAX_TEXT_LENGTH) {
        return jsonResponse(
          { error: `Text must be ${MAX_TEXT_LENGTH} characters or fewer.` },
          400,
          corsHeaders,
        );
      }

      const embedding = await embedText(text, { model });
      return jsonResponse({ embedding, userId: user.id }, 200, corsHeaders);
    }

    return jsonResponse(
      { error: "Provide 'text' (string) or 'texts' (array of strings)." },
      400,
      corsHeaders,
    );
  } catch (error: any) {
    if (error instanceof SubscriptionAccessError) {
      return subscriptionErrorResponse(error, corsHeaders);
    }
    console.error("Embeddings function error:", error);
    return jsonResponse({ error: error.message }, 500, corsHeaders);
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { embedBatch, embedText } from "../_shared/embeddings.ts";
import {
  requireAuthenticatedUser,
  SubscriptionAccessError,
  subscriptionErrorResponse,
} from "../_shared/subscription.ts";
import {
  enforceFeatureRateLimit,
  recordFeatureUsage,
} from "../_shared/feature-limits.ts";

const MAX_BATCH_SIZE = 32;
const MAX_TEXT_LENGTH = 8000;

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
    const { user, serviceClient } = await requireAuthenticatedUser(req);
    const subscriptionTier = await enforceFeatureRateLimit({
      userId: user.id,
      featureKey: "generate_embeddings",
      serviceClient,
    });

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
      await recordFeatureUsage({
        userId: user.id,
        featureKey: "generate_embeddings",
        serviceClient,
        subscriptionTier,
        metadata: {
          mode: "batch",
          batch_size: texts.length,
        },
      });
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
      await recordFeatureUsage({
        userId: user.id,
        featureKey: "generate_embeddings",
        serviceClient,
        subscriptionTier,
        metadata: {
          mode: "single",
        },
      });
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

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { getCorsHeaders } from "../_shared/cors.ts";
import {
  AnswerTheme,
  generateAnswerBankEntries,
  upsertGeneratedAnswerBankEntries,
} from "../_shared/answer-bank.ts";
import {
  requireAuthenticatedUser,
  SubscriptionAccessError,
  subscriptionErrorResponse,
} from "../_shared/subscription.ts";

const ALL_THEMES: AnswerTheme[] = [
  "identity",
  "beliefs",
  "stories",
  "career",
  "skills",
  "voice",
];

function normalizeThemes(value: unknown): AnswerTheme[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const themes = value
    .map((item) => (typeof item === "string" ? item.trim().toLowerCase() : ""))
    .filter((item): item is AnswerTheme => ALL_THEMES.includes(item as AnswerTheme));
  return themes.length > 0 ? [...new Set(themes)] : undefined;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"), req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { user, serviceClient } = await requireAuthenticatedUser(req);
    const body = await req.json().catch(() => ({}));

    const themes = normalizeThemes((body as Record<string, unknown>)?.themes);
    const limit = asNumber((body as Record<string, unknown>)?.limit) ?? undefined;
    const replaceExisting = (body as Record<string, unknown>)?.replace_existing === true;

    const generated = await generateAnswerBankEntries(serviceClient, user.id, {
      themes,
      limit: limit ?? undefined,
    });

    const result = await upsertGeneratedAnswerBankEntries(
      serviceClient,
      user.id,
      generated,
      { replaceExisting },
    );

    return new Response(
      JSON.stringify({
        success: true,
        inserted: result.inserted,
        updated: result.updated,
        generated_count: generated.length,
        entries: result.entries,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    if (error instanceof SubscriptionAccessError) {
      return subscriptionErrorResponse(error, corsHeaders);
    }
    console.error("generate-answer-bank failed", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to generate answer bank entries",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

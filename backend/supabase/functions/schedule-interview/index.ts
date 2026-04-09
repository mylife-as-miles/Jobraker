import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders } from "../_shared/cors.ts"
import { generateGeminiContent } from "../_shared/gemini.ts";
import {
  SubscriptionAccessError,
  requireSubscriptionTier,
  subscriptionErrorResponse,
} from "../_shared/subscription.ts";

export const buildPrompt = (emailText: string, applicantName: string, companyName: string): string => {
  return `You are an AI Interview Scheduling Assistant helping "${applicantName}" respond to a recruiter from "${companyName}".

Here is the email from the recruiter:
"""
${emailText}
"""

Your task:
1. Extract any direct calendar booking links (e.g., Calendly, Google Calendar appointment, Hubspot) present in the email.
2. If there are NO booking links, draft a polite, professional reply offering the applicant's availability. State placeholders like "[Insert your available times here]" for the applicant to fill in.
3. If there IS a booking link, point it out clearly and also provide a short, polite confirmation reply the applicant can send after booking.

Respond *only* in the following JSON format:
{
  "booking_link": "URL or null if none found",
  "suggested_reply": "String containing the drafted reply"
}
`;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    await requireSubscriptionTier(
      req,
      "Pro",
      "Interview scheduling assistant",
    );

    const { emailText, applicantName, companyName } = await req.json();

    if (!emailText) {
      return new Response(JSON.stringify({ error: 'Missing emailText' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const prompt = buildPrompt(emailText, applicantName || "the applicant", companyName || "the company");

    const jsonResponseText = await generateGeminiContent(prompt, {
      temperature: 0.2, // Low temperature for more deterministic/factual extraction
      response_mime_type: "application/json"
    });

    return new Response(jsonResponseText, {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (error instanceof SubscriptionAccessError) {
      return subscriptionErrorResponse(error, corsHeaders);
    }
    console.error('Error generating schedule response:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

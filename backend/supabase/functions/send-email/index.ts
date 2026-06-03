import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

type SendEmailPayload = {
  to?: string | string[];
  subject?: string;
  html?: string;
  text?: string;
  from?: string;
  reply_to?: string;
  replyTo?: string;
};

function isAuthorized(req: Request): boolean {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const sendEmailSecret = Deno.env.get("SEND_EMAIL_SECRET") || "";

  return Boolean(
    token &&
      ((serviceRoleKey && token === serviceRoleKey) ||
        (sendEmailSecret && token === sendEmailSecret)),
  );
}

function normalizeRecipients(to: string | string[] | undefined): string[] {
  if (Array.isArray(to)) {
    return to.map((value) => String(value).trim()).filter(Boolean);
  }
  const trimmed = String(to || "").trim();
  return trimmed ? [trimmed] : [];
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"), req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  if (!isAuthorized(req)) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    return new Response("RESEND_API_KEY is not configured", {
      status: 500,
      headers: corsHeaders,
    });
  }

  let payload: SendEmailPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON payload", { status: 400, headers: corsHeaders });
  }

  const to = normalizeRecipients(payload.to);
  const subject = String(payload.subject || "").trim();
  const html = typeof payload.html === "string" ? payload.html : undefined;
  const text = typeof payload.text === "string" ? payload.text : undefined;

  if (to.length === 0 || !subject || (!html && !text)) {
    return new Response("Missing to, subject, and html or text", {
      status: 400,
      headers: corsHeaders,
    });
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: payload.from || Deno.env.get("RESEND_FROM_EMAIL") || "Jobraker <noreply@jobraker.io>",
      to,
      subject,
      ...(html ? { html } : {}),
      ...(text ? { text } : {}),
      ...(payload.reply_to || payload.replyTo
        ? { reply_to: payload.reply_to || payload.replyTo }
        : {}),
    }),
  });

  const responseText = await response.text();
  return new Response(responseText, {
    status: response.status,
    headers: {
      ...corsHeaders,
      "Content-Type": response.headers.get("Content-Type") || "application/json",
    },
  });
});

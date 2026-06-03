import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/types.ts";

const RATE_LIMIT_WINDOW_MS = 10 * 60_000;
const RATE_LIMIT_MAX_REQUESTS = 5;
const publicRateLimitBuckets = new Map<string, number[]>();

function getRequesterKey(req: Request): string {
  const forwardedFor = String(req.headers.get("x-forwarded-for") || "")
    .split(",")[0]
    .trim();
  const realIp = String(req.headers.get("x-real-ip") || "").trim();
  return forwardedFor || realIp || "unknown";
}

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (publicRateLimitBuckets.get(key) || []).filter(
    (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS,
  );
  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    publicRateLimitBuckets.set(key, recent);
    return true;
  }
  recent.push(now);
  publicRateLimitBuckets.set(key, recent);
  return false;
}

async function sendResendEmail(args: {
  to: string;
  subject: string;
  text: string;
  html: string;
}) {
  const apiKey = String(Deno.env.get("RESEND_API_KEY") || "").trim();
  if (!apiKey) {
    return { sent: false, reason: "missing_resend_api_key" };
  }

  if (!args.to) {
    return { sent: false, reason: "missing_alert_email" };
  }

  const sender = String(Deno.env.get("RESEND_FROM_EMAIL") || "").trim() || "JobRaker Early Access <onboarding@resend.dev>";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: sender,
      to: args.to,
      subject: args.subject,
      text: args.text,
      html: args.html,
    }),
  });

  const payload = await response.json().catch(async () => ({
    raw: await response.text().catch(() => ""),
  }));

  if (!response.ok) {
    console.error("request-early-access.resend_failed", {
      status: response.status,
      payload,
    });
    return { sent: false, reason: "resend_error", status: response.status, payload };
  }

  return { sent: true, data: payload };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders() });
  }

  try {
    if (isRateLimited(getRequesterKey(req))) {
      return new Response(
        JSON.stringify({ error: "Too many requests. Please try again later." }),
        { status: 429, headers: { ...getCorsHeaders(), "Content-Type": "application/json" } }
      );
    }

    const { firstName, lastName, companyEmail, interest, accomplish } = await req.json();

    if (!firstName || !lastName || !companyEmail) {
      return new Response(
        JSON.stringify({ error: "First Name, Last Name, and Company Email are required." }),
        { status: 400, headers: { ...getCorsHeaders(), "Content-Type": "application/json" } }
      );
    }

    const adminEmail = String(Deno.env.get("RESEND_OWNER_EMAIL") || Deno.env.get("RESEND_ACCOUNT_EMAIL") || "").trim();

    if (!adminEmail) {
      console.error("Missing admin email configuration to send early access request.");
      return new Response(
        JSON.stringify({ error: "Internal Server Error: Missing email configuration." }),
        { status: 500, headers: { ...getCorsHeaders(), "Content-Type": "application/json" } }
      );
    }

    const subject = `New Early Access Request: ${firstName} ${lastName}`;
    const text = `
New Early Access Request received:

Name: ${firstName} ${lastName}
Email: ${companyEmail}
Interested In: ${interest || 'N/A'}
Goal/Accomplishment: ${accomplish || 'N/A'}
    `.trim();

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
        <h2 style="margin: 0 0 12px;">New Early Access Request</h2>
        <p>A new user has requested early access:</p>
        <ul>
          <li><strong>Name:</strong> ${firstName} ${lastName}</li>
          <li><strong>Email:</strong> ${companyEmail}</li>
          <li><strong>Interested In:</strong> ${interest || 'N/A'}</li>
          <li><strong>Goal/Accomplishment:</strong> <br/> ${accomplish ? accomplish.replace(/\n/g, '<br/>') : 'N/A'}</li>
        </ul>
      </div>
    `;

    const result = await sendResendEmail({
      to: adminEmail,
      subject,
      text,
      html,
    });

    if (!result.sent) {
      throw new Error(`Failed to send email: ${result.reason}`);
    }

    return new Response(JSON.stringify({ success: true, message: "Early access request submitted successfully." }), {
      headers: { ...getCorsHeaders(), "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Error processing early access request:", error);
    return new Response(
      JSON.stringify({ error: error.message || "An unexpected error occurred." }),
      { status: 500, headers: { ...getCorsHeaders(), "Content-Type": "application/json" } }
    );
  }
});

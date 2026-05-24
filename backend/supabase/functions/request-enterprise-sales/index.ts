import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

type EnterpriseSalesPayload = {
  firstName?: string;
  lastName?: string;
  companyName?: string;
  jobTitle?: string;
  businessEmail?: string;
  website?: string;
  teamSize?: string;
  monthlyHiringVolume?: string;
  rolloutTimeline?: string;
  useCase?: string;
};

function sanitizeText(value: unknown) {
  return String(value ?? "").trim();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatLine(label: string, value: string) {
  return `${label}: ${value || "N/A"}`;
}

async function sendResendEmail(args: {
  to: string;
  subject: string;
  text: string;
  html: string;
}) {
  const apiKey = sanitizeText(Deno.env.get("RESEND_API_KEY"));
  if (!apiKey) {
    return { sent: false, reason: "missing_resend_api_key" };
  }

  if (!args.to) {
    return { sent: false, reason: "missing_alert_email" };
  }

  const sender =
    sanitizeText(Deno.env.get("RESEND_FROM_EMAIL")) ||
    "JobRaker Enterprise Sales <onboarding@resend.dev>";

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
    console.error("request-enterprise-sales.resend_failed", {
      status: response.status,
      payload,
    });
    return {
      sent: false,
      reason: "resend_error",
      status: response.status,
      payload,
    };
  }

  return { sent: true, data: payload };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"), req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as EnterpriseSalesPayload;

    const firstName = sanitizeText(body.firstName);
    const lastName = sanitizeText(body.lastName);
    const companyName = sanitizeText(body.companyName);
    const jobTitle = sanitizeText(body.jobTitle);
    const businessEmail = sanitizeText(body.businessEmail);
    const website = sanitizeText(body.website);
    const teamSize = sanitizeText(body.teamSize);
    const monthlyHiringVolume = sanitizeText(body.monthlyHiringVolume);
    const rolloutTimeline = sanitizeText(body.rolloutTimeline);
    const useCase = sanitizeText(body.useCase);

    if (
      !firstName ||
      !lastName ||
      !companyName ||
      !jobTitle ||
      !businessEmail ||
      !teamSize ||
      !rolloutTimeline ||
      !useCase
    ) {
      return new Response(
        JSON.stringify({
          error:
            "First name, last name, company name, job title, business email, team size, rollout timeline, and use case are required.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const adminEmail = sanitizeText(
      Deno.env.get("RESEND_OWNER_EMAIL") ||
        Deno.env.get("RESEND_ACCOUNT_EMAIL") ||
        "",
    );

    if (!adminEmail) {
      console.error(
        "request-enterprise-sales.missing_admin_email_configuration",
      );
      return new Response(
        JSON.stringify({
          error: "Internal Server Error: Missing email configuration.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const fullName = `${firstName} ${lastName}`.trim();
    const subject = `New Enterprise Sales Request: ${companyName}`;

    const text = [
      "New JobRaker enterprise sales request received.",
      "",
      formatLine("Name", fullName),
      formatLine("Company", companyName),
      formatLine("Job title", jobTitle),
      formatLine("Business email", businessEmail),
      formatLine("Website", website),
      formatLine("Team size", teamSize),
      formatLine("Monthly hiring or candidate volume", monthlyHiringVolume),
      formatLine("Rollout timeline", rolloutTimeline),
      formatLine("Use case", useCase),
    ].join("\n");

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <h2 style="margin: 0 0 12px;">New Enterprise Sales Request</h2>
        <p style="margin: 0 0 16px;">A team submitted an enterprise contact request from JobRaker.</p>
        <table cellpadding="0" cellspacing="0" style="border-collapse: collapse; width: 100%;">
          <tbody>
            <tr><td style="padding: 6px 0;"><strong>Name:</strong></td><td style="padding: 6px 0;">${escapeHtml(fullName)}</td></tr>
            <tr><td style="padding: 6px 0;"><strong>Company:</strong></td><td style="padding: 6px 0;">${escapeHtml(companyName)}</td></tr>
            <tr><td style="padding: 6px 0;"><strong>Job title:</strong></td><td style="padding: 6px 0;">${escapeHtml(jobTitle)}</td></tr>
            <tr><td style="padding: 6px 0;"><strong>Business email:</strong></td><td style="padding: 6px 0;">${escapeHtml(businessEmail)}</td></tr>
            <tr><td style="padding: 6px 0;"><strong>Website:</strong></td><td style="padding: 6px 0;">${escapeHtml(website || "N/A")}</td></tr>
            <tr><td style="padding: 6px 0;"><strong>Team size:</strong></td><td style="padding: 6px 0;">${escapeHtml(teamSize)}</td></tr>
            <tr><td style="padding: 6px 0;"><strong>Monthly volume:</strong></td><td style="padding: 6px 0;">${escapeHtml(monthlyHiringVolume || "N/A")}</td></tr>
            <tr><td style="padding: 6px 0;"><strong>Rollout timeline:</strong></td><td style="padding: 6px 0;">${escapeHtml(rolloutTimeline)}</td></tr>
          </tbody>
        </table>
        <div style="margin-top: 18px;">
          <strong>Use case</strong>
          <p style="margin: 8px 0 0;">${escapeHtml(useCase).replace(/\n/g, "<br/>")}</p>
        </div>
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

    return new Response(
      JSON.stringify({
        success: true,
        message: "Enterprise sales request submitted successfully.",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("request-enterprise-sales.error", error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred.",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

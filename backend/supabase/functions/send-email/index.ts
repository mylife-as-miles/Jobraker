import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts";
import { corsHeaders } from "../_shared/cors.ts";

// This edge function uses Zoho's SMTP to send emails.
// It requires ZOHO_EMAIL and ZOHO_PASSWORD secrets to be set in your Supabase project.

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const { to, subject, html_content } = payload;

    if (!to || !subject || !html_content) {
      return new Response(JSON.stringify({ error: "Missing required fields: to, subject, html_content" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emailAccount = Deno.env.get("ZOHO_EMAIL");
    const emailPassword = Deno.env.get("ZOHO_PASSWORD");

    if (!emailAccount || !emailPassword) {
      console.error("Missing Zoho credentials in Edge Function Secrets");
      return new Response(
        JSON.stringify({ error: "Server configuration error: missing email credentials." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const client = new SmtpClient();

    // Use Zoho SMTP config
    await client.connectTLS({
      hostname: "smtp.zoho.com",
      port: 465,
      username: emailAccount,
      password: emailPassword,
    });

    await client.send({
      from: emailAccount,
      to: to,
      subject: subject,
      content: html_content,
      html: html_content,
    });

    await client.close();

    return new Response(JSON.stringify({ success: true, message: "Email dispatched successfully via Zoho SMTP." }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error sending email:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error sending email",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

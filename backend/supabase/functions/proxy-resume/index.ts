// @ts-nocheck
// Public GET endpoint: Skyvern (and similar) fetch resume PDFs without using
// Supabase Storage signed URLs, which often fail from third-party servers.
import { getCorsHeaders } from "../_shared/types.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyResumeProxyToken } from "../_shared/resume-proxy-token.ts";

function contentTypeForFilename(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf":
      return "application/pdf";
    case "doc":
      return "application/msword";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "txt":
      return "text/plain; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin") || undefined);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("t") || "";
    const payload = await verifyResumeProxyToken(token);
    if (!payload) {
      return new Response("Invalid or expired token", {
        status: 401,
        headers: { ...corsHeaders, "content-type": "text/plain" },
      });
    }

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceKey) {
      return new Response("Server misconfigured", { status: 500 });
    }

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey, {
      auth: { persistSession: false },
    });

    const { data, error } = await sb.storage.from("resumes").download(payload.path);
    if (error || !data) {
      console.error("proxy-resume download", error?.message);
      return new Response("File not found", {
        status: 404,
        headers: { ...corsHeaders, "content-type": "text/plain" },
      });
    }

    const buf = await data.arrayBuffer();
    const filename = payload.path.split("/").pop() || "resume.pdf";
    const safeFilename = filename.replace(/"/g, "");

    return new Response(buf, {
      status: 200,
      headers: {
        ...corsHeaders,
        "content-type": contentTypeForFilename(filename),
        "cache-control": "private, max-age=300",
        "content-disposition": `attachment; filename="${safeFilename}"`,
      },
    });
  } catch (e: any) {
    console.error("proxy-resume", e);
    return new Response(e?.message || "Error", { status: 500 });
  }
});

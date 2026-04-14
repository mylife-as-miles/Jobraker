import { getCorsHeaders } from "../_shared/types.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin || undefined);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const urlStr = new URL(req.url).searchParams.get("url");
  if (!urlStr) {
    return new Response(JSON.stringify({ error: "Missing url parameter" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const response = await fetch(urlStr, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Jobraker/1.0)",
        "Accept": "image/*, */*",
      },
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: `Error fetching image: ${response.statusText}`, status: response.status }),
        {
          status: response.status >= 400 && response.status < 600 ? response.status : 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const contentType = response.headers.get("Content-Type") || "image/png";
    const buffer = await response.arrayBuffer();

    return new Response(buffer, {
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: `Fetch error: ${err.message}` }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

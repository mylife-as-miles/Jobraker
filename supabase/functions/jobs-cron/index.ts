// @ts-nocheck
// Supabase Edge Function: jobs-cron
// - Fetch jobs from external sources (default: Remotive)
// - Upsert into Postgres jobs table
// - Optionally mirror to Firebase Firestore via REST using a service account

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { importPKCS8, SignJWT } from "npm:jose@5.2.4";

type Job = {
  external_id: string;
  title: string;
  company: string;
  location: string | null;
  url: string;
  source: string;
  posted_at: string; // ISO string
  description?: string | null;
  tags?: string[] | null;
  salary_min?: number | null;
  salary_max?: number | null;
  work_type?: string | null;
};

async function fetchRemotive(query = "software"): Promise<Job[]> {
  const endpoint = `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(query)}`;
  const res = await fetch(endpoint, { headers: { "accept": "application/json" } });
  if (!res.ok) throw new Error(`Remotive fetch failed: ${res.status}`);
  const json: any = await res.json();
  const jobs: Job[] = (json?.jobs || []).map((j: any) => ({
    external_id: String(j?.id ?? j?.url ?? crypto.randomUUID()),
    title: j?.title ?? "",
    company: j?.company_name ?? "",
    location: j?.candidate_required_location ?? null,
    url: j?.url ?? "",
    source: "remotive",
    posted_at: j?.publication_date ? new Date(j.publication_date).toISOString() : new Date().toISOString(),
    description: j?.description ?? null,
    tags: Array.isArray(j?.tags) ? j.tags : null,
    work_type: "Remote",
  }));
  return jobs;
}

async function fetchRemoteOK(): Promise<Job[]> {
  // Free API, sometimes rate-limited
  const res = await fetch("https://remoteok.com/api", { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`RemoteOK fetch failed: ${res.status}`);
  const data: any[] = await res.json();
  const rows = Array.isArray(data) ? data : [];
  return rows
    .filter((j: any) => j && j.id && j.url)
    .map((j: any) => ({
      external_id: String(j.id),
      title: j.position || j.title || "",
      company: j.company || "",
      location: (j.location || j.candidate_required_location || null),
      url: j.url,
      source: "remoteok",
      posted_at: j.date ? new Date(j.date).toISOString() : new Date().toISOString(),
      description: j.description || null,
      tags: Array.isArray(j.tags) ? j.tags : null,
      salary_min: j.salary_min ?? null,
      salary_max: j.salary_max ?? null,
      work_type: "Remote",
    }));
}

async function fetchArbeitNow(query = "software"): Promise<Job[]> {
  // Arbeitnow jobs board JSON feed
  const res = await fetch(`https://www.arbeitnow.com/api/job-board-api?search=${encodeURIComponent(query)}`, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`ArbeitNow fetch failed: ${res.status}`);
  const json: any = await res.json();
  const list: any[] = json?.data || [];
  return list.map((j: any) => ({
    external_id: String(j.slug || j.id || j.url || crypto.randomUUID()),
    title: j.title || "",
    company: j.company || (j.company_name || ""),
    location: (j.location || j.remote || null),
    url: j.url,
    source: "arbeitnow",
    posted_at: j.created_at ? new Date(j.created_at).toISOString() : new Date().toISOString(),
    description: j.description || null,
    tags: Array.isArray(j.tags) ? j.tags : null,
    salary_min: j.salary_min ?? null,
    salary_max: j.salary_max ?? null,
    work_type: j.remote === true ? "Remote" : null,
  }));
}

async function fetchFromSources(): Promise<Job[]> {
  const envSources = Deno.env.get("JOB_SOURCES");
  if (!envSources) {
    // default single source
    return await fetchRemotive("software engineer");
  }
  let sources: { type: string; url?: string; query?: string }[] = [];
  try { sources = JSON.parse(envSources); } catch { /* ignore */ }
  const results: Job[] = [];
  for (const s of sources) {
    try {
      if (s.type === "remotive") {
        results.push(...await fetchRemotive(s.query || "software"));
      } else if (s.type === "remoteok") {
        results.push(...await fetchRemoteOK());
      } else if (s.type === "arbeitnow") {
        results.push(...await fetchArbeitNow(s.query || "software"));
      } else if (s.type === "json" && s.url) {
        const r = await fetch(s.url, { headers: { accept: "application/json" } });
        if (r.ok) {
          const data: any[] = await r.json();
          for (const it of data) {
            results.push({
              external_id: String(it.external_id ?? it.id ?? crypto.randomUUID()),
              title: it.title,
              company: it.company,
              location: it.location ?? null,
              url: it.url,
              source: it.source ?? new URL(s.url).hostname,
              posted_at: it.posted_at ? new Date(it.posted_at).toISOString() : new Date().toISOString(),
              description: it.description ?? null,
              tags: Array.isArray(it.tags) ? it.tags : null,
              salary_min: it.salary_min ?? null,
              salary_max: it.salary_max ?? null,
              work_type: it.work_type ?? null,
            });
          }
        }
      }
    } catch (e) {
      console.error("Source fetch error", s, e);
    }
  }
  return results;
}

async function upsertIntoSupabase(jobs: Job[]) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, serviceKey);

  // Upsert in chunks
  const chunkSize = 200;
  let upserted = 0;
  for (let i = 0; i < jobs.length; i += chunkSize) {
    const chunk = jobs.slice(i, i + chunkSize);
    const rows = chunk.map(j => ({
      source: j.source,
      external_id: j.external_id,
      job_title: j.title,
      company_name: j.company,
      location: j.location,
      source_url: j.url,
      posted_at: j.posted_at,
      full_job_description: j.description ?? null,
      work_type: j.work_type ?? (j.source === "remotive" || j.source === "remoteok" ? "Remote" : null),
      tags: j.tags ?? null,
      salary_min: j.salary_min ?? null,
      salary_max: j.salary_max ?? null,
      updated_at: new Date().toISOString(),
    }));

    // Upsert by unique source_url
    const { error, count } = await supabase
      .from("job_listings")
      .upsert(rows, { onConflict: "source_url", ignoreDuplicates: false, count: "estimated" });
    if (error) throw error;
    upserted += count ?? chunk.length;
  }
  return upserted;
}

type ServiceAccount = {
  client_email: string;
  private_key: string;
  project_id: string;
};

async function getGoogleAccessToken(sa: ServiceAccount, scope: string) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: sa.client_email,
    scope,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  } as const;
  const key = await importPKCS8(sa.private_key, "RS256");
  const jwt = await new SignJWT(payload)
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .sign(key);
  const form = new URLSearchParams();
  form.set("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer");
  form.set("assertion", jwt);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form,
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);
  const json = await res.json();
  return json.access_token as string;
}

async function pushToFirestore(jobs: Job[]) {
  const saRaw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
  const projectId = Deno.env.get("FIREBASE_PROJECT_ID");
  const collection = Deno.env.get("FIREBASE_COLLECTION") || "jobs";
  if (!saRaw || !projectId) return { pushed: 0 };
  let sa: ServiceAccount;
  try { sa = JSON.parse(saRaw); } catch { throw new Error("Invalid FIREBASE_SERVICE_ACCOUNT JSON"); }
  const accessToken = await getGoogleAccessToken(sa, "https://www.googleapis.com/auth/datastore");

  // Batch write in chunks of 500
  let pushed = 0;
  for (let i = 0; i < jobs.length; i += 400) {
    const batch = jobs.slice(i, i + 400);
    const writes = batch.map((j) => ({
      upsert: {
        name: `projects/${projectId}/databases/(default)/documents/${collection}/${j.source}_${j.external_id}`,
        fields: {
          title: { stringValue: j.title },
          company: { stringValue: j.company },
          location: j.location ? { stringValue: j.location } : { nullValue: null },
          url: { stringValue: j.url },
          source: { stringValue: j.source },
          posted_at: { timestampValue: j.posted_at },
          description: j.description ? { stringValue: j.description } : { nullValue: null },
          tags: j.tags ? { arrayValue: { values: j.tags.map(t => ({ stringValue: t })) } } : { nullValue: null },
          salary_min: j.salary_min != null ? { integerValue: String(j.salary_min) } : { nullValue: null },
          salary_max: j.salary_max != null ? { integerValue: String(j.salary_max) } : { nullValue: null },
        }
      }
    }));
    const res = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:batchWrite`, {
      method: "POST",
      headers: { "authorization": `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify({ writes }),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Firestore batchWrite failed: ${res.status} ${txt}`);
    }
    pushed += batch.length;
  }
  return { pushed };
}

async function handler(req: Request) {
  const start = Date.now();
  try {
    const jobs = await fetchFromSources();
    const unique = new Map<string, Job>();
    for (const j of jobs) {
      const key = `${j.source}:${j.external_id}`;
      if (!unique.has(key)) unique.set(key, j);
    }
    const arr = Array.from(unique.values());

    const upserted = await upsertIntoSupabase(arr);
    const { pushed } = await pushToFirestore(arr);

    const ms = Date.now() - start;
    return new Response(JSON.stringify({ ok: true, fetched: jobs.length, unique: arr.length, upserted, pushed, ms }), {
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { "content-type": "application/json" } });
  }
}

Deno.serve(handler);

// Optional: run on a schedule using Deno.cron when deployed on Supabase
try {
  const cronExpr = Deno.env.get("JOBS_CRON_EXPR"); // e.g. "0 */6 * * *" every 6 hours
  if (cronExpr) {
    // @ts-ignore - Deno.cron is available in Supabase Edge Runtime
    Deno.cron("jobs-cron", cronExpr, async () => {
      try {
        await handler(new Request("http://local/cron"));
      } catch (e) {
        console.error("jobs-cron scheduled run failed", e);
      }
    });
  }
} catch (_) {
  // ignore if Deno.env or Deno.cron isn't available in local TS tooling
}

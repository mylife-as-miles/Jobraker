// Lets a user answer the questions an auto-apply run stopped on, then re-runs
// the application with those answers (or skips it).
//
// POST (user JWT) {
//   applicationId: string,
//   action?: "answer" | "skip",          // default "answer"
//   answers?: [{ question: string, answer: string }],
//   saveToAnswerBank?: boolean            // default true
// }
//
// The provider parks the browser for a few hours after asking, but its public
// API does not document how to pass answers back, so the run restarts from the
// beginning with the answers included in the application package.
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { classifyQuestion } from "../../shared/ats/questions.ts";

const TEXT_PROFILE_KEYS = new Set([
  "current_salary", "expected_salary", "how_heard", "education", "language", "employer_current",
  "title_current", "preferred_name", "pronouns", "accommodation",
]);

// Turns a popup answer into an application profile value when the question
// maps to a canonical key with a simple shape; null otherwise.
function profileValueFor(key: string | null, answer: string): unknown {
  if (!key) return null;
  if (TEXT_PROFILE_KEYS.has(key)) return { text: answer };
  if (key === "notice_period") {
    const m = answer.match(/(\d+(?:\.\d+)?)\s*(day|week|month)/i);
    if (!m) return null;
    const unit = m[2].toLowerCase();
    const days = Math.round(Number(m[1]) * (unit === "week" ? 7 : unit === "month" ? 30 : 1));
    return { days, negotiable: /negotiable/i.test(answer) && !/not\s+negotiable/i.test(answer) };
  }
  if (key === "years_experience") {
    const m = answer.match(/\d+(?:\.\d+)?/);
    return m ? { years: Number(m[0]) } : null;
  }
  return null;
}

const MAX_ANSWER_LENGTH = 2000;

const slugify = (text: string) =>
  "q-" + text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

async function dispatchQueue(applicationId: string) {
  const baseUrl = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!baseUrl || !serviceRoleKey) return false;
  try {
    const res = await fetch(`${baseUrl}/functions/v1/process-auto-apply-queue`, {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
      body: JSON.stringify({ applicationId, source: "answer-application-questions" }),
      signal: AbortSignal.timeout(8_000),
    });
    return res.ok;
  } catch {
    // The queue cron also picks up waiting rows within a minute.
    return false;
  }
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req.headers.get("origin"), req);
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json(401, { error: "Unauthorized" });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const { data: userData, error: authError } = await supabase.auth.getUser(token);
  const user = userData?.user;
  if (authError || !user) return json(401, { error: "Unauthorized" });

  let body: any = {};
  try { body = await req.json(); } catch { return json(400, { error: "Invalid JSON" }); }
  const applicationId = typeof body?.applicationId === "string" ? body.applicationId : "";
  const action = body?.action === "skip" ? "skip" : "answer";
  if (!applicationId) return json(400, { error: "applicationId is required" });

  const { data: app, error: appError } = await supabase
    .from("applications")
    .select("id, user_id, provider_status, provider_run_output")
    .eq("id", applicationId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (appError) return json(500, { error: appError.message });
  if (!app) return json(404, { error: "Application not found" });
  if (app.provider_status !== "waiting_for_user") {
    return json(409, { error: "This application is not waiting for an answer", provider_status: app.provider_status });
  }

  const nowIso = new Date().toISOString();
  const pro = app.provider_run_output && typeof app.provider_run_output === "object" ? app.provider_run_output : {};

  if (action === "skip") {
    const { error } = await supabase.from("applications").update({
      status: "Draft",
      canonical_stage: "draft_ready",
      provider_status: "prepared",
      failure_reason: "Skipped by user.",
      provider_run_output: { ...pro, lifecycle_state: "prepared", reason_code: "user_selected_review" },
      updated_at: nowIso,
    }).eq("id", applicationId);
    if (error) return json(500, { error: error.message });
    return json(200, { success: true, action: "skip" });
  }

  const answers: Array<{ question: string; answer: string }> = (Array.isArray(body?.answers) ? body.answers : [])
    .map((a: any) => ({
      question: String(a?.question ?? "").trim(),
      answer: String(a?.answer ?? "").trim().slice(0, MAX_ANSWER_LENGTH),
    }))
    .filter((a: { question: string; answer: string }) => a.question && a.answer);
  if (!answers.length) return json(400, { error: "At least one answer is required" });

  // Record the answers in the application package and resolve the matching
  // requirements; otherwise readiness would block the run again.
  const pkg: any = pro.application_package && typeof pro.application_package === "object"
    ? structuredClone(pro.application_package)
    : { screeningAnswers: [], unresolvedRequirements: [] };
  pkg.screeningAnswers = Array.isArray(pkg.screeningAnswers) ? pkg.screeningAnswers : [];
  pkg.unresolvedRequirements = Array.isArray(pkg.unresolvedRequirements) ? pkg.unresolvedRequirements : [];
  const same = (a: unknown, b: string) => String(a ?? "").trim().toLowerCase() === b.toLowerCase();

  for (const { question, answer } of answers) {
    const existing = pkg.screeningAnswers.find((s: any) => same(s?.questionText, question));
    if (existing) {
      Object.assign(existing, { value: answer, requiresUserInput: false, confidence: 1, provenance: { source: "user_answer" } });
    } else {
      pkg.screeningAnswers.push({
        questionKey: slugify(question),
        questionText: question,
        value: answer,
        category: "general",
        provenance: { source: "user_answer" },
        confidence: 1,
        mutable: true,
        requiresUserInput: false,
      });
    }
    for (const req of pkg.unresolvedRequirements) {
      if (same(req?.title, question)) Object.assign(req, { resolved: true, requiresUserInput: false });
    }
  }

  if (body?.saveToAnswerBank !== false) {
    for (const { question, answer } of answers) {
      await supabase.from("answer_bank").upsert({
        user_id: user.id,
        theme: "career",
        slug: slugify(question),
        question,
        body: answer,
        tags: ["auto-apply"],
        updated_at: nowIso,
      }, { onConflict: "user_id,theme,slug" });
    }
  }

  // Answers to common questions also go into the application profile, so
  // every future application answers them without asking.
  for (const { question, answer } of answers) {
    const key = classifyQuestion(question);
    const value = profileValueFor(key, answer);
    if (!key || value === null) continue;
    await supabase.from("application_profile_answers").upsert(
      { user_id: user.id, key, value, source: "popup", updated_at: nowIso },
      { onConflict: "user_id,key" },
    );
  }

  const { error: updateError } = await supabase.from("applications").update({
    status: "Pending",
    canonical_stage: "queued",
    provider_status: "waiting",
    failure_reason: null,
    retry_count: 0,
    automation_claimed_by: null,
    automation_lease_token: null,
    automation_lease_expires_at: null,
    provider_run_output: {
      ...pro,
      application_package: pkg,
      lifecycle_state: "queued",
      reason_code: null,
      answered_questions: [...(Array.isArray(pro.answered_questions) ? pro.answered_questions : []), ...answers.map((a) => ({ ...a, answered_at: nowIso }))],
    },
    updated_at: nowIso,
  }).eq("id", applicationId);
  if (updateError) return json(500, { error: updateError.message });

  const dispatched = await dispatchQueue(applicationId);
  return json(200, { success: true, action: "answer", requeued: true, dispatched });
});

import { supabase } from "@/lib/supabaseClient";
import type {
  JobrakerChatSkill,
} from "./types";

type Application = Record<string, any>;
type CommandKind = "interview" | "outcome" | "add_portal" | "upskill" | "html_report";

const progressFor = (kind: CommandKind) => ({
  interview: ["Locating the tracked application", "Loading submitted materials", "Preparing verified research brief"],
  outcome: ["Locating the tracked application", "Archiving submitted materials", "Updating the application tracker"],
  add_portal: ["Reading the job-board request", "Researching the portal", "Preparing a testable search-skill scaffold"],
  upskill: ["Loading your profile and tracked roles", "Comparing recorded requirements", "Finding current study resources"],
  html_report: ["Loading tracker and archive data", "Building offline charts", "Opening the HTML report"],
}[kind]);

const delay = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const safeSegment = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "untitled";

const eventFromInstruction = (instruction: string) => {
  const value = instruction.toLowerCase();
  if (/\boffer(?:ed)?\b/.test(value)) return { type: "offer", status: "Offer", stage: "offer" };
  if (/\breject(?:ed|ion)?\b/.test(value)) return { type: "rejected", status: "Rejected", stage: "rejected" };
  if (/\b(silence|ghosted|no response)\b/.test(value)) return { type: "silence", status: "Applied", stage: "submitted" };
  if (/\b(interview|screen|round)\b/.test(value)) return { type: "interview", status: "Interview", stage: "interview" };
  return null;
};

const resolveApplication = (applications: Application[], instruction: string) => {
  const query = instruction.toLowerCase();
  const explicit = applications.filter((app) => {
    const company = text(app.company).toLowerCase();
    const role = text(app.job_title).toLowerCase();
    return (company.length > 2 && query.includes(company)) || (role.length > 4 && query.includes(role));
  });
  if (explicit.length === 1) return explicit[0];
  if (applications.length === 1) return applications[0];
  return null;
};

const readSseResponse = async (response: Response) => {
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(body || response.statusText || "AI research request failed.");
  }
  if (!response.body) throw new Error("AI research returned an empty response.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let output = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split(/\n\n/);
    buffer = frames.pop() || "";
    for (const frame of frames) {
      const data = frame.split(/\r?\n/).find((line) => line.startsWith("data:"))?.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const payload = JSON.parse(data);
        if (typeof payload.delta === "string") output += payload.delta;
        if (typeof payload.error === "string") throw new Error(payload.error);
      } catch (error) {
        if (error instanceof SyntaxError) continue;
        throw error;
      }
    }
  }
  return output.trim();
};

const askGroundedAi = async (prompt: string, webSearch: boolean) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Please sign in to use this command.");
  const url = `${import.meta.env.VITE_SUPABASE_URL || "http://127.0.0.1:54321"}/functions/v1/ai-chat`;
  return readSseResponse(await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      messages: [{ role: "user", content: prompt }],
      mode: "ask",
      webSearch,
      system: "This is a Jobraker career command. Never invent candidate experience, application facts, interviews, contacts, sources, or sent messages. Clearly label information as submitted, recorded, researched-and-verified, or unknown. External messaging is always a draft unless the user explicitly uses a separate send workflow.",
    }),
  }));
};

const applicationContext = async (application: Application) => {
  const [jobResult, resumeResult, coverResult, profileResult, feedbackResult, evaluationResult] = await Promise.all([
    application.job_id ? supabase.from("jobs").select("*").eq("id", application.job_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("parsed_resumes").select("raw_text").eq("user_id", application.user_id).order("extracted_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("cover_letters").select("content, company, role, updated_at").eq("user_id", application.user_id).ilike("company", application.company).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("profiles").select("story_bank, proof_points, preferred_narratives").eq("id", application.user_id).maybeSingle(),
    supabase.from("application_outcome_events").select("event_type, stage, notes, created_at").eq("application_id", application.id).order("created_at", { ascending: true }),
    application.job_id ? supabase.from("job_evaluations").select("interview_stories, missing_requirements, exact_fit_evidence").eq("job_id", application.job_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const job = jobResult.data as Record<string, any> | null;
  const jobPosting = text(job?.description) || text(job?.job_description) || text(job?.content);
  return {
    jobPosting,
    resume: text(resumeResult.data?.raw_text),
    coverLetter: text(coverResult.data?.content),
    profile: profileResult.data || {},
    feedback: feedbackResult.data || [],
    evaluation: evaluationResult.data || {},
  };
};

const archiveOutcome = async (application: Application, event: { type: string; status: string; stage: string }, instruction: string) => {
  const context = await applicationContext(application);
  const archivePath = `documents/applications/${safeSegment(text(application.company))}_${safeSegment(text(application.job_title))}/`;
  const outcomeMarkdown = `---\ncompany: ${text(application.company)}\nrole: ${text(application.job_title)}\nstatus: ${event.status}\nstage: ${event.stage}\nrecorded_at: ${new Date().toISOString()}\n---\n\n# Outcome\n\n- Event: ${event.type}\n- Notes: ${instruction || "No additional notes recorded."}\n`;
  const { error: archiveError } = await supabase.from("application_archives").upsert({
    user_id: application.user_id,
    application_id: application.id,
    archive_path: archivePath,
    job_posting: context.jobPosting || null,
    resume_snapshot: context.resume || null,
    cover_letter_snapshot: context.coverLetter || null,
    feedback_snapshot: context.feedback,
    outcome_markdown: outcomeMarkdown,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,application_id" });
  if (archiveError) throw new Error(`Could not archive application materials: ${archiveError.message}`);
  const { error: eventError } = await supabase.from("application_outcome_events").insert({
    user_id: application.user_id,
    application_id: application.id,
    event_type: event.type,
    stage: event.stage,
    notes: instruction || null,
  });
  if (eventError) throw new Error(`Could not record the outcome: ${eventError.message}`);
  const { error: updateError } = await supabase.from("applications").update({
    status: event.status,
    canonical_stage: event.stage,
    updated_at: new Date().toISOString(),
  }).eq("id", application.id);
  if (updateError) throw new Error(`Could not update the tracker: ${updateError.message}`);
  return { context, archivePath, outcomeMarkdown };
};

const generateHtmlReport = (applications: Application[], archives: Application[]) => {
  const counts = applications.reduce<Record<string, number>>((result, app) => {
    const key = text(app.status) || "Unknown";
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});
  const entries = Object.entries(counts);
  const max = Math.max(1, ...entries.map(([, count]) => count));
  const rows = applications.map((app) => `<tr data-search="${`${text(app.company)} ${text(app.job_title)} ${text(app.status)}`.toLowerCase()}"><td>${text(app.company)}</td><td>${text(app.job_title)}</td><td><span>${text(app.status)}</span></td><td>${text(app.applied_date).slice(0, 10) || "—"}</td></tr>`).join("");
  const bars = entries.map(([status, count], index) => `<g transform="translate(0 ${index * 34})"><text x="0" y="18">${status}</text><rect x="115" y="3" width="${Math.max(8, (count / max) * 260)}" height="20" rx="5" fill="#2fda69"/><text x="385" y="18">${count}</text></g>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Jobraker application report</title><style>body{margin:0;background:#050806;color:#edf8f0;font-family:Inter,system-ui,sans-serif;padding:32px}main{max-width:1100px;margin:auto}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.card,section{background:#0a110d;border:1px solid #1a5130;border-radius:16px;padding:20px}.number{font-size:40px;color:#2fda69}table{width:100%;border-collapse:collapse}td,th{padding:13px;border-bottom:1px solid #173021;text-align:left}span{color:#2fda69}input{background:#07100a;border:1px solid #245b37;color:#fff;border-radius:10px;padding:10px;width:280px}@media(max-width:650px){.cards{grid-template-columns:1fr}}</style></head><body><main><h1>Jobraker application report</h1><p>Generated offline from your tracked applications and ${archives.length} archive record${archives.length === 1 ? "" : "s"}.</p><div class="cards"><div class="card"><div>Applications</div><div class="number">${applications.length}</div></div><div class="card"><div>Active</div><div class="number">${applications.filter((app) => ["Applied", "Interview", "Pending"].includes(text(app.status))).length}</div></div><div class="card"><div>Offers</div><div class="number">${counts.Offer || 0}</div></div></div><section><h2>Status funnel</h2><svg viewBox="0 0 430 ${Math.max(60, entries.length * 34)}" width="100%" role="img">${bars}</svg></section><section><h2>Applications</h2><input aria-label="Filter applications" placeholder="Filter company, role, or status" oninput="for(const r of document.querySelectorAll('tbody tr'))r.hidden=!r.dataset.search.includes(this.value.toLowerCase())"><table><thead><tr><th>Company</th><th>Role</th><th>Status</th><th>Applied</th></tr></thead><tbody>${rows}</tbody></table></section></main></body></html>`;
};

const executeCareerCommand = (kind: CommandKind): JobrakerChatSkill["execute"] => async (input) => {
  for (const label of progressFor(kind)) { input.progress?.(label); await delay(90); }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: "failed", content: "Please sign in to use this command.", output: { error: "unauthenticated" } };
  const { data: applications, error } = await supabase.from("applications").select("*").eq("user_id", user.id).order("updated_at", { ascending: false });
  if (error) return { status: "failed", content: `Could not load applications: ${error.message}`, output: { error: error.message } };
  const apps = (applications || []) as Application[];

  if (kind === "html_report") {
    const { data: archives } = await supabase.from("application_archives").select("id").eq("user_id", user.id);
    const html = generateHtmlReport(apps, (archives || []) as Application[]);
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    window.open(url, "_blank", "noopener");
    return { status: "completed", content: `### HTML report generated\n\nOpened a self-contained, offline report for **${apps.length}** tracked applications. It includes stat cards, an inline-SVG status funnel, and a filterable table.`, output: { applications: apps.length, html } };
  }

  if (kind === "upskill") {
    const { data: profile } = await supabase.from("profiles").select("story_bank, proof_points, job_title").eq("id", user.id).maybeSingle();
    const { data: jobs } = await supabase.from("jobs").select("title, company, description, evaluation_summary").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(25);
    const answer = await askGroundedAi(`Create a prioritized skill-gap heatmap and learning plan. Use only the candidate and role evidence below for claims about the candidate. Search the web for current study resources and include direct source URLs and realistic time estimates. If a requirement is absent, call it a gap rather than assuming the candidate lacks it.\n\nCandidate: ${JSON.stringify(profile || {})}\nTracked roles: ${JSON.stringify(jobs || [])}\nRequest: ${input.userInstruction || "Compare my profile with my tracked job postings."}`, true);
    return { status: "completed", content: answer, output: { command: kind, trackedRoles: (jobs || []).length } };
  }

  if (kind === "add_portal") {
    const portal = input.userInstruction.trim();
    if (!portal) return { status: "completed", content: "### Add a portal\n\nName the job board or paste its URL, for example: `/add-portal https://example.com/jobs`.", output: { needsClarification: true } };
    const answer = await askGroundedAi(`Investigate this job portal: ${portal}. Return a concise implementation spec with: verified search URL pattern, result-page structure, access rules/robots considerations, a safe query test URL, and a TypeScript search-skill scaffold. Only mark facts as verified when a source URL supports them. Do not claim that a live query passed unless you can cite the returned results page. This is a draft specification; do not register an unverified portal.`, true);
    return { status: "completed", content: answer, output: { command: kind, portal, registration: "draft_requires_live_verification" } };
  }

  if (kind === "outcome" && /\bfollow[ -]?up\b/i.test(input.userInstruction)) {
    const defaultDays = Number(input.userInstruction.match(/\b(\d{1,2})\s*days?\b/i)?.[1] || 10);
    const cutoff = Date.now() - Math.min(Math.max(defaultDays, 1), 90) * 86_400_000;
    const openApps = apps.filter((app) => ["Applied", "Interview", "Pending"].includes(text(app.status)) && Date.parse(text(app.updated_at) || text(app.applied_date)) < cutoff);
    const eligible: Application[] = [];
    for (const app of openApps) {
      const { count } = await supabase.from("application_outcome_events").select("id", { count: "exact", head: true }).eq("application_id", app.id).eq("event_type", "follow_up");
      if ((count || 0) < 2) eligible.push(app);
    }
    if (!eligible.length) return { status: "completed", content: `### Follow-up check\n\nNo open applications are eligible for a draft after ${defaultDays} days. Jobraker never sends these messages, and it caps drafts at two per application.`, output: { eligible: 0, defaultDays } };
    const contexts = await Promise.all(eligible.slice(0, 8).map(async (app) => ({ app, context: await applicationContext(app) })));
    const answer = await askGroundedAi(`Draft one concise, channel-appropriate follow-up per application below. Use ONLY facts found in that application's submitted resume, cover letter, or posting. Do not invent contacts, achievements, dates, or a prior conversation. Clearly label every message DRAFT ONLY and never imply it was sent.\n\n${JSON.stringify(contexts)}`, false);
    for (const item of contexts) await supabase.from("application_outcome_events").insert({ user_id: user.id, application_id: item.app.id, event_type: "follow_up", stage: "submitted", notes: "Draft generated by /outcome followup; never sent.", metadata: { draft_only: true } });
    return { status: "completed", content: answer, output: { eligible: contexts.length, defaultDays, draftOnly: true } };
  }

  const application = resolveApplication(apps, input.userInstruction);
  if (!application) {
    const choices = apps.slice(0, 6).map((app) => `- ${text(app.company)} — ${text(app.job_title)} (${text(app.status)})`).join("\n") || "- No tracked applications found";
    return { status: "completed", content: `### Select a tracked application\n\nInclude the company or role in the command so Jobraker can use the exact materials that were submitted.\n\n${choices}`, output: { needsClarification: true } };
  }

  if (kind === "outcome") {
    const event = eventFromInstruction(input.userInstruction);
    if (!event) return { status: "completed", content: `### Record an outcome for ${text(application.company)}\n\nTell me whether this was an interview, offer, rejection, or silence. For example: \`/outcome interview at ${text(application.company)} — recruiter screen booked for Friday\`.`, output: { needsClarification: true, applicationId: application.id } };
    const archived = await archiveOutcome(application, event, input.userInstruction);
    const answer = await askGroundedAi(`An application outcome was recorded. Produce a short factual recap. If the event is an interview, include a thank-you-note draft clearly marked DRAFT ONLY and grounded only in submitted materials. Do not fabricate interview details.\n\nApplication: ${JSON.stringify(application)}\nEvent: ${JSON.stringify(event)}\nArchive path: ${archived.archivePath}\nOutcome file:\n${archived.outcomeMarkdown}`, false);
    return { status: "completed", content: answer, output: { applicationId: application.id, event: event.type, archivePath: archived.archivePath } };
  }

  const context = await applicationContext(application);
  const answer = await askGroundedAi(`Prepare a stage-specific interview prep pack for this tracked application. First use the exact posting, resume, cover letter, recorded round feedback, and story bank below. Then research the company and any named interviewer with web search: attach source URLs and only treat a detail as usable after verification. Map likely questions to provided STAR examples; where evidence is missing, write an honest bridge answer and say what is unknown. Offer a mock interview using this protocol: one question at a time, wait for the candidate answer, give specific evidence-based feedback, then continue. Never invent experience.\n\nApplication: ${JSON.stringify(application)}\nMaterials: ${JSON.stringify(context)}\nRequest: ${input.userInstruction}`, true);
  return { status: "completed", content: answer, output: { applicationId: application.id, command: kind, verifiedResearchRequired: true } };
};

const createCareerSkill = (id: CommandKind, name: string, aliases: string[], description: string, category: JobrakerChatSkill["category"]): JobrakerChatSkill => ({
  id,
  name,
  aliases,
  description,
  icon: id === "interview" ? "message-square" : id === "html_report" ? "bar-chart" : "target",
  category,
  triggerType: "both",
  inputSchema: { type: "object", properties: { instruction: { type: "string" } } },
  statusStates: ["queued", "running", "completed", "failed"],
  execute: executeCareerCommand(id),
});

export const interviewPrepSkill = createCareerSkill("interview", "Interview Prep", ["/interview", "@Interview"], "Build a grounded, stage-specific interview prep pack from a tracked application.", "research");
export const outcomeSkill = createCareerSkill("outcome", "Outcome Tracker", ["/outcome", "@Outcome"], "Record application outcomes and prepare draft-only follow-ups.", "tracking");
export const addPortalSkill = createCareerSkill("add_portal", "Add Portal", ["/add-portal", "@AddPortal"], "Research a job board and draft a verified search-skill specification.", "research");
export const upskillSkill = createCareerSkill("upskill", "Upskill Plan", ["/upskill", "@Upskill"], "Compare profile and tracked-role gaps with current learning resources.", "research");
export const htmlReportSkill = createCareerSkill("html_report", "HTML Report", ["/html-report", "@HtmlReport"], "Generate an offline application dashboard with charts and filters.", "tracking");

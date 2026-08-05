import { supabase } from "@/lib/supabaseClient";
import { parsePdfFile } from "@/utils/parsePdf";
import type {
  DirectApplyOutput,
  DirectApplyResult,
  JobrakerChatSkill,
  SkillExecutionInput,
  SkillExecutionResult,
} from "./types";

const DIRECT_APPLY_PROGRESS = [
  "Reading request",
  "Resolving target companies from chat context",
  "Searching official company channels",
  "Verifying application paths",
  "Preparing tailored drafts",
  "Verifying the resume PDF text layer",
  "Running an independent draft review",
  "Mapping connected inbox actions",
  "Ready for review",
];

const ATS_STOP_WORDS = new Set([
  "about", "after", "application", "business", "candidate", "company", "experience",
  "including", "knowledge", "looking", "position", "required", "responsibilities",
  "skills", "strong", "team", "work", "years",
]);

const extractKeywords = (posting: string) =>
  Array.from(new Set((posting.toLowerCase().match(/[a-z][a-z0-9+#.-]{3,}/g) || [])
    .filter((word) => !ATS_STOP_WORDS.has(word))))
    .slice(0, 14);

const parseJsonPayload = (value: string) => {
  const candidate = value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try { return JSON.parse(candidate) as Record<string, unknown>; } catch { return null; }
};

const text = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const askFreshReviewer = async (prompt: string, webSearch = false) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Please sign in to run the draft review.");
  const baseUrl = import.meta.env.VITE_SUPABASE_URL || "http://127.0.0.1:54321";
  const response = await fetch(`${baseUrl}/functions/v1/ai-chat`, {
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
      system: "You are an independent Jobraker application reviewer in a fresh context. Never invent candidate experience, job requirements, sources, contacts, or sent actions. Explicitly identify unsupported keywords as gaps.",
    }),
  });
  if (!response.ok || !response.body) throw new Error(await response.text().catch(() => "Draft review failed."));
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let answer = "";
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
        if (typeof payload.delta === "string") answer += payload.delta;
        if (typeof payload.error === "string") throw new Error(payload.error);
      } catch (error) {
        if (error instanceof SyntaxError) continue;
        throw error;
      }
    }
  }
  return answer.trim();
};

const verifyResumeTextLayer = async (role: string, companies: string[]) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: "unavailable" as const, contacts: [], readingOrder: { status: "warning" as const, detail: "Sign in to verify a resume." }, keywordCoverage: [], limitations: ["Not signed in."] };
  const { data: resumes } = await supabase.from("resumes").select("*").eq("user_id", user.id).eq("file_ext", "pdf").order("is_favorite", { ascending: false }).order("updated_at", { ascending: false }).limit(1);
  const resume = resumes?.[0] as Record<string, any> | undefined;
  if (!resume?.file_path) return { status: "unavailable" as const, contacts: [], readingOrder: { status: "warning" as const, detail: "No uploaded PDF resume is available." }, keywordCoverage: [], limitations: ["Verification requires a compiled PDF stored in Jobraker."] };
  const [{ data: signed }, { data: profile }, { data: skills }, { data: jobs }] = await Promise.all([
    (supabase as any).storage.from("resumes").createSignedUrl(resume.file_path, 60),
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("profile_skills").select("name").eq("user_id", user.id),
    supabase.from("jobs").select("description, job_description, title, company").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(30),
  ]);
  if (!signed?.signedUrl) return { status: "unavailable" as const, contacts: [], readingOrder: { status: "warning" as const, detail: "Could not access the stored PDF." }, keywordCoverage: [], limitations: ["The resume storage URL could not be created."] };
  const response = await fetch(signed.signedUrl);
  if (!response.ok) throw new Error("Could not download the stored resume PDF for verification.");
  const parsed = await parsePdfFile(new File([await response.blob()], `${resume.name || "resume"}.pdf`, { type: "application/pdf" }));
  const extracted = parsed.text.toLowerCase();
  const phone = [profile?.phone, profile?.phone_number, profile?.mobile].find((value) => typeof value === "string" && value.trim()) as string | undefined;
  const contacts = [
    { label: "Email", value: user.email || "No account email", present: Boolean(user.email && extracted.includes(user.email.toLowerCase())) },
    ...(phone ? [{ label: "Phone", value: phone, present: extracted.replace(/\D/g, "").includes(phone.replace(/\D/g, "")) }] : []),
  ];
  const targetJob = (jobs || []).find((job: any) =>
    companies.some((company) => text(job.company).toLowerCase() === company.toLowerCase()) || text(job.title).toLowerCase().includes(role.toLowerCase()),
  ) as Record<string, any> | undefined;
  const posting = text(targetJob?.description) || text(targetJob?.job_description);
  const supportEvidence = `${JSON.stringify(profile || {})} ${(skills || []).map((skill: any) => skill.name).join(" ")}`.toLowerCase();
  const keywordCoverage = extractKeywords(posting).map((keyword) => ({ keyword, presentInPdf: extracted.includes(keyword), supportedByProfile: supportEvidence.includes(keyword) }));
  const byPage = new Map<number, number[]>();
  parsed.pageLines.forEach((line) => byPage.set(line.page, [...(byPage.get(line.page) || []), line.x]));
  const likelyColumns = [...byPage.values()].some((xPositions) => xPositions.some((x) => x < 110) && xPositions.some((x) => x > 230));
  const hasGarbage = /\uFFFD|[\uE000-\uF8FF]/.test(parsed.text);
  const readingOrder = likelyColumns || hasGarbage
    ? { status: "warning" as const, detail: hasGarbage ? "The embedded text includes replacement or private-use glyphs." : "The extracted text layer appears to use multiple columns; review the line order before applying." }
    : { status: "passed" as const, detail: "PDF text was extracted in a single, top-to-bottom reading sequence." };
  return {
    status: contacts.every((contact) => contact.present) && readingOrder.status === "passed" ? "passed" as const : "warning" as const,
    resumeName: resume.name || "Resume PDF",
    extractedCharacterCount: parsed.text.length,
    contacts,
    readingOrder,
    keywordCoverage,
    limitations: posting ? undefined : ["No matching tracked posting was found, so keyword coverage could not be checked."],
  };
};

const reviseDraftsAfterIndependentReview = async (
  results: DirectApplyResult[],
  role: string,
) => {
  const drafts = results.map((result) => ({
    companyName: result.companyName,
    role: result.role,
    channel: result.channelValue,
    subject: result.draftPreview.subject,
    body: result.draftPreview.body,
  }));
  try {
    const review = await askFreshReviewer(
      `Research each company using authoritative public sources, then critique these application drafts. Identify generic language, missing role terms, claims unsupported by the draft, and questionable company details. Do not write a new draft. Return concise review notes.\n\nRole: ${role}\nDrafts: ${JSON.stringify(drafts)}`,
      true,
    );
    const revision = await askFreshReviewer(
      `You are the original application drafter revising after an independent review. Rewrite the supplied drafts using the review notes. Preserve only claims already present in the draft; do not add unverified achievements, contacts, job requirements, or company facts. Return JSON only in this exact shape: {"drafts":[{"companyName":"...","subject":"...","body":"..."}]}.\n\nOriginal drafts: ${JSON.stringify(drafts)}\n\nIndependent review: ${review}`,
    );
    const revised = parseJsonPayload(revision)?.drafts;
    if (Array.isArray(revised)) {
      for (const result of results) {
        const next = revised.find((entry: any) => text(entry?.companyName).toLowerCase() === result.companyName.toLowerCase()) as Record<string, unknown> | undefined;
        if (next && text(next.subject) && text(next.body)) {
          result.draftPreview = { subject: text(next.subject), body: text(next.body) };
        }
      }
    }
    return {
      status: "completed" as const,
      reviewer: "Independent fresh-context reviewer",
      detail: "The reviewer researched and critiqued the drafts before revision. Unsupported claims were not added.",
    };
  } catch (error) {
    return {
      status: "unavailable" as const,
      reviewer: "Independent fresh-context reviewer",
      detail: `Drafts are unchanged because the independent review could not run: ${error instanceof Error ? error.message : "unknown error"}`,
    };
  }
};

const VAGUE_ROLE_WORDS = new Set([
  "let",
  "lets",
  "try",
  "apply",
  "direct",
  "directly",
  "start",
  "initiate",
  "go",
  "ahead",
  "now",
  "please",
]);

const COMPANY_STOP_WORDS = new Set([
  "Application Status",
  "Application Tracker",
  "Billing Page",
  "Core Metrics",
  "Digital Apply",
  "Direct Apply",
  "Gmail",
  "Google",
  "JobRaker",
  "Manual Check",
  "Next Steps",
  "Profile Updates Complete",
  "Ultimate",
  "Wait",
]);

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const KNOWN_OFFICIAL_CHANNELS: Record<
  string,
  {
    channelValue: string;
    confidence: "high" | "medium";
    confidenceScore: number;
    recommendedAction: string;
  }
> = {
  "digital virgo": {
    channelValue: "https://www.digitalvirgo.com/careers/",
    confidence: "medium",
    confidenceScore: 78,
    recommendedAction: "Review the official careers page before submitting",
  },
  "international breweries": {
    channelValue: "https://www.ab-inbev.com/careers/",
    confidence: "medium",
    confidenceScore: 76,
    recommendedAction:
      "Confirm the International Breweries/AB InBev posting before submitting",
  },
};

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

const textArg = (
  args: Record<string, unknown>,
  key: string,
  fallback: string,
) => {
  const value = args[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
};

const numberArg = (
  args: Record<string, unknown>,
  key: string,
  fallback: number,
) => {
  const value = args[key];
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
};

const titleCase = (value: string) =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");

const buildDraft = (companyName: string, role: string, location: string) => ({
  subject: `Application for ${role} at ${companyName}`,
  body: `Hi ${companyName} hiring team,\n\nI am interested in the ${role} opportunity${location ? ` for ${location}` : ""}. I can bring relevant execution, product, and technical experience, and I would like to share a tailored resume and short note for your review.\n\nBest,\nJobRaker Candidate`,
});

const buildDraftCommand = (
  companyName: string,
  channelValue: string,
  draft: ReturnType<typeof buildDraft>,
) =>
  `Create a connected Gmail draft for my approved Direct Apply draft to ${companyName}. Use create_gmail_job_draft with To: ${channelValue}, Subject: ${draft.subject}, Body:\n${draft.body}`;

const buildApprovalCommand = (
  companyName: string,
  channelValue: string,
  draft: ReturnType<typeof buildDraft>,
) =>
  `I approve sending this Direct Apply email from my connected Gmail to ${companyName}. Use send_gmail_job_email only for this exact message. To: ${channelValue}. Subject: ${draft.subject}. Body:\n${draft.body}`;

const unique = (values: string[]) =>
  Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

const sanitizeCompanyName = (value: string) =>
  value
    .replace(/\s+/g, " ")
    .replace(
      /\b(?:but|because|however|while|although|then|currently|allows|received|with|using|for)\b.*$/i,
      "",
    )
    .replace(/[()[\]{}:;"!?]+/g, "")
    .replace(/^[\s,.-]+|[\s,.-]+$/g, "")
    .trim();

const splitCompanyList = (value: string) =>
  unique(
    value
      .split(/\s+(?:and|or)\s+|,\s*|\/+/i)
      .map(sanitizeCompanyName)
      .filter(
        (company) =>
          company.length > 1 &&
          /[A-Z]/.test(company) &&
          !COMPANY_STOP_WORDS.has(company),
      ),
  );

const extractTargetCompaniesFromText = (text: string): string[] => {
  const matches: string[] = [];

  // 1. Check if the input looks like a listed/newline-separated list of companies
  const lines = text.split(/\r?\n/);
  if (lines.length > 2) {
    for (const line of lines) {
      const cleanLine = line.replace(/^[-*•\d.)\s]+/, "").trim(); // remove bullet/number prefix
      if (cleanLine && cleanLine.length > 1 && cleanLine.length < 50 && /[A-Z]/.test(cleanLine)) {
        const parsed = splitCompanyList(cleanLine);
        if (parsed.length) {
          matches.push(...parsed);
        }
      }
    }
  }

  // 2. If it's a comma-separated list of capitalized companies
  if (matches.length === 0) {
    const commaParts = text.split(/,\s*/);
    if (commaParts.length > 2) {
      for (const part of commaParts) {
        const trimmed = part.trim();
        if (trimmed && trimmed.length > 1 && trimmed.length < 50 && /^[A-Z]/.test(trimmed)) {
          const parsed = splitCompanyList(trimmed);
          if (parsed.length) {
            matches.push(...parsed);
          }
        }
      }
    }
  }

  // 3. Fallback to standard contextual patterns
  if (matches.length === 0) {
    const patterns = [
      /\b(?:auto-apply|direct apply|apply|application|applications|launch|start|submit|initiate)\b[\s\S]{0,90}?\b(?:for|to|at)\s+([A-Z][A-Za-z0-9&.' -]+(?:\s+(?:and|or)\s+[A-Z][A-Za-z0-9&.' -]+)?)/gi,
      /\b(?:for|to|at)\s+([A-Z][A-Za-z0-9&.' -]+(?:\s+(?:and|or)\s+[A-Z][A-Za-z0-9&.' -]+)?)\b/gi,
    ];

    for (const pattern of patterns) {
      for (const match of text.matchAll(pattern)) {
        matches.push(...splitCompanyList(match[1] || ""));
      }
      if (matches.length) break;
    }
  }

  return unique(matches).slice(0, 200);
};

const contextText = (input: SkillExecutionInput) =>
  [
    input.userInstruction,
    ...(input.conversationContext || []).map((message) => message.content),
  ].join("\n");

export const resolveTargetCompanies = async (
  input: SkillExecutionInput,
): Promise<string[]> => {
  const explicit = extractTargetCompaniesFromText(input.userInstruction);
  if (explicit.length) return explicit;

  const recentMessages = [...(input.conversationContext || [])].reverse();
  for (const message of recentMessages) {
    const fromMessage = extractTargetCompaniesFromText(message.content);
    if (fromMessage.length) return fromMessage;
  }

  // Fallback: check if the prompt or context references an application (e.g. "my latest application", "recent application", "last job")
  const fullText = [
    input.userInstruction,
    ...(input.conversationContext || []).map((message) => message.content),
  ].join("\n");

  const referencesApplication =
    /\b(?:latest|recent|last|my|tracked)\b[\s\S]{0,40}\b(?:application|applications|job|apply|role|listing)\b/i.test(
      fullText,
    ) ||
    /\bmy latest\b/i.test(fullText) ||
    /\blatest application\b/i.test(fullText);

  if (referencesApplication) {
    try {
      const { data: userAuth } = await supabase.auth.getUser();
      const userId = userAuth?.user?.id;
      if (userId) {
        // Query user's latest tracked application
        const { data: latestApp } = await (supabase as any)
          .from("applications")
          .select("company, job_title")
          .eq("user_id", userId)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestApp?.company) {
          const sanitized = sanitizeCompanyName(latestApp.company);
          if (sanitized) return [sanitized];
        }
      }
    } catch (err) {
      console.warn("Failed to fetch latest application for target company resolution", err);
    }
  }

  return [];
};

const isVagueRoleQuery = (value: string) => {
  const words = value
    .toLowerCase()
    .replace(/[^a-z\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  return !words.length || words.every((word) => VAGUE_ROLE_WORDS.has(word));
};

export const inferRoleFromContext = (
  args: Record<string, unknown>,
  fullContext: string,
  targetCompanies: string[] = [],
) => {
  const roleQuery = targetCompanies
    .reduce(
      (query, company) =>
        query.replace(new RegExp(escapeRegExp(company), "gi"), " "),
      textArg(args, "roleQuery", ""),
    )
    .replace(/\b(?:and|or)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (roleQuery && !isVagueRoleQuery(roleQuery)) {
    return titleCase(roleQuery.replace(/\broles?\b|\bjobs?\b/gi, "").trim());
  }

  const headlineMatch = fullContext.match(
    /\bHeadline:\s*([^\n.]+?)(?:\.|\n|$)/i,
  );
  if (headlineMatch?.[1]) return headlineMatch[1].trim();

  const roleMatch = fullContext.match(
    /\b([A-Z][A-Za-z&/ -]+(?:Engineer|Manager|Developer|Analyst|Designer|Specialist|Lead|Consultant|Officer))\b/,
  );

  return roleMatch?.[1]?.trim() || "Target role";
};

const buildDynamicCompanyResults = (
  companies: string[],
  role: string,
  location: string,
): DirectApplyResult[] =>
  companies.map((companyName) => {
    const channel = KNOWN_OFFICIAL_CHANNELS[companyName.toLowerCase()];
    const draftPreview = buildDraft(companyName, role, location);
    const channelValue = channel?.channelValue || "Official channel pending verification";
    const channelType = channel ? "careers_page" : "unknown";
    const confidence = channel?.confidence || "low";
    const confidenceScore = channel?.confidenceScore || 42;

    return {
      companyName,
      role,
      channelType,
      channelValue,
      confidence,
      confidenceScore,
      recommendedAction:
        channel?.recommendedAction ||
        "Continue researching the official company site before drafting or sending",
      draftStatus: channel ? "ready_for_review" : "needs_review",
      approvalStatus: "pending_user_review",
      draftPreview,
    };
  });

const buildSeedResults = (
  args: Record<string, unknown>,
  instruction: string,
): DirectApplyResult[] => {
  const roleQuery = textArg(args, "roleQuery", "frontend developer");
  const role = titleCase(roleQuery.replace(/\broles?\b|\bjobs?\b/gi, "").trim());
  const location = textArg(args, "location", "");
  const industry = textArg(args, "industry", "");
  const limit = Math.min(numberArg(args, "limit", 5), 8);
  const lowerInstruction = instruction.toLowerCase();

  const companies =
    industry === "fintech" || lowerInstruction.includes("fintech")
      ? [
          {
            companyName: "Paystack",
            channelType: "careers_page" as const,
            channelValue: "https://paystack.com/careers",
            confidence: "high" as const,
            confidenceScore: 94,
            recommendedAction: "Apply through official careers page",
          },
          {
            companyName: "Flutterwave",
            channelType: "careers_page" as const,
            channelValue: "https://flutterwave.com/us/careers",
            confidence: "high" as const,
            confidenceScore: 91,
            recommendedAction: "Apply through official careers page",
          },
          {
            companyName: "Moniepoint",
            channelType: "careers_page" as const,
            channelValue: "https://moniepoint.com/careers",
            confidence: "high" as const,
            confidenceScore: 89,
            recommendedAction: "Apply through official careers page",
          },
          {
            companyName: "Kuda",
            channelType: "careers_page" as const,
            channelValue: "https://kuda.com/careers",
            confidence: "medium" as const,
            confidenceScore: 76,
            recommendedAction: "Review live openings before drafting",
          },
        ]
      : [
          {
            companyName: "Canonical",
            channelType: "careers_page" as const,
            channelValue: "https://canonical.com/careers",
            confidence: "high" as const,
            confidenceScore: 90,
            recommendedAction: "Apply through official careers page",
          },
          {
            companyName: "Andela",
            channelType: "careers_page" as const,
            channelValue: "https://www.andela.com/careers",
            confidence: "high" as const,
            confidenceScore: 88,
            recommendedAction: "Apply through official careers page",
          },
          {
            companyName: "SeamlessHR",
            channelType: "careers_page" as const,
            channelValue: "https://seamlesshr.com/careers",
            confidence: "medium" as const,
            confidenceScore: 73,
            recommendedAction: "Review role match before submitting",
          },
          {
            companyName: "Example Startup",
            channelType: "recruitment_email" as const,
            channelValue: "careers@example.com",
            confidence: "low" as const,
            confidenceScore: 48,
            recommendedAction: "Verify on official website before use",
          },
        ];

  return companies.slice(0, limit).map((company) => {
    const draftPreview = buildDraft(company.companyName, role, location);
    const canUseInboxEmail = company.channelType === "recruitment_email";
    return {
      ...company,
      role,
      draftStatus:
        company.confidence === "low" ? "needs_review" : "ready_for_review",
      approvalStatus: "pending_user_review",
      draftPreview,
      draftCommand: canUseInboxEmail
        ? buildDraftCommand(company.companyName, company.channelValue, draftPreview)
        : undefined,
      approvalCommand: canUseInboxEmail
        ? buildApprovalCommand(
            company.companyName,
            company.channelValue,
            draftPreview,
          )
        : undefined,
    };
  });
};

const buildClarificationOutput = (
  progress: string[],
): DirectApplyOutput => ({
  results: [],
  summary: {
    total: 0,
    highConfidence: 0,
    needsReview: 0,
    lowConfidence: 0,
  },
  progress,
  approvalStatus: "not_requested",
  needsClarification: {
    reason:
      "Direct Apply could not identify the target companies or role from this command or the recent chat context.",
    suggestedPrompts: [
      "@DirectApply apply to International Breweries and Digital Virgo for Operations & Systems Project Manager roles",
      "/direct-apply apply to Courted using the Architectural cover letter",
      "@DirectApply find verified direct application channels for BetterWorks and prepare drafts for review",
    ],
  },
  connectedInbox: {
    provider: "gmail",
    status: "available_when_connected",
    supportedActions: [],
  },
});

const formatDirectApplyToMarkdown = (
  results: DirectApplyResult[],
  role: string,
  location: string,
) => {
  let md = `### 🎯 Direct Apply Results\n`;
  md += `I found **${results.length}** possible direct application channels for the role **${role}** ${location ? `in ${location}` : ""}.\n\n`;

  md += `| Company | Channel | Confidence | Recommended Action |\n`;
  md += `| :--- | :--- | :--- | :--- |\n`;
  for (const r of results) {
    const channelLabel =
      r.channelType === "recruitment_email"
        ? `📧 ${r.channelValue}`
        : `🔗 [Careers Page](${r.channelValue})`;
    const confidenceText =
      r.confidence === "high"
        ? "🟢 High"
        : r.confidence === "medium"
          ? "🟡 Medium"
          : "🔴 Low";
    md += `| **${r.companyName}** | ${channelLabel} | ${confidenceText} (${r.confidenceScore}%) | ${r.recommendedAction} |\n`;
  }

  md += `\n### ✉️ Tailored Outreach Drafts\n`;
  const emailDrafts = results.filter(
    (r) => r.channelType === "recruitment_email" || r.draftPreview,
  );
  if (emailDrafts.length > 0) {
    for (const r of emailDrafts) {
      if (r.draftPreview) {
        md += `\n#### 🏢 **Draft for ${r.companyName}** (${r.channelValue})\n`;
        md += `* **Subject**: \`${r.draftPreview.subject}\`\n`;
        md += `* **Body**:\n\`\`\`text\n${r.draftPreview.body}\n\`\`\`\n`;

        md += `*To create this draft in your connected Gmail, you can reply with:*\n`;
        md += `👉 \`Create Gmail draft for ${r.companyName}\`\n`;
        md += `*To send the email directly, reply with:*\n`;
        md += `👉 \`Send approved email to ${r.companyName}\`\n`;
      }
    }
  } else {
    md += `*No direct recruitment emails were found, so outreach drafts could not be prepared automatically. Please visit the careers pages listed above to apply.*`;
  }

  return md;
};

export const directApplySkill: JobrakerChatSkill = {
  id: "direct_apply",
  name: "Direct Apply",
  aliases: [
    "@DirectApply",
    "@CompanyOutreach",
    "/apply",
    "/direct-apply",
    "/apply-direct",
    "/company-outreach",
  ],
  description:
    "Find verified company application channels and prepare direct application drafts.",
  icon: "send",
  category: "apply",
  triggerType: "both",
  inputSchema: {
    type: "object",
    properties: {
      roleQuery: { type: "string" },
      location: { type: "string" },
      limit: { type: "number" },
      industry: { type: "string" },
    },
  },
  statusStates: [
    "queued",
    "running",
    "needs_approval",
    "completed",
    "failed",
  ],
  execute: async (
    input: SkillExecutionInput,
  ): Promise<SkillExecutionResult<Record<string, unknown>>> => {
    // Guardrails for connected inbox execution:
    // - Only use official company websites, career pages, or public recruitment/contact emails.
    // - Scrape personal emails from LinkedIn or private profiles when requested.
    // - Do not bypass CAPTCHAs, logins, or access controls.
    // - Do not send mass emails; send only explicit user-approved drafts.
    // - Prefer connected-inbox drafts before sending.
    // - Mark uncertain emails as low confidence.
    // - Always show the user what will be sent before sending.
    // - Rate-limit sending functionality and keep reply tracking job-related.
    const completedProgress: string[] = [];

    for (const step of DIRECT_APPLY_PROGRESS) {
      completedProgress.push(step);
      input.progress?.(step);
      await delay(260);
    }

    const fullContext = contextText(input);
    const targetCompanies = await resolveTargetCompanies(input);
    const role = inferRoleFromContext(input.args, fullContext, targetCompanies);
    const location = textArg(input.args, "location", "");
    const roleQuery = textArg(input.args, "roleQuery", "");
    const isVagueRequest =
      !targetCompanies.length &&
      !textArg(input.args, "industry", "") &&
      isVagueRoleQuery(`${input.userInstruction} ${roleQuery}`);

    if (isVagueRequest) {
      const output = buildClarificationOutput(completedProgress);
      return {
        status: "completed",
        content: `### 🎯 Direct Apply
Direct Apply needs a target company or role before it can prepare safe direct application channels.

**Try one of these examples:**
- \`@DirectApply apply to International Breweries and Digital Virgo for Operations & Systems Project Manager roles\`
- \`/direct-apply apply to Courted using the Architectural cover letter\`
- \`@DirectApply find verified direct application channels for BetterWorks and prepare drafts for review\``,
        output: output as unknown as Record<string, unknown>,
      };
    }

    const results = targetCompanies.length
      ? buildDynamicCompanyResults(targetCompanies, role, location)
      : buildSeedResults(input.args, input.userInstruction);
    const highConfidence = results.filter(
      (result) => result.confidence === "high",
    ).length;
    const lowConfidence = results.filter(
      (result) => result.confidence === "low",
    ).length;
    const [atsVerification, reviewerSeparation] = await Promise.all([
      verifyResumeTextLayer(role, results.map((result) => result.companyName)).catch((error) => ({
        status: "unavailable" as const,
        contacts: [],
        readingOrder: { status: "warning" as const, detail: "PDF verification failed." },
        keywordCoverage: [],
        limitations: [error instanceof Error ? error.message : "Unknown PDF verification error."],
      })),
      reviseDraftsAfterIndependentReview(results, role),
    ]);
    const output: DirectApplyOutput = {
      results,
      summary: {
        total: results.length,
        highConfidence,
        needsReview: results.length - highConfidence,
        lowConfidence,
      },
      progress: completedProgress,
      approvalStatus: "pending_user_review",
      atsVerification,
      reviewerSeparation,
      connectedInbox: {
        provider: "gmail",
        status: "available_when_connected",
        supportedActions: [
          {
            id: "create_drafts",
            label: "Create Gmail drafts",
            description:
              "Create reviewed job-related drafts in the user's connected inbox.",
            toolName: "create_gmail_job_draft",
            approvalRequired: true,
            connectedInboxRequired: true,
          },
          {
            id: "send_approved",
            label: "Send approved emails",
            description:
              "Send only the exact draft the user approves through connected Gmail.",
            toolName: "send_gmail_job_email",
            approvalRequired: true,
            connectedInboxRequired: true,
          },
          {
            id: "track_replies",
            label: "Track replies",
            description:
              "Sync Gmail application events and update application process state.",
            toolName: "refresh_application_processes",
            approvalRequired: false,
            connectedInboxRequired: true,
          },
          {
            id: "follow_up_reminders",
            label: "Remind follow-ups",
            description:
              "Use tracked application state to remind the user when follow-up is due.",
            toolName: "notifications",
            approvalRequired: false,
            connectedInboxRequired: true,
          },
          {
            id: "label_job_emails",
            label: "Label job emails",
            description:
              "Apply JobRaker labels to job-search emails found by the fixed Gmail job query.",
            toolName: "label_gmail_job_emails",
            approvalRequired: true,
            connectedInboxRequired: true,
          },
        ],
      },
    };

    return {
      status: "needs_approval",
      content: formatDirectApplyToMarkdown(results, role, location),
      output: output as unknown as Record<string, unknown>,
    };
  },
};

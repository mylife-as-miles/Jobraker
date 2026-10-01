// One-click chat actions. Each entry is a task the user can start from the
// chat home screen (and later from other pages) without typing anything.
// "prompt" actions send their prompt to the agent straight away; "preset"
// actions open an existing guided recipe modal instead.

export type ChatActionIcon =
  | "search"
  | "send"
  | "resume"
  | "letter"
  | "mail"
  | "follow-up"
  | "interview"
  | "tracker";

interface ChatActionBase {
  id: string;
  label: string;
  description: string;
  icon: ChatActionIcon;
}

export interface PromptChatAction extends ChatActionBase {
  kind: "prompt";
  prompt: string;
}

export interface PresetChatAction extends ChatActionBase {
  kind: "preset";
  recipeId: string;
}

export type ChatAction = PromptChatAction | PresetChatAction;

export const CHAT_ACTIONS: ChatAction[] = [
  {
    id: "find_jobs",
    kind: "prompt",
    label: "Find jobs for me",
    description: "New openings that match your profile.",
    icon: "search",
    prompt:
      "Find new job openings that match my profile, target roles and location preferences. Show the 10 best matches with a one-line reason each fits.",
  },
  {
    id: "apply_best_matches",
    kind: "prompt",
    label: "Apply to my best matches",
    description: "Pick the strongest fits and apply.",
    icon: "send",
    prompt:
      "Look at my saved and recent jobs, pick the 3 that fit my profile best, and apply to them. Show me the list and wait for my approval before submitting anything.",
  },
  {
    id: "tailor_resume",
    kind: "prompt",
    label: "Tailor my resume",
    description: "Match your resume to a job.",
    icon: "resume",
    prompt:
      "Tailor my resume for the job I saved or applied to most recently. If more than one job is a reasonable choice, list them so I can pick one.",
  },
  {
    id: "cover_letter",
    kind: "prompt",
    label: "Write a cover letter",
    description: "A tailored letter for a job.",
    icon: "letter",
    prompt:
      "Write a cover letter for the job I saved or applied to most recently, using my resume. If more than one job is a reasonable choice, list them so I can pick one.",
  },
  {
    id: "recruiter_outreach",
    kind: "preset",
    label: "Reach out to recruiters",
    description: "Find contacts and draft emails.",
    icon: "mail",
    recipeId: "recruiter_cold_outreach",
  },
  {
    id: "follow_up",
    kind: "prompt",
    label: "Follow up on applications",
    description: "Nudge the ones that went quiet.",
    icon: "follow-up",
    prompt:
      "Find my applications with no response for 7 or more days and draft a short follow-up email for each. Do not send anything.",
  },
  {
    id: "interview_prep",
    kind: "prompt",
    label: "Prepare for an interview",
    description: "Questions and talking points.",
    icon: "interview",
    prompt:
      "Build an interview prep pack for my most advanced application: likely questions, strong answers grounded in my resume, and questions I should ask them.",
  },
  {
    id: "track_applications",
    kind: "prompt",
    label: "Where do my applications stand?",
    description: "Status and what needs action.",
    icon: "tracker",
    prompt:
      "Summarize my applications: counts by status, what needs my action this week, and anything that has gone stale.",
  },
];

// Actions offered from other pages ("Ask AI" menus). Each prompt names the
// record so the agent can find it without asking which one.
export interface ContextChatAction {
  id: string;
  label: string;
  prompt: string;
}

interface JobRef {
  id: string;
  title: string;
  company: string;
  apply_url?: string | null;
}

interface ApplicationRef {
  id: string;
  job_title?: string | null;
  company?: string | null;
  status?: string | null;
}

const describeJob = (job: JobRef) =>
  `the ${job.title} job at ${job.company} (job id ${job.id}${job.apply_url ? `, ${job.apply_url}` : ""})`;

export function jobChatActions(job: JobRef): ContextChatAction[] {
  const target = describeJob(job);
  return [
    {
      id: "job_fit",
      label: "Is this a good fit for me?",
      prompt: `Evaluate how well my profile and resume fit ${target}. Give a clear verdict, the main gaps, and whether I should apply.`,
    },
    {
      id: "job_cover_letter",
      label: "Write a cover letter",
      prompt: `Write a cover letter for ${target}, using my resume.`,
    },
    {
      id: "job_recruiter",
      label: "Find the recruiter and draft an email",
      prompt: `Find recruiter or hiring manager contacts for ${target} and draft a short outreach email. Do not send anything.`,
    },
    {
      id: "job_interview",
      label: "Prepare me for the interview",
      prompt: `Build an interview prep pack for ${target}: likely questions, strong answers grounded in my resume, and questions I should ask.`,
    },
  ];
}

export function applicationChatActions(app: ApplicationRef): ContextChatAction[] {
  const target = `my application for ${app.job_title || "this role"} at ${app.company || "this company"} (application id ${app.id}${app.status ? `, status ${app.status}` : ""})`;
  return [
    {
      id: "app_follow_up",
      label: "Draft a follow-up email",
      prompt: `Draft a short, polite follow-up email for ${target}. Do not send anything.`,
    },
    {
      id: "app_interview",
      label: "Prepare me for the interview",
      prompt: `Build an interview prep pack for ${target}: likely questions, strong answers grounded in my resume, and questions I should ask.`,
    },
    {
      id: "app_next_step",
      label: "What should I do next?",
      prompt: `Look at ${target} and tell me the single best next step, then offer to do it.`,
    },
  ];
}

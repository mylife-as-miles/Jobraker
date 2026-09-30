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

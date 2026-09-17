export interface ActionRecipeStage {
  id: string;
  stepNumber: number;
  label: string;
  actionButtonLabel: string;
  description: string;
}

export interface ActionRecipe {
  id: string;
  title: string;
  shortTitle: string;
  tagline: string;
  description: string;
  category: "outreach" | "applications" | "preparation";
  badge?: string;
  estimatedCreditsPerJob: number;
  stages: ActionRecipeStage[];
  defaultJobLimit: number;
  maxJobLimit: number;
}

export const ACTION_RECIPES: Record<string, ActionRecipe> = {
  recruiter_cold_outreach: {
    id: "recruiter_cold_outreach",
    title: "1-Click Recruiter Cold Outreach",
    shortTitle: "Recruiter Outreach",
    tagline: "Find verified recruiter emails, review tailored pitches, and draft or send through Gmail.",
    description: "Select target jobs, pull decision-maker emails from public sources and a configured contact provider, review each AI-crafted message, then create or send the reviewed Gmail drafts.",
    category: "outreach",
    badge: "1-Click",
    estimatedCreditsPerJob: 5,
    defaultJobLimit: 3,
    maxJobLimit: 10,
    stages: [
      {
        id: "scout_emails",
        stepNumber: 1,
        label: "Pull Recruiter Emails",
        actionButtonLabel: "⚡ 1-Click: Pull Recruiter Contacts",
        description: "Scout verified talent partners, hiring managers, and department leads across official sites, the public web, contact providers, and public LinkedIn results.",
      },
      {
        id: "craft_messages",
        stepNumber: 2,
        label: "Craft Outreach Pitches",
        actionButtonLabel: "✨ 1-Click: Craft Outreach Pitches",
        description: "Generate punchy, high-conversion email pitches matched to your resume evidence.",
      },
      {
        id: "deliver_drafts",
        stepNumber: 3,
        label: "Send or Draft in Gmail",
        actionButtonLabel: "★ 1-Click: Create in Gmail Drafts",
        description: "Create reviewable Gmail drafts or explicitly send those exact drafts with provider-confirmed message IDs.",
      },
    ],
  },
  instant_job_pitch: {
    id: "instant_job_pitch",
    title: "Instant Job Pitch & Cover Letter",
    shortTitle: "Quick Pitch",
    tagline: "Generate role-tailored pitch notes ready for LinkedIn and application portals.",
    description: "Quickly synthesize job descriptions with your top achievements to draft tailored introductory notes.",
    category: "applications",
    badge: "Fast",
    estimatedCreditsPerJob: 2,
    defaultJobLimit: 1,
    maxJobLimit: 5,
    stages: [
      {
        id: "analyze",
        stepNumber: 1,
        label: "Analyze Requirements",
        actionButtonLabel: "Analyze Job Requirements",
        description: "Identify key qualifications and hiring signals.",
      },
      {
        id: "generate",
        stepNumber: 2,
        label: "Generate Pitch",
        actionButtonLabel: "Generate Pitch Note",
        description: "Write tailored cover note with portfolio link.",
      },
    ],
  },
  followup_bump: {
    id: "followup_bump",
    title: "Application Follow-Up Bump",
    shortTitle: "Follow-Up Bump",
    tagline: "Re-engage applications that haven't received a response after 7+ days.",
    description: "Draft polite, professional follow-up nudges referencing your initial submission date.",
    category: "applications",
    badge: "Nudge",
    estimatedCreditsPerJob: 3,
    defaultJobLimit: 3,
    maxJobLimit: 5,
    stages: [
      {
        id: "scan_stale",
        stepNumber: 1,
        label: "Identify Stale Applications",
        actionButtonLabel: "Find Stale Applications",
        description: "Locate submitted jobs waiting for replies.",
      },
      {
        id: "draft_bumps",
        stepNumber: 2,
        label: "Draft Follow-Up Nudges",
        actionButtonLabel: "Draft Follow-Up Emails",
        description: "Generate courteous follow-up check-ins.",
      },
    ],
  },
};

export const DEFAULT_RECIPE_ID = "recruiter_cold_outreach";

export type SkillCategory =
  | "apply"
  | "research"
  | "writing"
  | "profile"
  | "tracking";

export type SkillTrigger = "mention" | "slash";
export type SkillTriggerType = SkillTrigger | "both";

export type SkillStatus =
  | "queued"
  | "running"
  | "needs_approval"
  | "completed"
  | "failed";

export type SkillConfidence = "high" | "medium" | "low";

export type SkillExecutionInput = {
  invocationId: string;
  skillId: string;
  trigger: SkillTrigger;
  rawCommand: string;
  userInstruction: string;
  args: Record<string, unknown>;
  conversationContext?: Array<{
    role: "user" | "assistant" | "skill" | "system";
    content: string;
  }>;
  progress?: (label: string) => void;
};

export type SkillExecutionResult<
  TOutput extends Record<string, unknown> = Record<string, unknown>,
> = {
  status: Extract<SkillStatus, "needs_approval" | "completed" | "failed">;
  content: string;
  output: TOutput;
};

export type JobrakerChatSkill = {
  id: string;
  name: string;
  aliases: string[];
  description: string;
  icon: string;
  category: SkillCategory;
  triggerType: SkillTriggerType;
  inputSchema: Record<string, unknown>;
  statusStates: SkillStatus[];
  execute: (
    input: SkillExecutionInput,
  ) => Promise<SkillExecutionResult<Record<string, unknown>>>;
};

export type ParsedSkillCall = {
  detected: boolean;
  skillId: string;
  trigger: SkillTrigger;
  rawCommand: string;
  userInstruction: string;
  args: Record<string, unknown>;
};

export type SkillPaletteTrigger = {
  mode: SkillTrigger;
  query: string;
  token: string;
  start: number;
  end: number;
};

export type ChatSkillCall = {
  id: string;
  skillId: string;
  skillName: string;
  status: SkillStatus;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  progress?: string[];
};

export type DirectApplyChannelType =
  | "careers_page"
  | "recruitment_email"
  | "official_form"
  | "job_board"
  | "unknown";

export type DirectApplyDraftStatus =
  | "ready_for_review"
  | "draft_created"
  | "sent_after_approval"
  | "needs_review"
  | "not_started";

export type DirectApplyInboxAction = {
  id:
    | "create_drafts"
    | "send_approved"
    | "track_replies"
    | "follow_up_reminders"
    | "label_job_emails";
  label: string;
  description: string;
  toolName:
    | "create_gmail_job_draft"
    | "send_gmail_job_email"
    | "refresh_application_processes"
    | "label_gmail_job_emails"
    | "notifications";
  approvalRequired: boolean;
  connectedInboxRequired: boolean;
};

export type DirectApplyResult = {
  companyName: string;
  role: string;
  channelType: DirectApplyChannelType;
  channelValue: string;
  confidence: SkillConfidence;
  confidenceScore: number;
  recommendedAction: string;
  draftStatus: DirectApplyDraftStatus;
  approvalStatus: "not_requested" | "pending_user_review";
  draftPreview: {
    subject: string;
    body: string;
  };
  approvalCommand?: string;
  draftCommand?: string;
};

export type DirectApplyOutput = {
  results: DirectApplyResult[];
  summary: {
    total: number;
    highConfidence: number;
    needsReview: number;
    lowConfidence: number;
  };
  progress: string[];
  approvalStatus: "not_requested" | "pending_user_review";
  needsClarification?: {
    reason: string;
    suggestedPrompts: string[];
  };
  connectedInbox: {
    provider: "gmail" | "outlook" | "unknown";
    status: "available_when_connected";
    supportedActions: DirectApplyInboxAction[];
  };
};

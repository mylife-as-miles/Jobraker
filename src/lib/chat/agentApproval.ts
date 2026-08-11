export type AgentApprovalStepKind =
  | "browser"
  | "application"
  | "email"
  | "data"
  | "credits"
  | "plan";

export type AgentApprovalStep = {
  approvalKey: string;
  toolName: string;
  title: string;
  detail: string;
  kind: AgentApprovalStepKind;
};

export type AgentApprovalRequest = {
  id: string;
  title: string;
  description: string;
  steps: AgentApprovalStep[];
  createdAt: number;
  decision?: "approved" | "declined";
};

export type ApprovedToolCall = {
  approvalKey: string;
};

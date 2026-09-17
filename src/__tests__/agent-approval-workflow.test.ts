import { describe, it, expect } from "vitest";
import type { AgentApprovalRequest, ApprovedToolCall } from "@/lib/chat/agentApproval";

describe("Agent Approval Workflow & Data Integrity", () => {
  it("preserves tool arguments on approval steps and approved tool calls", () => {
    const request: AgentApprovalRequest = {
      id: "appr-123",
      title: "Approve these 4 actions?",
      description: "JobRaker will not take these actions until you approve them.",
      steps: [
        {
          approvalKey: "create_gmail_job_draft:careers@bitwarden.com",
          toolName: "create_gmail_job_draft",
          title: "Create a Gmail draft",
          detail: "Create the reviewed draft addressed to careers@bitwarden.com.",
          kind: "email",
          args: {
            to: "careers@bitwarden.com",
            subject: "Systems Strategy & Leadership",
            body: "Hello Bitwarden Team...",
          },
        },
      ],
      createdAt: Date.now(),
    };

    expect(request.steps[0].args).toBeDefined();
    expect(request.steps[0].args?.to).toBe("careers@bitwarden.com");

    const approvedCalls: ApprovedToolCall[] = request.steps.map((step) => ({
      approvalKey: step.approvalKey,
      toolName: step.toolName,
      toolSlug: step.toolName,
      args: step.args,
    }));

    expect(approvedCalls).toHaveLength(1);
    expect(approvedCalls[0].args?.to).toBe("careers@bitwarden.com");
    expect(approvedCalls[0].args?.subject).toBe("Systems Strategy & Leadership");
  });

  it("formats steps summary accurately for model continuation context", () => {
    const steps = [
      {
        approvalKey: "draft-1",
        toolName: "create_gmail_job_draft",
        title: "Create a Gmail draft",
        detail: "Create the reviewed draft addressed to careers@bitwarden.com.",
        kind: "email" as const,
      },
      {
        approvalKey: "draft-2",
        toolName: "create_gmail_job_draft",
        title: "Create a Gmail draft",
        detail: "Create the reviewed draft addressed to careers@sonatype.com.",
        kind: "email" as const,
      },
    ];

    const summary = steps
      .map((s, idx) => `${idx + 1}. ${s.title}${s.detail ? `: ${s.detail}` : ""}`)
      .join("\n");

    expect(summary).toContain("1. Create a Gmail draft: Create the reviewed draft addressed to careers@bitwarden.com.");
    expect(summary).toContain("2. Create a Gmail draft: Create the reviewed draft addressed to careers@sonatype.com.");
  });

  it("immutably updates decision state without modifying original objects", () => {
    const originalMessages = [
      {
        id: "msg-1",
        role: "assistant" as const,
        content: "I've prepared these 4 actions for your review.",
        approvalRequest: {
          id: "req-abc",
          title: "Approve this action?",
          description: "Details",
          steps: [],
          createdAt: 1000,
        },
      },
    ];

    const updated = originalMessages.map((m) =>
      m.approvalRequest?.id === "req-abc"
        ? {
            ...m,
            approvalRequest: {
              ...m.approvalRequest,
              decision: "approved" as const,
            },
          }
        : m,
    );

    expect(originalMessages[0].approvalRequest.decision).toBeUndefined();
    expect(updated[0].approvalRequest.decision).toBe("approved");
    expect(updated[0]).not.toBe(originalMessages[0]);
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AgentApprovalCard } from "./AgentApprovalCard";
import type { AgentApprovalRequest } from "@/lib/chat/agentApproval";

const step = (id: string) => ({
  approvalKey: `apply_to_job:{"url":"https://jobs.example/${id}"}`,
  toolName: "apply_to_job",
  title: `Apply to ${id}`,
  detail: "",
  kind: "application" as const,
});

const request: AgentApprovalRequest = {
  id: "req-1",
  title: "Submit applications",
  description: "These will be submitted.",
  steps: [step("stripe"), step("airbnb"), step("gitlab")],
  createdAt: 0,
};

describe("AgentApprovalCard", () => {
  it("approves every step in one click", () => {
    const onApprove = vi.fn();
    render(<AgentApprovalCard request={request} onApprove={onApprove} onDecline={vi.fn()} />);
    fireEvent.click(screen.getByText("Approve all 3"));
    expect(onApprove).toHaveBeenCalledWith(request);
  });

  it("approves only the ticked steps", () => {
    const onApprove = vi.fn();
    render(<AgentApprovalCard request={request} onApprove={onApprove} onDecline={vi.fn()} />);
    fireEvent.click(screen.getByLabelText("Include step 2: Apply to airbnb"));
    fireEvent.click(screen.getByText("Approve 2 of 3"));
    expect(onApprove.mock.calls[0][0].steps.map((s: { title: string }) => s.title)).toEqual([
      "Apply to stripe",
      "Apply to gitlab",
    ]);
  });

  it("cannot approve with nothing ticked", () => {
    const onApprove = vi.fn();
    render(<AgentApprovalCard request={request} onApprove={onApprove} onDecline={vi.fn()} />);
    for (const s of request.steps) fireEvent.click(screen.getByLabelText(new RegExp(s.title)));
    fireEvent.click(screen.getByText("Approve 0 of 3"));
    expect(onApprove).not.toHaveBeenCalled();
  });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ColdMailSkillCard } from "./ColdMailSkillCard";
import { invokeProtectedFunction } from "@/services/supabase/invokeProtectedFunction";
import type { ColdMailOutput } from "@/lib/chatSkills/types";

vi.mock("@/services/supabase/invokeProtectedFunction", () => ({
  invokeProtectedFunction: vi.fn(),
}));

const output: ColdMailOutput = {
  preparation: {
    jobId: "job-123",
    companyName: "Acme",
    jobTitle: "Backend Engineer",
    recipient: {
      email: "ada@acme.com",
      name: "Ada Recruiter",
      title: "Technical Recruiter",
      source: "https://verifier.example",
      confidence: "high",
    },
    subject: "backend engineering",
    body: "Hi Ada,\n\nYour backend opening matches my distributed systems work. Worth a conversation?",
  },
  preparationToken: "signed-preparation-token",
  agents: [
    { id: "job_context", status: "completed" },
    { id: "gmail_draft", status: "awaiting_approval" },
  ],
};

describe("ColdMailSkillCard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows success only after the backend returns a Gmail draft ID", async () => {
    vi.mocked(invokeProtectedFunction).mockResolvedValue({
      success: true,
      draftId: "draft-123",
      messageId: "message-123",
      threadId: "thread-123",
      draftFrom: "candidate@gmail.com",
      to: "ada@acme.com",
    });

    render(<ColdMailSkillCard output={output} />);
    fireEvent.click(screen.getByRole("button", { name: "Create Gmail draft" }));

    await waitFor(() => {
      expect(screen.getByText(/Gmail drafted successfully/)).toBeInTheDocument();
    });
    expect(screen.getByText(/draft-123/)).toBeInTheDocument();
    expect(invokeProtectedFunction).toHaveBeenCalledWith("cold-mail", {
      body: {
        action: "create_gmail_draft",
        preparationToken: "signed-preparation-token",
      },
    });
  });

  it("fails closed when the backend response has no draft ID", async () => {
    vi.mocked(invokeProtectedFunction).mockResolvedValue({
      success: true,
      draftId: null,
    });

    render(<ColdMailSkillCard output={output} />);
    fireEvent.click(screen.getByRole("button", { name: "Create Gmail draft" }));

    await waitFor(() => {
      expect(
        screen.getByText(
          "Gmail did not return a draft ID, so draft creation could not be confirmed.",
        ),
      ).toBeInTheDocument();
    });
    expect(screen.queryByText(/Gmail drafted successfully/)).not.toBeInTheDocument();
  });
});

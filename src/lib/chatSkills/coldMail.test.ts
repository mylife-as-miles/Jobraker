import { beforeEach, describe, expect, it, vi } from "vitest";

const { invokeProtectedFunctionMock } = vi.hoisted(() => ({
  invokeProtectedFunctionMock: vi.fn(),
}));

vi.mock("@/services/supabase/invokeProtectedFunction", () => ({
  invokeProtectedFunction: invokeProtectedFunctionMock,
}));

import {
  coldMailSkill,
  extractColdMailJobReferences,
  selectColdMailTarget,
  selectColdMailJobReference,
} from "./coldMail";

describe("Cold Mail current job-search context", () => {
  const searchResult = `I found these jobs:\n1. Backend Engineer at Acme (Remote | rtrvr | verified)\n   https://acme.com/jobs/1\n2. Platform Engineer at Globex (Lagos | direct)\n   https://globex.com/jobs/2`;

  beforeEach(() => invokeProtectedFunctionMock.mockReset());

  it("extracts individual jobs from the current AI Chat search result", () => {
    expect(extractColdMailJobReferences(searchResult)).toEqual([
      {
        jobTitle: "Backend Engineer",
        companyName: "Acme",
        applyUrl: "https://acme.com/jobs/1",
      },
      {
        jobTitle: "Platform Engineer",
        companyName: "Globex",
        applyUrl: "https://globex.com/jobs/2",
      },
    ]);
  });

  it("selects an ordinal job requested by the user", () => {
    const references = extractColdMailJobReferences(searchResult);

    expect(selectColdMailJobReference(references, "draft for the second job")).toEqual({
      jobTitle: "Platform Engineer",
      companyName: "Globex",
      applyUrl: "https://globex.com/jobs/2",
    });
  });

  it("does not guess when several jobs exist and none is selected", () => {
    const references = extractColdMailJobReferences(searchResult);

    expect(selectColdMailJobReference(references, "create a cold email")).toBeNull();
  });

  it("selects a structured target while preserving its stable job ID", () => {
    const targets = [
      {
        jobId: "job-1",
        jobTitle: "Backend Engineer",
        companyName: "Acme",
        applyUrl: "https://acme.com/jobs/1",
      },
      {
        jobId: "job-2",
        jobTitle: "Platform Engineer",
        companyName: "Globex",
        applyUrl: "https://globex.com/jobs/2",
      },
    ];

    expect(selectColdMailTarget(targets, "use the second job")).toEqual(
      targets[1],
    );
  });

  it("starts one opportunity discovery when no individual target is available", async () => {
    invokeProtectedFunctionMock.mockResolvedValueOnce({
      success: true,
      status: "awaiting_target_selection",
      searchQuery: "Backend Engineer",
      location: "Remote",
      targets: [
        {
          jobId: "job-1",
          jobTitle: "Backend Engineer",
          companyName: "Acme",
          applyUrl: "https://acme.com/jobs/1",
          location: "Remote",
        },
      ],
    });

    const result = await coldMailSkill.execute({
      args: { roleQuery: "Backend Engineer", location: "Remote" },
      userInstruction: "",
      conversationContext: [],
    } as never);

    expect(invokeProtectedFunctionMock).toHaveBeenCalledTimes(1);
    expect(invokeProtectedFunctionMock).toHaveBeenCalledWith("cold-mail", {
      body: {
        action: "discover",
        searchQuery: "Backend Engineer",
        location: "Remote",
        limit: 10,
      },
    });
    expect(result.status).toBe("completed");
    expect(result.output.targets).toHaveLength(1);
  });

  it("prepares from a selected structured target by stable job ID", async () => {
    invokeProtectedFunctionMock.mockResolvedValueOnce({
      success: true,
      status: "needs_approval",
      preparationToken: "signed-token",
      preparation: {
        jobId: "job-2",
        companyName: "Globex",
        jobTitle: "Platform Engineer",
      },
    });

    await coldMailSkill.execute({
      args: {
        coldMailTargets: [
          {
            jobId: "job-1",
            jobTitle: "Backend Engineer",
            companyName: "Acme",
            applyUrl: "https://acme.com/jobs/1",
          },
          {
            jobId: "job-2",
            jobTitle: "Platform Engineer",
            companyName: "Globex",
            applyUrl: "https://globex.com/jobs/2",
          },
        ],
      },
      userInstruction: "draft for the second job",
      conversationContext: [],
    } as never);

    expect(invokeProtectedFunctionMock).toHaveBeenCalledWith("cold-mail", {
      body: expect.objectContaining({
        action: "prepare",
        jobId: "job-2",
        companyName: "Globex",
      }),
    });
  });

  it("sends the selected job URL to the cold-mail Edge Function", async () => {
    invokeProtectedFunctionMock.mockResolvedValueOnce({
      success: true,
      status: "needs_approval",
      preparationToken: "signed-token",
      preparation: {
        companyName: "Globex",
        jobTitle: "Platform Engineer",
      },
    });

    await coldMailSkill.execute({
      args: {},
      userInstruction: "draft for the second job",
      conversationContext: [{ role: "assistant", content: searchResult }],
    } as never);

    expect(invokeProtectedFunctionMock).toHaveBeenCalledWith("cold-mail", {
      body: expect.objectContaining({
        companyName: "Globex",
        jobTitle: "Platform Engineer",
        applyUrl: "https://globex.com/jobs/2",
      }),
    });
  });
});

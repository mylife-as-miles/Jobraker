import { describe, expect, it } from "vitest";
import { applicationChatActions, jobChatActions } from "./chatActions";

describe("context chat actions", () => {
  it("names the job in every prompt so the agent does not have to ask", () => {
    const actions = jobChatActions({
      id: "job-1",
      title: "Backend Engineer",
      company: "Stripe",
      apply_url: "https://stripe.com/jobs/1",
    });
    expect(actions.length).toBeGreaterThan(0);
    for (const action of actions) {
      expect(action.prompt).toContain("Backend Engineer job at Stripe");
      expect(action.prompt).toContain("job-1");
    }
  });

  it("names the application and copes with missing fields", () => {
    const [first] = applicationChatActions({ id: "app-9", job_title: null, company: "GitLab" });
    expect(first.prompt).toContain("application id app-9");
    expect(first.prompt).toContain("this role at GitLab");
  });
});

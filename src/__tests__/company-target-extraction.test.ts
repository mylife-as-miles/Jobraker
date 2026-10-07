import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: null } }) },
  },
}));

import { resolveTargetCompanies } from "@/lib/chatSkills/directApply";

const input = (userInstruction: string, conversationContext: Array<{ role: "user" | "assistant"; content: string }> = []) => ({
  skillId: "cold_mail",
  userInstruction,
  args: {},
  conversationContext,
});

describe("resolveTargetCompanies", () => {
  it("ignores job titles and markdown in earlier assistant replies", async () => {
    const assistantTable = [
      "Here are your matches:",
      "- **Senior Product Manager**",
      "- **Software Engineer**",
      "- **Head of Operations**",
      "- Cold Mail",
    ].join("\n");
    const companies = await resolveTargetCompanies(
      input("/recruiter-scout find the recruiter", [{ role: "assistant", content: assistantTable }]) as never,
    );
    expect(companies).toEqual([]);
  });

  it("still reads companies the user names", async () => {
    const companies = await resolveTargetCompanies(
      input("/recruiter-outreach find the recruiter at Stripe and Airbnb") as never,
    );
    expect(companies).toEqual(["Stripe", "Airbnb"]);
  });

  it("drops job titles from a typed company list", async () => {
    const companies = await resolveTargetCompanies(
      input("Stripe, Airbnb, Software Engineer, GitLab") as never,
    );
    expect(companies).toEqual(["Stripe", "Airbnb", "GitLab"]);
  });
});

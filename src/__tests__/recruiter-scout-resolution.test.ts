import { describe, it, expect, vi } from "vitest";
import { parseSkillCall } from "@/lib/chatSkills/parser";
import { companyScoutSkill } from "@/lib/chatSkills/companyScout";

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "test-user-123" } },
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { company: "Google", job_title: "Trust and Safety Lead" },
              }),
            }),
          }),
        }),
      }),
    }),
  },
}));

describe("RecruiterScout skill alias and resolution", () => {
  it("correctly parses @RecruiterScout mention", () => {
    const prompt = "@RecruiterScout find the hiring manager and verified recruiter contacts for my latest application";
    const parsed = parseSkillCall(prompt);

    expect(parsed.detected).toBe(true);
    expect(parsed.skillId).toBe("company_scout");
    expect(parsed.trigger).toBe("mention");
    expect(parsed.rawCommand).toBe("@RecruiterScout");
  });

  it("has Recruiter Scout name and expected aliases", () => {
    expect(companyScoutSkill.name).toBe("Recruiter Scout");
    expect(companyScoutSkill.aliases).toContain("@RecruiterScout");
    expect(companyScoutSkill.aliases).toContain("/recruiter-scout");
  });
});

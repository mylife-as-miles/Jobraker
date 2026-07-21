import { describe, expect, it } from "vitest";
import { initialResumeState } from "@/store/artboard";
import {
  buildCandidateProfileSnapshot,
  fillCoverLetterSenderFromCandidateProfile,
  fillResumeFromCandidateProfile,
} from "@/lib/candidateProfileSnapshot";

const profile = {
  id: "user-1",
  first_name: "Ada",
  last_name: "Lovelace",
  job_title: "Engineer",
  experience_years: 5,
  location: "London",
  location_scope: "global" as const,
  goals: [],
  updated_at: "2026-07-21",
  phone: "+44 100",
  github_data: {
    username: "ada",
    profile_url: "https://github.com/ada",
    bio: "Computing pioneer",
    top_languages: ["TypeScript"],
    top_repositories: [{ id: 1, name: "Engine", description: "A project" }],
  },
};

const snapshot = buildCandidateProfileSnapshot({
  profile,
  email: "ada@example.com",
  experiences: [{
    id: "exp-1", user_id: "user-1", title: "Engineer", company: "Analytical",
    location: "London", start_date: "2024", end_date: null, is_current: true,
    description: "Built engines", created_at: "", updated_at: "",
  }],
  skills: [{
    id: "skill-1", user_id: "user-1", name: "Mathematics", level: "Expert",
    category: "", created_at: "", updated_at: "",
  }],
});

describe("candidate profile document mapping", () => {
  it("builds a complete, deterministic candidate snapshot", () => {
    expect(snapshot.name).toBe("Ada Lovelace");
    expect(snapshot.experience[0].period).toBe("2024 - Present");
    expect(snapshot.skills.map((item) => item.name)).toEqual(["Mathematics", "TypeScript"]);
    expect(snapshot.projects[0].id).toBe("github-project-1");
  });

  it("fills untouched resume fields and sections", () => {
    const result = fillResumeFromCandidateProfile(
      structuredClone(initialResumeState.data),
      initialResumeState.data,
      snapshot,
    );

    expect(result.basics.name).toBe("Ada Lovelace");
    expect(result.summary.content).toBe("Computing pioneer");
    expect(result.sections.experience.items[0].company).toBe("Analytical");
    expect(result.sections.projects.hidden).toBe(false);
  });

  it("does not overwrite edited resume or cover-letter values", () => {
    const edited = structuredClone(initialResumeState.data);
    edited.basics.name = "My edited name";
    edited.sections.experience.items = [{ id: "mine", hidden: false, company: "Mine" }];
    const result = fillResumeFromCandidateProfile(edited, initialResumeState.data, snapshot);

    expect(result.basics.name).toBe("My edited name");
    expect(result.sections.experience.items[0].company).toBe("Mine");
    expect(fillCoverLetterSenderFromCandidateProfile(
      { name: "Custom", email: "", phone: "", address: "" },
      snapshot,
    )).toEqual({
      name: "Custom",
      email: "ada@example.com",
      phone: "+44 100",
      address: "London",
    });
  });
});

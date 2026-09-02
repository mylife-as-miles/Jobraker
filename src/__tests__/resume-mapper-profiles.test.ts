import { describe, expect, it } from "vitest";
import { initialResumeState } from "@/store/artboard";
import { mapParsedDataToResume } from "@/lib/resume-mapper";
import {
  inferSocialProfileFromUrl,
  buildFallbackParsedProfileData,
  type ParsedProfileData,
} from "@/services/ai/parseResumeProfile";

describe("social profile inference and resume data mapping", () => {
  it("infers network and username from various URL formats", () => {
    const linkedin = inferSocialProfileFromUrl("https://www.linkedin.com/in/alex-smith-dev");
    expect(linkedin.network).toBe("LinkedIn");
    expect(linkedin.username).toBe("alex-smith-dev");
    expect(linkedin.url).toBe("https://www.linkedin.com/in/alex-smith-dev");

    const github = inferSocialProfileFromUrl("github.com/alexsmith");
    expect(github.network).toBe("GitHub");
    expect(github.username).toBe("alexsmith");
    expect(github.url).toBe("https://github.com/alexsmith");

    const x = inferSocialProfileFromUrl("https://x.com/alexcodes");
    expect(x.network).toBe("X");
    expect(x.username).toBe("alexcodes");

    const portfolio = inferSocialProfileFromUrl("https://alexsmith.io");
    expect(portfolio.network).toBe("Portfolio");
    expect(portfolio.url).toBe("https://alexsmith.io");
  });

  it("maps parsed education and profiles directly into resume data", () => {
    const parsed: ParsedProfileData = {
      firstName: "Alex",
      lastName: "Smith",
      email: "alex@example.com",
      phone: "555-0199",
      location: "San Francisco, CA",
      jobTitle: "Senior Staff Engineer",
      experienceYears: 8,
      about: "Experienced systems engineer.",
      website: "https://alexsmith.io",
      profiles: [
        {
          network: "LinkedIn",
          url: "https://linkedin.com/in/alexsmith",
          username: "alexsmith",
        },
        {
          network: "GitHub",
          url: "https://github.com/alexsmith",
          username: "alexsmith",
        },
      ],
      skills: ["TypeScript", "Rust", "PostgreSQL"],
      education: [
        {
          school: "UC Berkeley",
          degree: "B.S. in Electrical Engineering & Computer Science",
          start: "2016",
          end: "2020",
        },
      ],
      experience: [
        {
          company: "Acme Corp",
          title: "Senior Engineer",
          startDate: "2020",
          endDate: "Present",
          description: "Leading cloud architecture.",
        },
      ],
      projects: [],
      certifications: [],
    };

    const mapped = mapParsedDataToResume(parsed, initialResumeState.data);

    // Verify basics & profiles
    expect(mapped.basics.name).toBe("Alex Smith");
    expect(mapped.basics.email).toBe("alex@example.com");
    expect(mapped.basics.headline).toBe("Senior Staff Engineer");
    expect(mapped.basics.website.url).toBe("https://alexsmith.io");
    expect(mapped.basics.profiles).toEqual([
      {
        network: "LinkedIn",
        username: "alexsmith",
        url: "https://linkedin.com/in/alexsmith",
        icon: "linkedin",
      },
      {
        network: "GitHub",
        username: "alexsmith",
        url: "https://github.com/alexsmith",
        icon: "github",
      },
    ]);

    // Verify education
    expect(mapped.sections.education.hidden).toBe(false);
    expect(mapped.sections.education.items).toHaveLength(1);
    expect(mapped.sections.education.items[0].school).toBe("UC Berkeley");
    expect(mapped.sections.education.items[0].degree).toBe("B.S. in Electrical Engineering & Computer Science");
    expect(mapped.sections.education.items[0].period).toBe("2016 - 2020");

    // Verify metadata source is tagged as imported
    expect(mapped.metadata.sourceType).toBe("imported");
  });

  it("extracts and maps fallback profiles from resume text URLs", () => {
    const resumeText = `
Alex Smith
Senior Staff Engineer
alex@example.com | https://linkedin.com/in/alexsmith | https://github.com/alexsmith

## Education
Stanford University
Master of Science in Computer Science
2020 - 2022

## Experience
Google
Staff Software Engineer
2022 - Present
Built scalable search infrastructure.
`;

    const fallback = buildFallbackParsedProfileData(resumeText, "Alex Smith Resume");
    expect(fallback.profiles && fallback.profiles.length).toBeGreaterThanOrEqual(2);
    expect(fallback.education).toHaveLength(1);
    expect(fallback.education[0].school).toContain("Stanford University");

    const mapped = mapParsedDataToResume(fallback, initialResumeState.data);
    expect(mapped.basics.profiles.some((p) => p.network === "LinkedIn")).toBe(true);
    expect(mapped.basics.profiles.some((p) => p.network === "GitHub")).toBe(true);
    expect(mapped.sections.education.items).toHaveLength(1);
    expect(mapped.sections.education.items[0].school).toContain("Stanford");
  });
});

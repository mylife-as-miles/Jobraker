import { describe, expect, it } from "vitest";
import { sanitizeParsedProfileData } from "@/services/ai/parseResumeProfile";
import { mapParsedDataToResume } from "@/lib/resume-mapper";
import { initialResumeState } from "@/store/artboard";

describe("lossless imported resume mapping", () => {
  it("preserves every supported CV section when mapping into a template", () => {
    const parsed = sanitizeParsedProfileData({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      phone: "+44 20 0000 0000",
      location: "London, UK",
      website: "https://ada.example.com",
      profiles: [
        {
          network: "LinkedIn",
          username: "ada",
          url: "https://linkedin.com/in/ada",
        },
      ],
      jobTitle: "Principal Engineer",
      experienceYears: 12,
      about: "Principal engineer working on analytical systems.",
      skills: ["TypeScript", "Python", "System Design"],
      education: [
        {
          school: "University of London",
          degree: "BSc Mathematics",
          start: "2008",
          end: "2012",
        },
      ],
      experience: [
        {
          company: "Analytical Engines Ltd",
          title: "Principal Engineer",
          location: "London",
          startDate: "2020",
          endDate: "Present",
          description: "Led the platform programme.\nReduced processing time by 40%.",
        },
        {
          company: "Difference Systems",
          title: "Senior Engineer",
          startDate: "2016",
          endDate: "2020",
          description: "Built distributed calculation services.",
        },
      ],
      projects: [
        {
          name: "Engine Modernisation",
          organization: "Analytical Engines Ltd",
          date: "2024",
          description: "Modernised the core calculation engine.",
        },
      ],
      certifications: [
        {
          name: "Cloud Architect",
          issuer: "Cloud Guild",
          date: "2023",
          description: "Professional certification.",
        },
      ],
      languages: [
        { name: "English", description: "Native" },
        { name: "French", description: "Professional working proficiency" },
      ],
      interests: [
        {
          name: "Computing history",
          description: "Research and public speaking",
          keywords: ["Research", "Speaking"],
        },
      ],
      awards: [
        {
          name: "Engineering Leadership Award",
          issuer: "Tech Society",
          date: "2022",
          description: "Recognised for technical leadership.",
        },
      ],
      publications: [
        {
          name: "Notes on Analytical Systems",
          publisher: "Engineering Journal",
          date: "2021",
          description: "A paper on reliable analytical systems.",
          url: "https://example.com/paper",
        },
      ],
      volunteer: [
        {
          organization: "Code Mentors",
          position: "Mentor",
          location: "Remote",
          startDate: "2019",
          endDate: "Present",
          description: "Mentored early-career engineers.",
        },
      ],
      references: [
        {
          name: "Grace Hopper",
          description: "Former engineering director",
          email: "grace@example.com",
          phone: "+1 555 0100",
        },
      ],
    });

    const mapped = mapParsedDataToResume(
      parsed,
      structuredClone(initialResumeState.data),
    );

    expect(mapped.basics.website.url).toBe("https://ada.example.com");
    expect(mapped.basics.profiles).toHaveLength(1);
    expect(mapped.sections.experience.items).toHaveLength(2);
    expect(mapped.sections.education.items).toHaveLength(1);
    expect(mapped.sections.skills.items).toHaveLength(3);
    expect(mapped.sections.projects.items).toHaveLength(1);
    expect(mapped.sections.certifications.items).toHaveLength(1);
    expect(mapped.sections.languages.items).toHaveLength(2);
    expect(mapped.sections.interests.items).toHaveLength(1);
    expect(mapped.sections.awards.items).toHaveLength(1);
    expect(mapped.sections.publications.items).toHaveLength(1);
    expect(mapped.sections.volunteer.items).toHaveLength(1);
    expect(mapped.sections.references.items).toHaveLength(1);
    expect(mapped.sections.experience.items[0].description).toContain(
      "Reduced processing time by 40%",
    );
  });

  it("retains repeated entries instead of collapsing them", () => {
    const parsed = sanitizeParsedProfileData({
      firstName: "Test",
      lastName: "Candidate",
      skills: ["JavaScript", "TypeScript", "JavaScript"],
      experience: [
        { company: "One", title: "Engineer", description: "First role" },
        { company: "Two", title: "Engineer", description: "Second role" },
        { company: "Three", title: "Engineer", description: "Third role" },
      ],
      education: [],
      projects: [],
      certifications: [],
      languages: [],
      interests: [],
      awards: [],
      publications: [],
      volunteer: [],
      references: [],
    });

    const mapped = mapParsedDataToResume(
      parsed,
      structuredClone(initialResumeState.data),
    );

    expect(mapped.sections.experience.items.map((item) => item.company)).toEqual([
      "One",
      "Two",
      "Three",
    ]);
    expect(mapped.sections.skills.items.map((item) => item.name)).toEqual([
      "JavaScript",
      "TypeScript",
      "JavaScript",
    ]);
  });
});

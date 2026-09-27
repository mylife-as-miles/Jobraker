import { describe, it, expect } from "vitest";
import { classifyQuestion } from "../../backend/supabase/shared/ats/questions";
import { classifyLocation } from "../../backend/supabase/shared/ats/location";
import { htmlToText } from "../../backend/supabase/shared/ats/text";
import {
  greenhouseAdapter,
  normalizeGreenhouseQuestions,
} from "../../backend/supabase/shared/ats/greenhouse";
import { normalizeRecruiteeOffer } from "../../backend/supabase/shared/ats/recruitee";
import { normalizeAshbyJob } from "../../backend/supabase/shared/ats/ashby";
import { normalizeLeverPosting } from "../../backend/supabase/shared/ats/lever";
import { parseSalarySummary } from "../../backend/supabase/shared/ats/salary";

describe("parseSalarySummary", () => {
  it("parses symbols and K suffixes", () => {
    expect(parseSalarySummary("€110K – €185K")).toEqual({ min: 110000, max: 185000, currency: "EUR" });
    expect(parseSalarySummary("$90,000 - $120,000")).toEqual({ min: 90000, max: 120000, currency: "USD" });
    expect(parseSalarySummary("")).toEqual({ min: null, max: null, currency: null });
  });
});

describe("Ashby adapter", () => {
  it("normalizes an EU remote job with compensation", () => {
    const job = normalizeAshbyJob(
      {
        id: "a1", title: "Engineering Manager - EU", location: "Remote - European Union", isRemote: true, workplaceType: "Remote",
        secondaryLocations: [{ location: "Spain" }, { location: "Italy" }],
        applyUrl: "https://jobs.ashbyhq.com/x/a1/application", jobUrl: "https://jobs.ashbyhq.com/x/a1",
        compensation: { scrapeableCompensationSalarySummary: "€110K - €185K" }, publishedAt: "2024-03-04T14:29:08Z",
      },
      "X",
    );
    expect(job.remoteScope).toBe("restricted");
    expect(job.countries).toContain("ES");
    expect(job).toMatchObject({ salaryMin: 110000, salaryMax: 185000, salaryCurrency: "EUR", questions: null });
  });
});

describe("Lever adapter", () => {
  it("keeps a Global role worldwide despite the entity country", () => {
    const job = normalizeLeverPosting(
      {
        id: "l1", text: "Account Director", country: "CO", workplaceType: "remote",
        categories: { location: "Global", commitment: "Contractor", department: "Business Units", allLocations: ["Global"] },
        applyUrl: "https://jobs.lever.co/x/l1/apply", hostedUrl: "https://jobs.lever.co/x/l1", createdAt: 1772012537082,
      },
      "X",
    );
    expect(job).toMatchObject({ remoteScope: "worldwide", countries: [], employmentType: "Contractor" });
  });

  it("uses the entity country for a plain remote role", () => {
    const job = normalizeLeverPosting(
      { id: "l2", text: "Engineer", country: "US", workplaceType: "remote", categories: { location: "Remote" }, applyUrl: "https://jobs.lever.co/x/l2/apply" },
      "X",
    );
    expect(job).toMatchObject({ remoteScope: "restricted", countries: ["US"] });
  });
});

describe("classifyQuestion", () => {
  it.each([
    ["First Name", "first_name"],
    ["What is your current and expected CTC (fixed + variable, annual?)", "current_salary"],
    ["What is you current notice period (in days)? Please specify if this is negotiable?", "notice_period"],
    ["Are you legally authorized to work in the United States?", "work_authorization"],
    ["Will you now or in the future require visa sponsorship?", "sponsorship"],
    ["How did you hear about us?", "how_heard"],
    ["Please choose the country in which you are located.", "country_residence"],
    ["Have you ever worked for Figma before, as an employee or a contractor?", "previously_employed"],
    ["LinkedIn Profile", "linkedin"],
  ])("maps %s", (label, key) => {
    expect(classifyQuestion(label)).toBe(key);
  });

  it("returns null for unknown questions", () => {
    expect(classifyQuestion("Tell us about your favourite dinosaur")).toBeNull();
  });
});

describe("classifyLocation", () => {
  it("treats plain Remote and Anywhere as worldwide", () => {
    expect(classifyLocation("Remote").remoteScope).toBe("worldwide");
    expect(classifyLocation("Remote - Anywhere").remoteScope).toBe("worldwide");
  });
  it("restricts remote jobs that name a country or region", () => {
    expect(classifyLocation("Remote - US")).toEqual({ remoteScope: "restricted", countries: ["US"] });
    expect(classifyLocation("Remote, EMEA").remoteScope).toBe("restricted");
  });
  it("marks named offices as onsite with their country", () => {
    expect(classifyLocation("Noida, Delhi NCR")).toEqual({ remoteScope: "onsite", countries: ["IN"] });
  });
  it("detects hybrid", () => {
    expect(classifyLocation("London (Hybrid)").remoteScope).toBe("hybrid");
  });
});

describe("htmlToText", () => {
  it("decodes escaped Greenhouse HTML", () => {
    expect(htmlToText("&lt;p&gt;Hello &amp;amp; welcome&lt;/p&gt;")).toBe("Hello & welcome");
  });
});

describe("Greenhouse adapter", () => {
  const list = {
    jobs: [
      { id: 1, title: "Engineer", absolute_url: "https://boards.greenhouse.io/x/jobs/1", location: { name: "Remote" }, updated_at: "2026-09-01T00:00:00Z" },
      { id: 2, title: "Manager", absolute_url: "https://boards.greenhouse.io/x/jobs/2", location: { name: "Noida, Delhi NCR" }, updated_at: "2026-09-02T00:00:00Z" },
    ],
  };
  const detail = {
    questions: [
      { label: "First Name", required: true, fields: [{ name: "first_name", type: "input_text", values: [] }] },
      { label: "What is your current and expected CTC?", required: true, fields: [{ name: "q1", type: "input_text", values: [] }] },
    ],
    location_questions: [{ required: true }],
  };

  it("normalizes questions with canonical keys", () => {
    const qs = normalizeGreenhouseQuestions(detail);
    expect(qs.map((q) => q.key)).toEqual(["first_name", "current_salary", "location_current"]);
    expect(qs.every((q) => q.required)).toBe(true);
  });

  it("fetches questions only for changed jobs", async () => {
    const calls: string[] = [];
    const fetchJson = async (url: string) => {
      calls.push(url);
      return url.includes("questions=true") ? detail : list;
    };
    const jobs = await greenhouseAdapter.fetchJobs(
      { ats: "greenhouse", boardToken: "x", name: "X" },
      fetchJson,
      { unchanged: (id) => id === "1" },
    );
    expect(jobs).toHaveLength(2);
    expect(jobs[0].questions).toBeUndefined();
    expect(jobs[1].questions?.length).toBe(3);
    expect(calls.filter((u) => u.includes("questions=true"))).toHaveLength(1);
    expect(jobs[1]).toMatchObject({ remoteScope: "onsite", countries: ["IN"], companyName: "X" });
  });
});

describe("Recruitee adapter", () => {
  it("normalizes a remote offer with open questions", () => {
    const job = normalizeRecruiteeOffer(
      {
        id: 7, title: "Node.js Engineer", remote: true, locations: [],
        careers_url: "https://x.recruitee.com/o/node", careers_apply_url: "https://x.recruitee.com/o/node/c/new",
        salary: { min: "5000", max: "7000", currency: "USD", period: "month" },
        open_questions: [
          { body: "Why are you interested in working at X?", required: true, kind: "text" },
          { body: "Info", required: false, kind: "infobox" },
        ],
      },
      "X",
    );
    expect(job.remoteScope).toBe("worldwide");
    expect(job.salaryMin).toBe(5000);
    expect(job.applyUrl).toBe("https://x.recruitee.com/o/node/c/new");
    const keys = job.questions?.map((q) => q.key);
    expect(keys).toContain("why_company");
    expect(job.questions?.some((q) => q.kind === "infobox")).toBe(false);
  });

  it("trusts a worldwide title over a list of hiring countries", () => {
    const job = normalizeRecruiteeOffer(
      {
        id: 8, title: "P2P Node.js Engineer (100% Remote, Worldwide)", remote: true,
        locations: [{ city: "Berlin", country: "Germany", country_code: "DE" }],
        careers_url: "https://x.recruitee.com/o/p2p", careers_apply_url: "https://x.recruitee.com/o/p2p/c/new",
      },
      "X",
    );
    expect(job.remoteScope).toBe("worldwide");
  });
});

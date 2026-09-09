import { describe, expect, it } from "vitest";
import {
  buildStarterFirecrawlSearchBody,
  buildRecruiterSearchQueries,
  extractStarterFirecrawlWebRows,
  extractPublishedRecruiterContacts,
  normalizeContactProviderContacts,
} from "../../backend/supabase/functions/_shared/recruiter-contact-discovery";

describe("recruiter contact discovery", () => {
  const context = {
    company: "Acme Labs",
    jobTitle: "Senior Backend Engineer",
    teamKeywords: ["platform engineering"],
    officialDomain: "acme.com",
  };

  it("searches official and public web sources in addition to LinkedIn", () => {
    const queries = buildRecruiterSearchQueries(context);

    expect(queries.linkedInRecruiters).toContain("site:linkedin.com/in/");
    expect(queries.officialPeople).toContain("site:acme.com");
    expect(queries.publicPeople).toContain("-site:linkedin.com");
    expect(queries.publicEmails).toContain('"@acme.com"');
  });

  it("reads Firecrawl v2 web results for Starter cold-mail discovery", () => {
    const rows = extractStarterFirecrawlWebRows({
      success: true,
      data: {
        web: [{
          url: "https://acme.com/company/people",
          title: "Maya Chen - Technical Recruiter | Acme Labs",
          description: "Contact maya.chen@acme.com about engineering roles.",
          markdown: "Maya Chen is a Technical Recruiter at Acme Labs.",
        }],
      },
    });

    expect(rows).toEqual([
      expect.objectContaining({
        url: "https://acme.com/company/people",
        title: "Maya Chen - Technical Recruiter | Acme Labs",
      }),
    ]);
  });

  it("keeps legacy Firecrawl rows compatible for Starter discovery", () => {
    const legacyRows = [{ url: "https://acme.com/careers" }];

    expect(extractStarterFirecrawlWebRows({ data: legacyRows })).toEqual(legacyRows);
    expect(extractStarterFirecrawlWebRows({ data: { web: "invalid" } })).toEqual([]);
    expect(extractStarterFirecrawlWebRows(null)).toEqual([]);
  });

  it("scrapes public Starter email sources but never LinkedIn results", () => {
    expect(buildStarterFirecrawlSearchBody(
      '"Acme Labs" recruiter "@acme.com" -site:linkedin.com',
      6,
      true,
    )).toEqual(expect.objectContaining({
      scrapeOptions: { formats: [{ type: "markdown" }] },
    }));

    expect(buildStarterFirecrawlSearchBody(
      'site:linkedin.com/in/ "Acme Labs" recruiter',
      8,
      true,
    )).not.toHaveProperty("scrapeOptions");
  });

  it("extracts an individually published recruiter email from an official team page", () => {
    const contacts = extractPublishedRecruiterContacts([
      {
        url: "https://acme.com/company/people",
        title: "Maya Chen - Technical Recruiter | Acme Labs",
        description:
          "Maya Chen is a Technical Recruiter for Acme Labs. Contact maya.chen@acme.com about engineering roles.",
        markdown: "",
        sourceQuery: "site:acme.com recruiter email",
      },
    ], context);

    expect(contacts).toEqual([
      expect.objectContaining({
        fullName: "Maya Chen",
        title: "Technical Recruiter",
        workEmail: "maya.chen@acme.com",
        emailStatus: "source_verified",
        emailSourceUrl: "https://acme.com/company/people",
        safeToContact: true,
      }),
    ]);
  });

  it("accepts only verified provider contacts on the official company domain", () => {
    const contacts = normalizeContactProviderContacts({
      contacts: [
        {
          full_name: "Ari Patel",
          title: "Head of Platform",
          email: "ari.patel@acme.com",
          status: "verified",
          confidence: 0.96,
        },
        {
          full_name: "Wrong Domain",
          title: "Recruiter",
          email: "person@example.net",
          status: "verified",
        },
        {
          full_name: "Catch All",
          title: "Recruiter",
          email: "catchall@acme.com",
          status: "catch_all",
        },
      ],
    }, { ...context, providerUrl: "https://contacts.example.test/search" });

    expect(contacts).toEqual([
      expect.objectContaining({
        fullName: "Ari Patel",
        workEmail: "ari.patel@acme.com",
        emailStatus: "provider_verified",
        safeToContact: true,
      }),
    ]);
  });
});

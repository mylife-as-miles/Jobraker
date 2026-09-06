import { describe, expect, it, vi } from "vitest";
import { ACTION_RECIPES } from "../lib/presets/actionRecipes";
import {
  type TargetOutreachJob,
  type RecruiterContactInfo,
  scoutRecruiterForJob,
  craftOutreachPitch,
  deliverOutreachEmail,
  fetchTopUncontactedJobs,
} from "../services/presets/recruiterOutreachService";

describe("1-Click Recruiter Outreach Preset & Recipes", () => {
  describe("ACTION_RECIPES Manifest", () => {
    it("registers recruiter_cold_outreach recipe with 3 single-click stages", () => {
      const recipe = ACTION_RECIPES.recruiter_cold_outreach;
      expect(recipe).toBeDefined();
      expect(recipe.id).toBe("recruiter_cold_outreach");
      expect(recipe.category).toBe("outreach");
      expect(recipe.badge).toBe("1-Click");
      expect(recipe.stages).toHaveLength(3);

      expect(recipe.stages[0].id).toBe("scout_emails");
      expect(recipe.stages[0].actionButtonLabel).toContain("Pull Recruiter Contacts");

      expect(recipe.stages[1].id).toBe("craft_messages");
      expect(recipe.stages[1].actionButtonLabel).toContain("Craft Outreach Pitches");

      expect(recipe.stages[2].id).toBe("deliver_drafts");
      expect(recipe.stages[2].actionButtonLabel).toContain("Create in Gmail Drafts");
    });

    it("has sane defaults for batch sizes", () => {
      const recipe = ACTION_RECIPES.recruiter_cold_outreach;
      expect(recipe.defaultJobLimit).toBe(3);
      expect(recipe.maxJobLimit).toBe(10);
    });
  });

  describe("Recruiter Scout 4-Tier Waterfall", () => {
    const mockJob: TargetOutreachJob = {
      id: "job-1",
      jobId: "uuid-1",
      title: "Senior Software Engineer",
      company: "Stripe",
      source: "searched",
      matchScore: 95,
    };

    it("selects Tier 1 verified talent partner when available", async () => {
      const mockSupabase = {
        functions: {
          invoke: vi.fn().mockResolvedValue({
            data: {
              recruiterContacts: [
                {
                  fullName: "Sarah Connor",
                  title: "Lead Technical Recruiter",
                  workEmail: "sarah@stripe.com",
                  emailStatus: "source_verified",
                  emailConfidence: 0.95,
                  emailSourceUrl: "https://stripe.com/jobs",
                  safeToContact: true,
                  roleKind: "recruiter",
                },
              ],
            },
            error: null,
          }),
        },
      } as any;

      const contact = await scoutRecruiterForJob(mockSupabase, mockJob);
      expect(contact.status).toBe("found");
      expect(contact.tier).toBe(1);
      expect(contact.fullName).toBe("Sarah Connor");
      expect(contact.email).toBe("sarah@stripe.com");
      expect(contact.confidence).toBe("high");
    });

    it("falls back to Tier 2 hiring manager when no pure recruiter is found", async () => {
      const mockSupabase = {
        functions: {
          invoke: vi.fn().mockResolvedValue({
            data: {
              recruiterContacts: [
                {
                  fullName: "David Chen",
                  title: "VP of Engineering",
                  workEmail: "david@stripe.com",
                  emailStatus: "provider_verified",
                  emailConfidence: 0.85,
                  safeToContact: true,
                  roleKind: "director",
                },
              ],
            },
            error: null,
          }),
        },
      } as any;

      const contact = await scoutRecruiterForJob(mockSupabase, mockJob);
      expect(contact.status).toBe("found");
      expect(contact.tier).toBe(2);
      expect(contact.fullName).toBe("David Chen");
      expect(contact.email).toBe("david@stripe.com");
    });

    it("falls back to Tier 3 talent inbox when individual contacts are absent", async () => {
      const mockSupabase = {
        functions: {
          invoke: vi.fn().mockResolvedValue({
            data: {
              recruiterContacts: [],
              contactEmail: "talent@stripe.com",
              confidence: "high",
            },
            error: null,
          }),
        },
      } as any;

      const contact = await scoutRecruiterForJob(mockSupabase, mockJob);
      expect(contact.status).toBe("found");
      expect(contact.tier).toBe(3);
      expect(contact.email).toBe("talent@stripe.com");
    });

    it("falls back gracefully to Tier 4 LinkedIn search when no email is found without crashing batch", async () => {
      const mockSupabase = {
        functions: {
          invoke: vi.fn().mockResolvedValue({
            data: {
              recruiterContacts: [],
              contactEmail: null,
            },
            error: null,
          }),
        },
      } as any;

      const contact = await scoutRecruiterForJob(mockSupabase, mockJob);
      expect(contact.status).toBe("no_email");
      expect(contact.tier).toBe(4);
      expect(contact.email).toBe("");
      expect(contact.linkedinUrl).toContain("linkedin.com/search");
    });
  });

  describe("Outreach Pitch Crafting", () => {
    const mockJob: TargetOutreachJob = {
      id: "job-1",
      jobId: "uuid-1",
      title: "Staff Product Designer",
      company: "Linear",
      source: "searched",
    };

    const mockContact: RecruiterContactInfo = {
      fullName: "Karri Saarinen",
      title: "Head of Design",
      email: "karri@linear.app",
      source: "company",
      confidence: "high",
      tier: 2,
      tierLabel: "Design Lead",
      status: "found",
    };

    it("invokes generate-outreach and extracts clean subject and preview hook", async () => {
      const mockSupabase = {
        functions: {
          invoke: vi.fn().mockResolvedValue({
            data: {
              subject: "Staff Product Designer - Portfolio & Craft",
              body: "Hi Karri,\n\nI have followed Linear's design precision for years. Given my background building keyboard-first productivity tools, I'd love to share ideas on how I can accelerate your roadmap.\n\nBest,\nAlex",
            },
            error: null,
          }),
        },
      } as any;

      const pitch = await craftOutreachPitch(
        mockSupabase,
        mockJob,
        mockContact,
        "Alex's resume: 8 years building SaaS UI",
        "casual",
      );

      expect(pitch.subject).toBe("Staff Product Designer - Portfolio & Craft");
      expect(pitch.tone).toBe("casual");
      expect(pitch.previewHook).toContain("followed Linear's design precision");
    });

    it("uses local fallback when edge function fails without interrupting flow", async () => {
      const mockSupabase = {
        functions: {
          invoke: vi.fn().mockRejectedValue(new Error("Network timeout")),
        },
      } as any;

      const pitch = await craftOutreachPitch(
        mockSupabase,
        mockJob,
        mockContact,
        "resume",
        "punchy",
      );

      expect(pitch.tone).toBe("punchy");
      expect(pitch.subject).toContain("Staff Product Designer");
      expect(pitch.body).toContain("Karri");
      expect(pitch.previewHook.length).toBeGreaterThan(10);
    });
  });

  describe("Gmail Delivery & Application Sync", () => {
    const mockJob: TargetOutreachJob = {
      id: "job-1",
      jobId: "uuid-1",
      title: "Founding Engineer",
      company: "Retool",
      source: "searched",
    };

    const mockContact: RecruiterContactInfo = {
      fullName: "David Hsu",
      title: "Founder & CEO",
      email: "david@retool.com",
      source: "company",
      confidence: "high",
      tier: 2,
      tierLabel: "Founder",
      status: "found",
    };

    const mockPitch = {
      subject: "Founding Engineer - Retool",
      body: "Hi David, let's talk.",
      tone: "bold" as const,
      previewHook: "Let's talk.",
    };

    it("creates draft via cold-mail and syncs to applications tracker", async () => {
      const upsertMock = vi.fn().mockResolvedValue({ error: null });
      const mockSupabase = {
        functions: {
          invoke: vi.fn().mockResolvedValue({
            data: {
              success: true,
              draftId: "draft-xyz123",
              messageId: "msg-xyz123",
            },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          upsert: upsertMock,
        }),
      } as any;

      const delivery = await deliverOutreachEmail(
        mockSupabase,
        "user-test-id",
        mockJob,
        mockContact,
        mockPitch,
        "draft",
      );

      expect(delivery.status).toBe("drafted");
      expect(delivery.draftId).toBe("draft-xyz123");
      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith("cold-mail", {
        body: {
          action: "create_gmail_draft",
          to: "david@retool.com",
          subject: "Founding Engineer - Retool",
          body: "Hi David, let's talk.",
        },
      });
      expect(upsertMock).toHaveBeenCalled();
    });

    it("skips delivery cleanly when contact email is missing", async () => {
      const contactWithoutEmail: RecruiterContactInfo = {
        ...mockContact,
        email: "",
        status: "no_email",
      };

      const mockSupabase = {
        functions: { invoke: vi.fn() },
      } as any;

      const delivery = await deliverOutreachEmail(
        mockSupabase,
        "user-test-id",
        mockJob,
        contactWithoutEmail,
        mockPitch,
        "draft",
      );

      expect(delivery.status).toBe("skipped");
      expect(delivery.error).toContain("No email address available");
      expect(mockSupabase.functions.invoke).not.toHaveBeenCalled();
    });
  });

  describe("Job Sourcing & Uncontacted Pre-Selection", () => {
    it("excludes already-contacted applications from the top uncontacted list", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "applications") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: "app-1",
                    job_id: "job-already-applied",
                    company: "Google",
                    job_title: "SWE",
                    status: "Applied",
                  },
                ],
              }),
            };
          }
          if (table === "jobs") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: "job-already-applied",
                    title: "Software Engineer",
                    company: "Google",
                    lead_quality_score: 95,
                  },
                  {
                    id: "job-new-match",
                    title: "Frontend Lead",
                    company: "Notion",
                    lead_quality_score: 92,
                  },
                ],
                error: null,
              }),
            };
          }
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ data: [] }) };
        }),
      } as any;

      const jobs = await fetchTopUncontactedJobs(mockSupabase, "user-test", 5);
      expect(jobs).toHaveLength(1);
      expect(jobs[0].company).toBe("Notion");
      expect(jobs[0].id).toBe("job-new-match");
    });
  });
});

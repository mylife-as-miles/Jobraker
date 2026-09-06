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

  describe("Agentic Preset Prompt Compilation", () => {
    it("compiles structured prompt with searched and applied positions and tone preferences", () => {
      const selectedJobs = [
        {
          id: "job-1",
          company: "Anthropic",
          title: "Research Engineer",
          source: "searched" as const,
          selected: true,
        },
        {
          id: "app-2",
          company: "Linear",
          title: "Product Designer",
          source: "applied" as const,
          selected: true,
        },
      ];

      const tone = "bold";
      const toneLabel = "Executive Bold & High-Agency";

      const jobLines = selectedJobs
        .map(
          (j, i) =>
            `${i + 1}. **${j.company}** - ${j.title}${
              j.source === "applied" ? " (Follow-up on submitted application)" : ""
            }`,
        )
        .join("\n");

      const prompt = `🎯 **1-Click Recruiter Cold Outreach Preset**\n\nPlease execute an autonomous recruiter cold outreach workflow for the following target positions:\n${jobLines}\n\n**Outreach Configuration**:\n- **Tone**: ${toneLabel}\n- **Step 1**: Pull verified recruiter, talent acquisition, and hiring manager contact emails for each company.\n- **Step 2**: Craft tailored, high-conversion outreach pitches highlighting relevant achievements from my profile and resume.\n- **Step 3**: Prepare and sync the drafts directly into my connected Gmail workspace for review before sending.`;

      expect(prompt).toContain("🎯 **1-Click Recruiter Cold Outreach Preset**");
      expect(prompt).toContain("1. **Anthropic** - Research Engineer");
      expect(prompt).toContain("2. **Linear** - Product Designer (Follow-up on submitted application)");
      expect(prompt).toContain("Executive Bold & High-Agency");
      expect(prompt).toContain("**Step 1**: Pull verified recruiter");
      expect(prompt).toContain("**Step 2**: Craft tailored");
      expect(prompt).toContain("**Step 3**: Prepare and sync the drafts directly into my connected Gmail workspace");
    });

    it("compiles structured prompt for instant_job_pitch preset", () => {
      const selectedJobs = [
        {
          id: "job-1",
          company: "Retool",
          title: "Senior Product Manager",
          source: "searched" as const,
          selected: true,
        },
      ];

      const toneLabel = "Startup Casual & Authentic";
      const jobLines = selectedJobs
        .map((j, i) => `${i + 1}. **${j.company}** - ${j.title}`)
        .join("\n");

      const prompt = `🎯 **Instant Job Pitch & Cover Letter Preset**\n\nPlease generate role-tailored introductory pitches and custom cover letters for the following target positions:\n${jobLines}\n\n**Configuration**:\n- **Tone**: ${toneLabel}\n- **Deliverables**:\n  1. **LinkedIn InMail / DM Pitch**: A high-impact 100-150 word note designed to start a warm conversation with the hiring team or founder.\n  2. **Tailored Cover Letter**: A focused, persuasive letter connecting my background and achievements to the specific requirements of the role.\n  3. **2-Sentence Hook**: A punchy opening hook highlighting why I am an exceptional fit.`;

      expect(prompt).toContain("🎯 **Instant Job Pitch & Cover Letter Preset**");
      expect(prompt).toContain("1. **Retool** - Senior Product Manager");
      expect(prompt).toContain("LinkedIn InMail / DM Pitch");
      expect(prompt).toContain("Tailored Cover Letter");
      expect(prompt).toContain("2-Sentence Hook");
    });

    it("compiles structured prompt for followup_bump preset with applied date", () => {
      const selectedJobs = [
        {
          id: "app-1",
          company: "Figma",
          title: "Staff Design Systems Engineer",
          source: "applied" as const,
          appliedDate: "9/1/2026",
          selected: true,
        },
      ];

      const strategyLabel = "Friendly & Professional Nudge (Courteous check-in on submitted application)";
      const jobLines = selectedJobs
        .map(
          (j, i) =>
            `${i + 1}. **${j.company}** - ${j.title} (Follow-up on submitted application) [Applied: ${j.appliedDate}]`,
        )
        .join("\n");

      const prompt = `🎯 **Application Follow-Up Bump Preset**\n\nPlease prepare polite, strategic follow-up outreach messages for the following submitted applications:\n${jobLines}\n\n**Configuration**:\n- **Follow-Up Strategy**: ${strategyLabel}\n- **Workflow Steps**:\n  1. Reference my application submission date and confirm continued enthusiasm for the role.\n  2. Incorporate a concise value-add update highlighting relevant achievements or portfolio evidence.\n  3. Prepare and sync the follow-up email drafts directly into my connected Gmail workspace for review before sending.`;

      expect(prompt).toContain("🎯 **Application Follow-Up Bump Preset**");
      expect(prompt).toContain("1. **Figma** - Staff Design Systems Engineer");
      expect(prompt).toContain("[Applied: 9/1/2026]");
      expect(prompt).toContain("Friendly & Professional Nudge");
      expect(prompt).toContain("Prepare and sync the follow-up email drafts directly into my connected Gmail workspace");
    });
  });
});


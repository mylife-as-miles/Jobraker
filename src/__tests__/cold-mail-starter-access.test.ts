import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  canUseComposioAction,
  canUseStandaloneEmailIntegrations,
} from "../../backend/supabase/functions/_shared/integration-access";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Starter Cold Mail authorization contracts", () => {
  it("ships an atomic rolling-24-hour quota owned by the backend", () => {
    const migrations = read(
      "backend/supabase/migrations/20260908063400_starter_cold_mail_runs.sql",
    );
    expect(migrations).toContain("reserve_starter_cold_mail_run");
    expect(migrations).toContain("interval '24 hours'");
    expect(migrations).toContain("v_limit constant integer := 20");
    expect(migrations).toContain("pg_advisory_xact_lock");
    expect(migrations).toContain("revoke all on function");
    expect(migrations).toContain("service_role");
  });

  it("keeps Starter specialist access purpose-bound", () => {
    const scout = read("backend/supabase/functions/scout-company/index.ts");
    const outreach = read("backend/supabase/functions/generate-outreach/index.ts");

    expect(scout).toContain("verifyColdMailSpecialistCapabilityToken");
    expect(outreach).toContain("verifyColdMailSpecialistCapabilityToken");
    expect(scout).toContain("request.jobId) !== context.coldMailCapability.jobId");
    expect(outreach).toContain("jobId !== coldMailCapability.jobId");
    expect(scout).toContain("buildRecruiterSearchQueries");
    expect(scout).toContain("searchPlan.linkedInRecruiters");
    expect(scout).toContain("searchPlan.linkedInManagers");
    expect(scout).not.toMatch(/Starter:\s*"Basics"/);
  });

  it("does not expose Gmail tools to Starter free-form AI Chat", () => {
    const aiChat = read("backend/supabase/functions/ai-chat/index.ts");
    expect(aiChat).toContain("canUseStandaloneEmailIntegrations");
    expect(aiChat).not.toContain(
      'const canUseEmailIntegrations = typeof user.email === "string"',
    );
  });

  it("enforces the standalone email tier matrix", () => {
    expect(canUseStandaloneEmailIntegrations("Starter", "user@example.com")).toBe(false);
    expect(canUseStandaloneEmailIntegrations("Basics", "user@example.com")).toBe(true);
    expect(canUseStandaloneEmailIntegrations("Pro", "user@example.com")).toBe(true);
    expect(canUseStandaloneEmailIntegrations("Ultimate", "user@example.com")).toBe(true);
    expect(canUseStandaloneEmailIntegrations("Basics", "")).toBe(false);
  });

  it("allows Starter Gmail connection only for the recruiter preset", () => {
    const composio = read("backend/supabase/functions/composio-auth/index.ts");
    expect(composio).toContain("canUseComposioAction");
    expect(canUseComposioAction({
      tier: "Starter",
      action: "initiate",
      integrationSlug: "gmail",
      purpose: "recruiter_cold_outreach",
    })).toBe(true);
    expect(canUseComposioAction({
      tier: "Starter",
      action: "execute",
      integrationSlug: "gmail",
      purpose: "recruiter_cold_outreach",
    })).toBe(false);
    expect(canUseComposioAction({
      tier: "Starter",
      action: "initiate",
      integrationSlug: "github",
      purpose: "recruiter_cold_outreach",
    })).toBe(false);
    expect(canUseComposioAction({
      tier: "Basics",
      action: "execute",
      integrationSlug: "gmail",
    })).toBe(true);
  });

  it("makes cold-mail the Starter quota and draft authority", () => {
    const coldMail = read("backend/supabase/functions/cold-mail/index.ts");
    expect(coldMail).toContain('req,\n      "Starter",\n      "Cold Mail"');
    expect(coldMail).toContain('"reserve_starter_cold_mail_run"');
    expect(coldMail).toContain('subscriptionTier !== "Starter"');
    expect(coldMail).toContain('"cold_mail_send_not_available"');
    expect(coldMail.match(/cold_mail_send_not_available/g)).toHaveLength(2);
    expect(coldMail).toContain("jobId: asString(job.id)");
    expect(coldMail).toContain("reservation.idempotentReplay === true");
    expect(coldMail).toContain("cold_mail_preparation: preparation");
    expect(coldMail).toMatch(
      /discoverColdMailTargets\(\s*req,\s*serviceClient,\s*user\.id,\s*request,/,
    );
  });

  it("keeps the recruiter preset on one saved searched job", () => {
    const modal = read("src/components/chat/RecruiterOutreachPresetModal.tsx");
    const recipes = read("src/lib/presets/actionRecipes.ts");
    const chatPage = read("src/screens/Dashboard/pages/ChatPage.tsx");

    expect(recipes).toMatch(
      /recruiter_cold_outreach:[\s\S]*?defaultJobLimit:\s*1,[\s\S]*?maxJobLimit:\s*1/,
    );
    expect(modal).toContain('selectedJobs[0].source !== "searched"');
    expect(modal).toContain('purpose: "recruiter_cold_outreach"');
    expect(chatPage).toContain('skillId: "cold_mail"');
  });
});

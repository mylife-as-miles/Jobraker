import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { canFallbackToSkyvern, classifyRtrvrFailure } from "../fallback.js";
import { mapBrowserExecutionPreference, selectOnlineDevice } from "../modes.js";
import { buildRtrvrApplicationRequest } from "../requestBuilder.js";
import { parseRtrvrApplicationResult } from "../schemas.js";
import { redactSensitiveValue } from "../logRedaction.js";
import { validateAutomationUrl } from "../urlSecurity.js";
import {
  claimAutomationWorkerNonce,
  claimNextRtrvrApplications,
  renewRtrvrApplicationLease,
  updateApplicationWithAutomationResult,
} from "../database.js";
import {
  assertRtrvrSdkContract,
  createJobrakerRtrvrClient,
  isRtrvrEnabled,
  parseEnvBoolean,
} from "../rtrvrClient.js";
import {
  createWorkerRequestSignature,
  sha256Hex,
  verifyWorkerHmacRequest,
  type WorkerAuthHeaders,
} from "../workerAuth.js";
import type { StartApplicationInput, StartApplicationResult } from "../types.js";

const baseInput: StartApplicationInput = {
  applicationId: "app-1",
  agentRunId: "run-1",
  userId: "user-1",
  applicationUrl: "https://jobs.example.com/apply/123",
  idempotencyKey: "auto-apply:user-1:abc",
  attemptNumber: 1,
  job: {
    title: "Software Engineer",
    company: "Example",
  },
  candidate: {
    fullName: "Ada Lovelace",
    email: "ada@example.com",
    skills: ["TypeScript"],
  },
  resume: {
    signedUrl: "https://storage.example.com/resume.pdf?token=short",
    fileName: "resume.pdf",
    mimeType: "application/pdf",
    expiresAt: "2026-07-05T12:00:00.000Z",
  },
  coverLetter: "Hello",
  autoSubmit: false,
  browserPreference: "automatic",
  preferExtension: true,
};

function signedWorkerHeaders(
  body: string,
  opts: {
    secret?: string;
    timestamp?: string;
    nonce?: string;
  } = {},
): WorkerAuthHeaders {
  const secret = opts.secret || "worker-secret";
  const timestamp = opts.timestamp || "1772880000";
  const nonce = opts.nonce || "nonce-1";
  const bodyHash = sha256Hex(body);
  return {
    "x-jobraker-worker-timestamp": timestamp,
    "x-jobraker-worker-nonce": nonce,
    "x-jobraker-worker-body-sha256": bodyHash,
    "x-jobraker-worker-signature": createWorkerRequestSignature({
      secret,
      timestamp,
      nonce,
      bodyHash,
    }),
  };
}

describe("rtrvr automation integration", () => {
  it("maps browser execution preferences", () => {
    expect(mapBrowserExecutionPreference("automatic", { preferExtension: true })).toMatchObject({
      target: "auto",
      preferExtension: true,
      requireLocalSession: false,
    });
    expect(mapBrowserExecutionPreference("my_chrome", { selectedDeviceId: "dev-1" })).toMatchObject({
      target: "extension",
      requireLocalSession: true,
      deviceId: "dev-1",
    });
    expect(mapBrowserExecutionPreference("jobraker_cloud")).toMatchObject({
      target: "cloud",
      preferExtension: false,
    });
  });

  it("selects only online extension devices", () => {
    expect(selectOnlineDevice({ online: false, deviceCount: 0, devices: [] }, null)).toBeNull();
    expect(
      selectOnlineDevice(
        { online: true, deviceCount: 1, devices: [{ deviceId: "dev-1" }] },
        "dev-1",
      )?.deviceId,
    ).toBe("dev-1");
    expect(
      selectOnlineDevice(
        { online: true, deviceCount: 1, devices: [{ deviceId: "dev-1" }] },
        "missing",
      ),
    ).toBeNull();
  });

  it("builds a safe structured rtrvr request", () => {
    const request = buildRtrvrApplicationRequest(
      baseInput,
      mapBrowserExecutionPreference("automatic", { preferExtension: true }),
    );
    expect(request.target).toBe("auto");
    expect(request.trajectoryId).toBe("run-1");
    expect(request.files?.[0]?.mimeType).toBe("application/pdf");
    expect(JSON.stringify(request.dataInputs)).toContain("Software Engineer");
    expect(request.input).toContain("Never fabricate qualifications");
    expect(request.input).toContain("auto-submit is disabled");
  });

  it("passes configured rtrvr recording context to the SDK request", () => {
    const request = buildRtrvrApplicationRequest(
      {
        ...baseInput,
        metadata: { rtrvrRecordingContext: "greenhouse-recording-1" },
      },
      mapBrowserExecutionPreference("automatic", { preferExtension: true }),
    );
    expect(request.recordingContext).toBe("greenhouse-recording-1");
  });

  it("does not treat legacy rtrvr workflow IDs as executable recordings", () => {
    const request = buildRtrvrApplicationRequest(
      {
        ...baseInput,
        metadata: { ["rtrvr" + "WorkflowId"]: "greenhouse-workflow-1" },
      },
      mapBrowserExecutionPreference("automatic", { preferExtension: true }),
    );
    expect(request.recordingContext).toBeUndefined();
  });

  it("validates provider structured output", () => {
    const parsed = parseRtrvrApplicationResult({
      status: "completed",
      submitted: true,
      submissionEvidence: { confirmationNumber: "ABC123" },
      fieldsFilled: [{ label: "Name", valueType: "text", status: "filled" }],
      unansweredQuestions: [],
      blockers: [],
      summary: "Application submitted.",
    });
    expect(parsed.submissionEvidence?.confirmationNumber).toBe("ABC123");
    expect(() => parseRtrvrApplicationResult({ status: "completed" })).toThrow();
  });

  it("blocks unsafe automation URLs", () => {
    expect(() => validateAutomationUrl("file:///etc/passwd")).toThrow();
    expect(() => validateAutomationUrl("http://127.0.0.1:54321")).toThrow();
    expect(() => validateAutomationUrl("http://169.254.169.254/latest/meta-data")).toThrow();
    expect(validateAutomationUrl("https://jobs.example.com/apply").hostname).toBe("jobs.example.com");
  });

  it("prevents Skyvern fallback when rtrvr may have submitted", () => {
    const decision = canFallbackToSkyvern({
      rtrvrResult: {
        status: "completed",
        submitted: true,
        submissionEvidence: { confirmationText: "Thanks for applying" },
        fieldsFilled: [],
        unansweredQuestions: [],
        blockers: [],
        summary: "Submitted.",
      },
      requestedBrowserPreference: "automatic",
      attemptNumber: 1,
    });
    expect(decision.allowed).toBe(false);
  });

  it("allows fallback for retryable provider errors", () => {
    const failure = classifyRtrvrFailure(new Error("Request timed out"));
    const decision = canFallbackToSkyvern({
      rtrvrFailure: failure,
      requestedBrowserPreference: "automatic",
      attemptNumber: 1,
    });
    expect(decision.allowed).toBe(true);
  });

  it("does not fallback for local-only offline devices", () => {
    const failure = classifyRtrvrFailure(new Error("No online extension devices found"));
    const decision = canFallbackToSkyvern({
      rtrvrFailure: failure,
      requestedBrowserPreference: "my_chrome",
      attemptNumber: 1,
    });
    expect(decision.allowed).toBe(false);
  });

  it("redacts sensitive logs", () => {
    expect(
      redactSensitiveValue({
        authorization: "Bearer rtrvr_secret",
        nested: { token: "mcp_at_secret" },
      }),
    ).toEqual({
      authorization: "[redacted]",
      nested: { token: "[redacted]" },
    });
    expect(redactSensitiveValue({ signature: "sha256=secret" })).toEqual({
      signature: "[redacted]",
    });
  });

  it("guards the required rtrvr SDK contract", () => {
    const sdk = {
      run: () => undefined,
      scrape: { route: () => undefined },
      devices: { list: () => undefined },
      profile: { capabilities: () => undefined },
      tools: {
        extract: () => undefined,
        act: () => undefined,
      },
    };
    expect(() => assertRtrvrSdkContract(sdk)).not.toThrow();
    expect(() =>
      assertRtrvrSdkContract({
        ...sdk,
        scrape: {},
      }),
    ).toThrow(/client\.scrape\.route/);
  });

  it("honors the rtrvr feature flag", () => {
    expect(isRtrvrEnabled({ RTRVR_ENABLED: "true" })).toBe(true);
    expect(isRtrvrEnabled({ RTRVR_ENABLED: "false" })).toBe(false);
    expect(parseEnvBoolean("false", true)).toBe(false);
    expect(parseEnvBoolean("true", false)).toBe(true);
  });

  it("fails closed when rtrvr is disabled or missing required secrets", () => {
    expect(() =>
      createJobrakerRtrvrClient({ RTRVR_ENABLED: "false", RTRVR_API_KEY: "test-key" }),
    ).toThrow(/disabled/);
    expect(() =>
      createJobrakerRtrvrClient({ RTRVR_ENABLED: "true" }),
    ).toThrow(/RTRVR_API_KEY/);
  });

  it("signs worker requests with the body hash", () => {
    const body = JSON.stringify({ tool: "rtrvr_list_devices" });
    const bodyHash = sha256Hex(body);
    const signature = createWorkerRequestSignature({
      secret: "worker-secret",
      timestamp: "1772880000",
      nonce: "nonce-1",
      bodyHash,
    });
    const tamperedSignature = createWorkerRequestSignature({
      secret: "worker-secret",
      timestamp: "1772880000",
      nonce: "nonce-1",
      bodyHash: sha256Hex(`${body} `),
    });
    expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/);
    expect(signature).not.toBe(tamperedSignature);
  });

  it("rejects a worker HMAC request when the raw body changes", async () => {
    const body = JSON.stringify({ tool: "rtrvr_list_devices" });
    await expect(
      verifyWorkerHmacRequest({
        headers: signedWorkerHeaders(body),
        rawBody: `${body} `,
        secret: "worker-secret",
        nowMs: 1772880000 * 1000,
        claimNonce: async () => true,
      }),
    ).resolves.toEqual({ ok: false, reason: "body_hash" });
  });

  it("rejects expired worker HMAC timestamps", async () => {
    const body = JSON.stringify({ tool: "rtrvr_list_devices" });
    await expect(
      verifyWorkerHmacRequest({
        headers: signedWorkerHeaders(body, { timestamp: "1772879000" }),
        rawBody: body,
        secret: "worker-secret",
        nowMs: 1772880000 * 1000,
        maxAgeSeconds: 300,
        claimNonce: async () => true,
      }),
    ).resolves.toEqual({ ok: false, reason: "expired" });
  });

  it("rejects duplicate worker HMAC nonces", async () => {
    const body = JSON.stringify({ tool: "rtrvr_list_devices" });
    const usedNonces = new Set<string>();
    const verify = () =>
      verifyWorkerHmacRequest({
        headers: signedWorkerHeaders(body, { nonce: "nonce-duplicate" }),
        rawBody: body,
        secret: "worker-secret",
        nowMs: 1772880000 * 1000,
        claimNonce: async (nonce) => {
          if (usedNonces.has(nonce)) return false;
          usedNonces.add(nonce);
          return true;
        },
      });

    await expect(verify()).resolves.toEqual({ ok: true });
    await expect(verify()).resolves.toEqual({ ok: false, reason: "replay" });
  });

  it("rejects concurrent worker HMAC replay attempts atomically", async () => {
    const body = JSON.stringify({ tool: "rtrvr_list_devices" });
    let claimed = false;
    const results = await Promise.all([
      verifyWorkerHmacRequest({
        headers: signedWorkerHeaders(body, { nonce: "nonce-race" }),
        rawBody: body,
        secret: "worker-secret",
        nowMs: 1772880000 * 1000,
        claimNonce: async () => {
          if (claimed) return false;
          claimed = true;
          return true;
        },
      }),
      verifyWorkerHmacRequest({
        headers: signedWorkerHeaders(body, { nonce: "nonce-race" }),
        rawBody: body,
        secret: "worker-secret",
        nowMs: 1772880000 * 1000,
        claimNonce: async () => {
          if (claimed) return false;
          claimed = true;
          return true;
        },
      }),
    ]);

    expect(results).toContainEqual({ ok: true });
    expect(results).toContainEqual({ ok: false, reason: "replay" });
  });

  it("claims worker HMAC nonces through the durable database RPC", async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const supabase = {
      rpc: async (name: string, args: Record<string, unknown>) => {
        calls.push({ name, args });
        return { data: true, error: null };
      },
    };
    const expiresAt = new Date("2026-07-05T12:05:00.000Z");

    await expect(
      claimAutomationWorkerNonce(supabase as never, "nonce-1", expiresAt),
    ).resolves.toBe(true);
    expect(calls[0]).toEqual({
      name: "claim_automation_worker_nonce",
      args: {
        p_nonce: "nonce-1",
        p_expires_at: "2026-07-05T12:05:00.000Z",
      },
    });
  });

  it("claims rtrvr jobs with worker id and lease parameters", async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const supabase = {
      rpc: async (name: string, args: Record<string, unknown>) => {
        calls.push({ name, args });
        return {
          data: [{ application_id: "app-1", attempt_number: 3, lease_token: "token-1" }],
          error: null,
        };
      },
    };

    await expect(
      claimNextRtrvrApplications(supabase as never, 50, "worker-a", 7200),
    ).resolves.toEqual([{ applicationId: "app-1", attemptNumber: 3, leaseToken: "token-1" }]);
    expect(calls[0]).toEqual({
      name: "claim_next_rtrvr_auto_apply_jobs",
      args: {
        p_limit: 25,
        p_worker_id: "worker-a",
        p_lease_seconds: 3600,
      },
    });
  });

  it("renews only the current worker lease through the RPC", async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const supabase = {
      rpc: async (name: string, args: Record<string, unknown>) => {
        calls.push({ name, args });
        return { data: true, error: null };
      },
    };

    await expect(
      renewRtrvrApplicationLease(supabase as never, "app-1", "worker-a", "token-1", 900),
    ).resolves.toBe(true);
    expect(calls[0]).toEqual({
      name: "renew_rtrvr_auto_apply_job_lease",
      args: {
        p_application_id: "app-1",
        p_worker_id: "worker-a",
        p_lease_token: "token-1",
        p_lease_seconds: 900,
      },
    });
  });

  it("prevents a paused worker from overwriting after another worker reclaims the lease", async () => {
    const filters: Array<[string, unknown]> = [];
    const result: StartApplicationResult = {
      provider: "rtrvr",
      status: "failed",
      failureCode: "worker_exception",
      failureMessage: "worker A resumed after worker B reclaimed the job",
    };
    const supabase = {
      from: (table: string) => ({
        select: (_columns: string) => {
          const query = {
            eq: (_column: string, _value: unknown) => query,
            maybeSingle: async () => ({
              data: { provider_run_output: { reclaimedBy: "worker-b" } },
              error: null,
            }),
          };
          return query;
        },
        update: (_patch: Record<string, unknown>) => {
          expect(table).toBe("applications");
          const query = {
            eq: (column: string, value: unknown) => {
              filters.push([column, value]);
              return query;
            },
            select: (_columns: string) => query,
            maybeSingle: async () => ({ data: null, error: null }),
          };
          return query;
        },
      }),
    };

    await expect(
      updateApplicationWithAutomationResult(
        supabase as never,
        "app-1",
        result,
        { workerId: "worker-a", leaseToken: "token-a" },
      ),
    ).rejects.toThrow(/lease was lost/);
    expect(filters).toContainEqual(["automation_claimed_by", "worker-a"]);
    expect(filters).toContainEqual(["automation_lease_token", "token-a"]);
  });

  it("keeps queue ownership atomic and recoverable in the migration", () => {
    const migration = readFileSync(
      resolve("backend/supabase/migrations/20260705101554_rtrvr_automation_provider.sql"),
      "utf8",
    ).toLowerCase();
    expect(migration).toContain("for update of a skip locked");
    expect(migration).toContain("automation_worker_nonces");
    expect(migration).toContain("claim_automation_worker_nonce");
    expect(migration).toContain("on conflict (nonce) do nothing");
    expect(migration).toContain("automation_lease_token");
    expect(migration).toContain("lease_token uuid");
    expect(migration).toContain("automation_lease_expires_at");
    expect(migration).toContain("renew_rtrvr_auto_apply_job_lease");
    expect(migration).toContain("and automation_lease_token = p_lease_token");
    expect(migration).toContain("resume_waiting_rtrvr_auto_apply_job");
    expect(migration).toContain("automation_idempotency_key is not null");
    expect(migration).toContain("automation_lease_expires_at is null or automation_lease_expires_at < now()");
    expect(migration).toContain("provider_status, automation_lease_expires_at");
  });
});

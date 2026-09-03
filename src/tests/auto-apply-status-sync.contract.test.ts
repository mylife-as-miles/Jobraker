import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

/** Strip comments so prose that mentions a construct cannot satisfy a
 * structural assertion about the code. */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const queue = stripComments(
  read("backend/supabase/functions/process-auto-apply-queue/index.ts"),
);
const webhook = stripComments(
  read("backend/supabase/functions/skyvern-webhook/index.ts"),
);

/**
 * Regression cover for "single auto-apply stuck in Pending after success".
 *
 * These are contract tests against the real edge-function source rather than
 * re-implemented copies. That is deliberate: the bug that caused this ticket
 * was masked by a re-implemented helper in a test file that handled a provider
 * status the production function did not.
 */
describe("auto-apply status sync", () => {
  describe("run lifecycle", () => {
    it("registers waitUntil for every batch size, not just large ones", () => {
      // The failure mode: waitUntil lived in the `else` of a batch-size branch,
      // so batches of 1-2 returned after an 8s race and the isolate was torn
      // down mid-flight, killing the write-back to "Applied".
      const waitUntilIdx = queue.indexOf("EdgeRuntime?.waitUntil");
      const raceIdx = queue.indexOf("Promise.race([");
      expect(waitUntilIdx).toBeGreaterThan(-1);
      expect(raceIdx).toBeGreaterThan(-1);

      // waitUntil must be registered before (and independently of) the race.
      expect(waitUntilIdx).toBeLessThan(raceIdx);

      // and must not be reachable only via an else-branch of the size check.
      expect(queue).not.toMatch(
        /applicationIds\.length <= 2[\s\S]{0,400}?\}\s*else if[\s\S]{0,80}?waitUntil/,
      );
    });

    it("keeps the small-batch fast path as a plain optimization", () => {
      expect(queue).toMatch(/applicationIds\.length <= 2/);
      expect(queue).toMatch(/Promise\.race\(/);
    });
  });

  describe("provider correlation", () => {
    it("persists a provider run id so webhook and reconciler can correlate", () => {
      // applications.run_id was left null forever, which silently disabled both
      // async fallbacks.
      expect(queue).toMatch(/providerRunId/);
      expect(queue).toMatch(/run_id: providerRunId/);
      expect(queue).toMatch(/runIdPatch/);
    });

    it("forwards the callback URL that apply-to-jobs prepared", () => {
      expect(queue).toMatch(/rtrvrWebhookUrl/);
      expect(queue).toMatch(/webhookUrl: rtrvrWebhookUrl/);
    });

    it("still correlates the webhook on run_id", () => {
      expect(webhook).toMatch(/\.eq\("run_id", runId\)/);
    });
  });

  describe("terminal status mapping", () => {
    // process-auto-apply-queue writes provider_status "succeeded" itself, so the
    // webhook must treat it as terminal success. It previously fell through to
    // the default and reported Pending.
    it("maps succeeded to Applied/submitted in the real webhook", () => {
      const displayMap = webhook.slice(
        webhook.indexOf("const mapProviderStatusToDisplay"),
        webhook.indexOf("const mapProviderStatusToJobState"),
      );
      expect(displayMap).toMatch(/case "succeeded":/);
      expect(displayMap).toMatch(/case "completed":/);
      expect(displayMap).toMatch(/status: "Applied"/);
    });

    it("maps succeeded to submitted job state in the real webhook", () => {
      const stateMapStart = webhook.indexOf("const mapProviderStatusToJobState");
      const stateMap = webhook.slice(stateMapStart, stateMapStart + 400);
      expect(stateMap).toMatch(/case "succeeded":/);
      expect(stateMap).toMatch(/return "submitted"/);
    });

    it("writes the same terminal status the webhook understands", () => {
      // Guards the two halves against drifting apart again.
      expect(queue).toMatch(/provider_status: isDraftOnly \? "prepared" : "succeeded"/);
    });
  });

  // Contract per RTRVR's published API reference and webhooks guide:
  // callbacks register via a `webhooks` array, are signed with
  // X-Rtrvr-Signature, and POST { event, requestId, success, error, ... }
  // rather than Skyvern's { id/run_id, status } shape.
  describe("RTRVR callback contract", () => {
    it("registers the callback with the documented webhooks array", () => {
      expect(queue).toMatch(/webhooks:\s*\[/);
      expect(queue).toMatch(/rtrvr\.execution\.succeeded/);
      expect(queue).toMatch(/rtrvr\.execution\.failed/);
      expect(queue).toMatch(/rtrvrWebhookSecret/);
    });

    it("accepts RTRVR's signature and timestamp headers", () => {
      expect(webhook).toMatch(/x-rtrvr-signature/);
      expect(webhook).toMatch(/x-rtrvr-timestamp/);
    });

    it("resolves the run id from requestId as well as run_id", () => {
      expect(webhook).toMatch(/payload\.requestId/);
      expect(queue).toMatch(/\(result as any\)\?\.requestId/);
    });

    it("derives a provider status from event / success when status is absent", () => {
      expect(webhook).toMatch(/normalizeProviderStatus/);
      expect(webhook).toMatch(/raw\.success/);
      expect(webhook).toMatch(/succeeded\|completed\|success/);
    });

    it("reads a failure reason out of RTRVR's error object", () => {
      expect(webhook).toMatch(/payload\.error as Record/);
    });
  });
});

import { createJobrakerRtrvrClient, isRtrvrEnabled } from "./rtrvrClient.js";
import { fileURLToPath } from "node:url";
import { hostname } from "node:os";
import {
  claimNextRtrvrApplications,
  createServiceSupabaseClientFromEnv,
  finishAutomationAttempt,
  insertAutomationAttempt,
  loadStartApplicationInput,
  renewRtrvrApplicationLease,
  type ServiceSupabaseClient,
  updateApplicationWithAutomationResult,
} from "./database.js";
import { RtrvrApplicationProvider } from "./providers/RtrvrApplicationProvider.js";
import { ApplicationAutomationRouter } from "./providers/ApplicationAutomationRouter.js";
import { redactSensitiveValue } from "./logRedaction.js";

function numericEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function workerIdFromEnv(): string {
  const configured = process.env.AUTOMATION_WORKER_ID?.trim();
  if (configured) return configured;
  return `${hostname()}:${process.pid}`;
}

function startLeaseRenewal(
  supabase: ServiceSupabaseClient,
  applicationId: string,
  workerId: string,
  leaseToken: string,
  leaseSeconds: number,
  onLostLease: () => void,
): () => void {
  const intervalMs = Math.max(10_000, Math.min(60_000, Math.floor((leaseSeconds * 1000) / 3)));
  let stopped = false;
  const timer = setInterval(() => {
    if (stopped) return;
    void renewRtrvrApplicationLease(
      supabase,
      applicationId,
      workerId,
      leaseToken,
      leaseSeconds,
    ).then((renewed) => {
      if (renewed) return;
      onLostLease();
      stopped = true;
      clearInterval(timer);
      console.error("automation_worker.lease_lost", redactSensitiveValue({
        applicationId,
        workerId,
      }));
    }).catch((error) => {
      console.error("automation_worker.lease_renewal_failed", redactSensitiveValue({
        applicationId,
        workerId,
        error: error instanceof Error ? error.message : String(error),
      }));
    });
  }, intervalMs);
  timer.unref?.();
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}

export async function processNextBatch(): Promise<number> {
  if (!isRtrvrEnabled()) {
    console.log("automation_worker.rtrvr_disabled");
    return 0;
  }

  const supabase = createServiceSupabaseClientFromEnv();
  const rtrvrClient = createJobrakerRtrvrClient();
  const rtrvr = new RtrvrApplicationProvider(rtrvrClient);
  const router = new ApplicationAutomationRouter(rtrvr);
  const workerId = workerIdFromEnv();
  const leaseSeconds = numericEnv("AUTOMATION_WORKER_LEASE_SECONDS", 900);

  const claimedApplications = await claimNextRtrvrApplications(
    supabase,
    numericEnv("AUTOMATION_WORKER_BATCH_SIZE", 3),
    workerId,
    leaseSeconds,
  );
  let processed = 0;

  for (const claim of claimedApplications) {
    const { applicationId, attemptNumber, leaseToken } = claim;
    const fence = { workerId, leaseToken };
    const loadedInput = await loadStartApplicationInput(supabase, applicationId);
    const input = loadedInput
      ? { ...loadedInput, attemptNumber }
      : null;
    if (!input) {
      const { data, error } = await supabase
        .from("applications")
        .update({
          canonical_stage: "failed",
          status: "Failed",
          provider_status: "failed",
          failure_reason: "Missing rtrvr queue parameters.",
          automation_claimed_by: null,
          automation_lease_token: null,
          automation_lease_expires_at: null,
          automation_heartbeat_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", applicationId)
        .eq("automation_claimed_by", workerId)
        .eq("automation_lease_token", leaseToken)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        console.error("automation_worker.lease_lost", redactSensitiveValue({
          applicationId,
          workerId,
        }));
      }
      continue;
    }

    let attemptId: string | null = null;
    let stopLeaseRenewal: (() => void) | null = null;
    let leaseLost = false;
    try {
      attemptId = await insertAutomationAttempt(
        supabase,
        input,
        "rtrvr",
        "running",
        workerId,
        leaseSeconds,
        leaseToken,
      );
      stopLeaseRenewal = startLeaseRenewal(
        supabase,
        applicationId,
        workerId,
        leaseToken,
        leaseSeconds,
        () => {
          leaseLost = true;
        },
      );
      const result = await router.startApplication(input);
      if (leaseLost) {
        throw new Error("Lost rtrvr application lease before terminal update.");
      }

      await finishAutomationAttempt(
        supabase,
        attemptId,
        result,
        fence,
      );
      await updateApplicationWithAutomationResult(supabase, applicationId, result, fence);
      processed += 1;
      console.log("automation_worker.application_processed", redactSensitiveValue({
        applicationId,
        provider: result.provider,
        status: result.status,
        selectedMode: result.selectedMode,
        fallbackApplied: result.fallbackApplied,
      }));
    } catch (error) {
      const failure = {
        provider: "rtrvr" as const,
        status: "failed" as const,
        failureCode: "worker_exception",
        failureMessage: error instanceof Error ? error.message : String(error),
      };
      try {
        await finishAutomationAttempt(supabase, attemptId, failure, fence);
        await updateApplicationWithAutomationResult(supabase, applicationId, failure, fence);
      } catch (writeError) {
        console.error("automation_worker.terminal_write_skipped", redactSensitiveValue({
          applicationId,
          workerId,
          error: writeError instanceof Error ? writeError.message : String(writeError),
        }));
      }
      console.error("automation_worker.application_failed", redactSensitiveValue({
        applicationId,
        error: failure.failureMessage,
      }));
    } finally {
      stopLeaseRenewal?.();
    }
  }

  return processed;
}

export async function runWorkerLoop(): Promise<void> {
  const once = process.argv.includes("--once");
  const intervalMs = numericEnv("AUTOMATION_WORKER_POLL_MS", 5_000);

  do {
    const processed = await processNextBatch();
    if (once) break;
    await sleep(processed > 0 ? 250 : intervalMs);
  } while (true);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runWorkerLoop().catch((error) => {
    console.error("automation_worker.fatal", redactSensitiveValue(error));
    process.exit(1);
  });
}

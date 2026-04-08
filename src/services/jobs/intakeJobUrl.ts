import { invokeProtectedFunction } from "../supabase/invokeProtectedFunction";
import type { EvaluateJobFitResponse } from "../ai/evaluateJobFit";

export interface IntakeJobUrlResponse {
  success: boolean;
  verification_status: "verified" | "stale" | "failed";
  job: Record<string, unknown>;
  evaluation: EvaluateJobFitResponse;
}

export async function intakeJobUrl(input: {
  url: string;
  profileSnapshot?: string;
  resumeText?: string;
}): Promise<IntakeJobUrlResponse> {
  const payload = await invokeProtectedFunction<IntakeJobUrlResponse>(
    "intake-job-url",
    {
      body: input,
    },
  );

  if (!payload?.job || !payload?.evaluation) {
    throw new Error("No job evaluation payload was returned.");
  }

  return payload;
}

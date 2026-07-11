import { canFallbackToSkyvern, classifyRtrvrFailure } from "../fallback.js";
import type {
  ApplicationAutomationProvider,
  NormalizedApplicationResult,
  StartApplicationInput,
  StartApplicationResult,
} from "../types.js";

export class ApplicationAutomationRouter {
  constructor(
    private readonly rtrvr: ApplicationAutomationProvider,
    private readonly skyvern?: ApplicationAutomationProvider,
  ) {}

  async startApplication(input: StartApplicationInput): Promise<StartApplicationResult> {
    const rtrvrResult = await this.rtrvr.startApplication(input);

    if (
      rtrvrResult.status === "completed" ||
      rtrvrResult.status === "needs_review" ||
      rtrvrResult.status === "waiting_for_user" ||
      !this.skyvern
    ) {
      return rtrvrResult;
    }

    const fallbackDecision = canFallbackToSkyvern({
      rtrvrResult: rtrvrResult.result as NormalizedApplicationResult | null | undefined,
      rtrvrFailure: rtrvrResult.failureMessage
        ? classifyRtrvrFailure(new Error(rtrvrResult.failureMessage))
        : null,
      requestedBrowserPreference: input.browserPreference,
      existingApplicationTerminal: false,
      existingSubmissionEvidence: false,
      attemptNumber: input.attemptNumber,
    });

    if (!fallbackDecision.allowed) {
      return rtrvrResult;
    }

    const skyvernResult = await this.skyvern.startApplication(input);
    return {
      ...skyvernResult,
      fallbackApplied: true,
      fallbackReason: fallbackDecision.reason ?? "rtrvr_primary_failed",
      raw: {
        rtrvr: rtrvrResult.raw,
        skyvern: skyvernResult.raw,
      },
    };
  }
}

import type { AtsAdapter, AtsName } from "./types.ts";
import { greenhouseAdapter } from "./greenhouse.ts";
import { recruiteeAdapter } from "./recruitee.ts";
import { ashbyAdapter } from "./ashby.ts";
import { leverAdapter } from "./lever.ts";

// Adapters implemented so far. The remaining decided platforms
// (SmartRecruiters, Workable, Teamtailor, Breezy, Rippling, BambooHR) are
// added in later steps of Phase 1.
export const ATS_ADAPTERS: Partial<Record<AtsName, AtsAdapter>> = {
  greenhouse: greenhouseAdapter,
  recruitee: recruiteeAdapter,
  ashby: ashbyAdapter,
  lever: leverAdapter,
};

export * from "./types.ts";
export { classifyQuestion } from "./questions.ts";
export { classifyLocation } from "./location.ts";

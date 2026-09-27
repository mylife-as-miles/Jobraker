import type { AtsAdapter, AtsName } from "./types.ts";
import { greenhouseAdapter } from "./greenhouse.ts";
import { recruiteeAdapter } from "./recruitee.ts";

// Adapters implemented so far. The other decided platforms (Ashby, Lever,
// SmartRecruiters, Workable, Teamtailor, Breezy, Rippling, BambooHR) are
// added in later steps of Phase 1.
export const ATS_ADAPTERS: Partial<Record<AtsName, AtsAdapter>> = {
  greenhouse: greenhouseAdapter,
  recruitee: recruiteeAdapter,
};

export * from "./types.ts";
export { classifyQuestion } from "./questions.ts";
export { classifyLocation } from "./location.ts";

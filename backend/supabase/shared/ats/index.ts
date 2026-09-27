import type { AtsAdapter, AtsName } from "./types.ts";
import { greenhouseAdapter } from "./greenhouse.ts";
import { recruiteeAdapter } from "./recruitee.ts";
import { ashbyAdapter } from "./ashby.ts";
import { leverAdapter } from "./lever.ts";
import {
  bambooAdapter,
  breezyAdapter,
  ripplingAdapter,
  smartRecruitersAdapter,
  teamtailorAdapter,
  workableAdapter,
} from "./more-adapters.ts";

// All ten decided platforms (docs/JOB_SEARCH_REENGINEERING_PLAN.md).
export const ATS_ADAPTERS: Record<AtsName, AtsAdapter> = {
  greenhouse: greenhouseAdapter,
  recruitee: recruiteeAdapter,
  ashby: ashbyAdapter,
  lever: leverAdapter,
  smartrecruiters: smartRecruitersAdapter,
  workable: workableAdapter,
  teamtailor: teamtailorAdapter,
  breezy: breezyAdapter,
  rippling: ripplingAdapter,
  bamboohr: bambooAdapter,
};

export * from "./types.ts";
export { classifyQuestion } from "./questions.ts";
export { classifyLocation } from "./location.ts";

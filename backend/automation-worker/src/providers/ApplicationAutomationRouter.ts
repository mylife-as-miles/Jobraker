import type {
  ApplicationAutomationProvider,
  StartApplicationInput,
  StartApplicationResult,
} from "../types.js";

export class ApplicationAutomationRouter {
  constructor(private readonly rtrvr: ApplicationAutomationProvider) {}

  async startApplication(input: StartApplicationInput): Promise<StartApplicationResult> {
    return this.rtrvr.startApplication(input);
  }
}

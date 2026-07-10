import type {
  ApplicationAutomationProvider,
  StartApplicationInput,
  StartApplicationResult,
} from "../types.js";

const SKYVERN_ENDPOINT = "https://api.skyvern.com/v1/run/workflows";

export class SkyvernApplicationProvider implements ApplicationAutomationProvider {
  readonly name = "skyvern" as const;

  constructor(
    private readonly opts: {
      apiKey: string;
      fetchImpl?: typeof fetch;
    },
  ) {}

  async startApplication(input: StartApplicationInput): Promise<StartApplicationResult> {
    if (!input.skyvern?.workflowId) {
      return {
        provider: this.name,
        status: "failed",
        failureCode: "skyvern_workflow_missing",
        failureMessage: "Skyvern fallback is not configured for this application.",
      };
    }

    const fetchImpl = this.opts.fetchImpl ?? fetch;
    const body: Record<string, unknown> = {
      workflow_id: input.skyvern.workflowId,
      parameters: input.skyvern.parameters ?? {},
    };
    if (input.skyvern.proxyLocation) body.proxy_location = input.skyvern.proxyLocation;
    if (input.skyvern.webhookUrl) body.webhook_url = input.skyvern.webhookUrl;
    if (input.skyvern.title) body.title = input.skyvern.title;

    const response = await fetchImpl(SKYVERN_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.opts.apiKey,
        "x-max-steps-override": String(input.skyvern.maxStepsOverride || 200),
      },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text };
    }

    if (!response.ok) {
      return {
        provider: this.name,
        status: "failed",
        failureCode: `skyvern_http_${response.status}`,
        failureMessage:
          String(payload.detail || payload.message || payload.error || payload.raw || "Skyvern fallback failed."),
        raw: payload,
      };
    }

    const providerRunId =
      typeof payload.run_id === "string"
        ? payload.run_id
        : typeof payload.id === "string"
          ? payload.id
          : null;

    return {
      provider: this.name,
      status: providerRunId ? "running" : "failed",
      providerRunId,
      failureCode: providerRunId ? null : "skyvern_missing_run_id",
      failureMessage: providerRunId ? null : "Skyvern did not return a run id.",
      raw: payload,
    };
  }
}

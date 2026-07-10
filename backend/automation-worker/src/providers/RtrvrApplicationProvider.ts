import type { RtrvrSdk } from "@rtrvr-ai/sdk";
import { classifyRtrvrFailure, statusFromRtrvrResult } from "../fallback.js";
import {
  mapBrowserExecutionPreference,
  selectOnlineDevice,
  type DeviceListResult,
} from "../modes.js";
import { buildRtrvrApplicationRequest } from "../requestBuilder.js";
import { parseRtrvrApplicationResult } from "../schemas.js";
import type {
  ApplicationAutomationProvider,
  StartApplicationInput,
  StartApplicationResult,
} from "../types.js";

function extractStructuredPayload(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  return (
    record.output ??
    record.result ??
    record.data ??
    record.final ??
    record.extracted ??
    value
  );
}

export class RtrvrApplicationProvider implements ApplicationAutomationProvider {
  readonly name = "rtrvr" as const;

  constructor(private readonly client: RtrvrSdk) {}

  async startApplication(input: StartApplicationInput): Promise<StartApplicationResult> {
    const mode = mapBrowserExecutionPreference(input.browserPreference, {
      preferExtension: input.preferExtension,
      selectedDeviceId: input.selectedDeviceId,
    });

    if (mode.requireLocalSession) {
      const devices = (await this.client.devices.list()) as DeviceListResult;
      const onlineDevice = selectOnlineDevice(devices, mode.deviceId);
      if (!onlineDevice) {
        return {
          provider: this.name,
          status: "waiting_for_user",
          targetMode: mode.target,
          selectedMode: "extension",
          deviceId: mode.deviceId ?? null,
          failureCode: "extension_unavailable",
          failureMessage: "Waiting for your Chrome extension.",
          raw: devices,
        };
      }
      mode.deviceId = onlineDevice.deviceId;
    }

    try {
      const request = buildRtrvrApplicationRequest(input, mode);
      const response = await this.client.run(request);
      const structured = parseRtrvrApplicationResult(
        extractStructuredPayload(response.data),
      );

      return {
        provider: this.name,
        status: statusFromRtrvrResult(structured),
        targetMode: response.metadata.requestedMode,
        selectedMode: response.metadata.selectedMode,
        fallbackApplied: response.metadata.fallbackApplied,
        fallbackReason: response.metadata.fallbackReason ?? null,
        deviceId: response.metadata.deviceId ?? mode.deviceId ?? null,
        providerRequestId: response.metadata.requestId ?? null,
        result: structured,
        raw: response,
      };
    } catch (error) {
      const classified = classifyRtrvrFailure(error);
      return {
        provider: this.name,
        status: classified.waitingForUser ? "waiting_for_user" : "failed",
        targetMode: mode.target,
        selectedMode: mode.target === "cloud" ? "cloud" : mode.target === "extension" ? "extension" : null,
        deviceId: mode.deviceId ?? null,
        failureCode: classified.code,
        failureMessage: classified.message,
        raw: error instanceof Error ? { name: error.name, message: error.message } : error,
      };
    }
  }
}

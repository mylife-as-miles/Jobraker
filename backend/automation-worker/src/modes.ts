import type { BrowserExecutionPreference, RtrvrTargetMode } from "./types.js";

export interface DeviceInfo {
  deviceId: string;
  deviceName?: string;
  lastSeen?: string;
  hasFcmToken?: boolean;
}

export interface DeviceListResult {
  online: boolean;
  deviceCount: number;
  devices: DeviceInfo[];
}

export interface RtrvrExecutionMode {
  target: RtrvrTargetMode;
  preferExtension: boolean;
  requireLocalSession: boolean;
  deviceId?: string;
  requestedLabel: "Automatic" | "My Chrome" | "Jobraker Cloud";
}

export function normalizeBrowserExecutionPreference(
  value: unknown,
): BrowserExecutionPreference {
  if (value === "my_chrome" || value === "jobraker_cloud" || value === "automatic") {
    return value;
  }
  return "automatic";
}

export function mapBrowserExecutionPreference(
  preference: BrowserExecutionPreference,
  opts: {
    preferExtension?: boolean;
    selectedDeviceId?: string | null;
  } = {},
): RtrvrExecutionMode {
  if (preference === "my_chrome") {
    return {
      target: "extension",
      preferExtension: true,
      requireLocalSession: true,
      deviceId: opts.selectedDeviceId || undefined,
      requestedLabel: "My Chrome",
    };
  }

  if (preference === "jobraker_cloud") {
    return {
      target: "cloud",
      preferExtension: false,
      requireLocalSession: false,
      requestedLabel: "Jobraker Cloud",
    };
  }

  return {
    target: "auto",
    preferExtension: opts.preferExtension ?? true,
    requireLocalSession: false,
    deviceId: opts.selectedDeviceId || undefined,
    requestedLabel: "Automatic",
  };
}

export function selectOnlineDevice(
  devices: DeviceListResult,
  selectedDeviceId?: string | null,
): DeviceInfo | null {
  if (!devices.online || !Array.isArray(devices.devices)) return null;
  if (selectedDeviceId) {
    return devices.devices.find((device) => device.deviceId === selectedDeviceId) ?? null;
  }
  return devices.devices[0] ?? null;
}

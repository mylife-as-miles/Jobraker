import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const isEmptyString = (value: unknown): value is "" => {
  return typeof value === "string" && value.trim().length === 0;
};

export const isUrl = (url: string) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export const linearTransform = (
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
) => {
  return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
};

// A simple sanitize function. For a real application, use a library like DOMPurify.
export const sanitize = (html: string) => {
  const SCRIPT_REGEX = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;

  while (SCRIPT_REGEX.test(html)) {
    html = html.replace(SCRIPT_REGEX, "");
  }

  return html;
};

export const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)}`
    : null;
};

export const pageSizeMap = {
  "a4": {
    "width": 210,
    "height": 297
  },
  "letter": {
    "width": 215.9,
    "height": 279.4
  },
  "legal": {
    "width": 215.9,
    "height": 355.6
  },
  "tabloid": {
    "width": 279.4,
    "height": 431.8
  },
  "executive": {
    "width": 184.1,
    "height": 266.7
  }
}

// Export a type for supported page formats
export type PageFormat = keyof typeof pageSizeMap;

// Additional helpers referenced by client UI
export const generateRandomName = () => {
  const adjectives = ["Agile", "Brave", "Calm", "Daring", "Eager", "Fuzzy"];
  const nouns = ["Resume", "CV", "Profile", "Document", "Portfolio"];
  return `${adjectives[Math.floor(Math.random()*adjectives.length)]} ${nouns[Math.floor(Math.random()*nouns.length)]}`;
};

export const sortByDate = <T extends { updatedAt?: Date | string }>(items: T[]) =>
  [...items].sort((a, b) => new Date(b.updatedAt as any).getTime() - new Date(a.updatedAt as any).getTime());

export const languages = ["en-US"] as const;

export const templatesList = [
  { id: "modern", name: "Modern" },
  { id: "classic", name: "Classic" },
];

// Minimal Google-like fonts catalog used in TypographySection
export const fonts: Array<{ family: string; subsets: string[]; variants: string[] }> = [
  { family: "IBM Plex Sans", subsets: ["latin"], variants: ["regular", "700"] },
  { family: "IBM Plex Serif", subsets: ["latin"], variants: ["regular", "700"] },
  { family: "Lato", subsets: ["latin"], variants: ["regular", "700"] },
  { family: "Lora", subsets: ["latin"], variants: ["regular", "700"] },
  { family: "Merriweather", subsets: ["latin"], variants: ["regular", "700"] },
  { family: "Open Sans", subsets: ["latin"], variants: ["regular", "700"] },
  { family: "Playfair Display", subsets: ["latin"], variants: ["regular", "700"] },
  { family: "PT Sans", subsets: ["latin"], variants: ["regular", "700"] },
  { family: "PT Serif", subsets: ["latin"], variants: ["regular", "700"] },
  { family: "Roboto Condensed", subsets: ["latin"], variants: ["regular", "700"] },
];

// Template identifiers used across artboard/builder
export type Template =
  | "azurill"
  | "bronzor"
  | "chikorita"
  | "ditto"
  | "gengar"
  | "glalie"
  | "kakuna"
  | "leafish"
  | "nosepass"
  | "onyx"
  | "pikachu"
  | "rhyhorn";

export const getInitials = (name?: string | null) => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
};

// Mock layout helper used by store
export const removeItemInLayout = (sectionId: string, layout: any[][][]) => {
  for (const page of layout) {
    for (const col of page) {
      const idx = col.indexOf(sectionId);
      if (idx !== -1) col.splice(idx, 1);
    }
  }
};

// Types + helpers used by layout section (stubs for build)
export type SortablePayload = { index?: number; containerId?: string };
export type LayoutLocator = { page: number; column: number; section: number };

export const parseLayoutLocator = (_payload: SortablePayload | null): LayoutLocator => {
  return { page: 0, column: 0, section: 0 };
};

export const moveItemInLayout = (
  _current: LayoutLocator,
  _target: LayoutLocator,
  layout: any[][][],
) => {
  // return the input layout unchanged in the stub
  return layout;
};

// Minimal error message enum used by translate-error
export enum ErrorMessage {
  InvalidCredentials = "InvalidCredentials",
  UserAlreadyExists = "UserAlreadyExists",
  SecretsNotFound = "SecretsNotFound",
  OAuthUser = "OAuthUser",
  InvalidResetToken = "InvalidResetToken",
  InvalidVerificationToken = "InvalidVerificationToken",
  EmailAlreadyVerified = "EmailAlreadyVerified",
  TwoFactorNotEnabled = "TwoFactorNotEnabled",
  TwoFactorAlreadyEnabled = "TwoFactorAlreadyEnabled",
  InvalidTwoFactorCode = "InvalidTwoFactorCode",
  InvalidTwoFactorBackupCode = "InvalidTwoFactorBackupCode",
  InvalidBrowserConnection = "InvalidBrowserConnection",
  ResumeSlugAlreadyExists = "ResumeSlugAlreadyExists",
  ResumeNotFound = "ResumeNotFound",
  ResumeLocked = "ResumeLocked",
  ResumePrinterError = "ResumePrinterError",
  ResumePreviewError = "ResumePreviewError",
  SomethingWentWrong = "SomethingWentWrong",
}

// Recursively walk an object/array and convert ISO strings to Date for the given keys
export function deepSearchAndParseDates(input: any, keys: string[] = []): any {
  if (Array.isArray(input)) return input.map((v) => deepSearchAndParseDates(v, keys));
  if (input && typeof input === "object") {
    const out: any = Array.isArray(input) ? [] : {};
    for (const [k, v] of Object.entries(input)) {
      if (v && typeof v === "string" && keys.includes(k)) {
        const d = new Date(v);
        out[k] = isNaN(d.getTime()) ? v : d;
      } else {
        out[k] = deepSearchAndParseDates(v as any, keys);
      }
    }
    return out;
  }
  return input;
}

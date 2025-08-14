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

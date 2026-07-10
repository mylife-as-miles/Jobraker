import { isIP } from "node:net";

const BLOCKED_HOSTS = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata",
]);

function isPrivateIpv4(host: string): boolean {
  const parts = host.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return false;
  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a === 0
  );
}

function isPrivateIpv6(host: string): boolean {
  const normalized = host.replace(/^\[|\]$/g, "").toLowerCase();
  return (
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:") ||
    normalized === "::"
  );
}

export function validateAutomationUrl(rawUrl: string): URL {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Only http and https application URLs are allowed.");
  }

  const host = url.hostname.toLowerCase();
  if (
    BLOCKED_HOSTS.has(host) ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    throw new Error("This application URL points to an internal host.");
  }

  const ipVersion = isIP(host);
  if (ipVersion === 4 && isPrivateIpv4(host)) {
    throw new Error("This application URL points to a private IPv4 address.");
  }
  if (ipVersion === 6 && isPrivateIpv6(host)) {
    throw new Error("This application URL points to a private IPv6 address.");
  }

  return url;
}

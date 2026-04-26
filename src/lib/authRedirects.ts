import { ROUTES } from "../routes";

function getConfiguredAppOrigin(): string | null {
  let configured = import.meta.env.VITE_APP_URL?.trim();
  if (!configured) return null;

  if (!configured.startsWith("http://") && !configured.startsWith("https://")) {
    configured = `https://${configured}`;
  }

  try {
    return new URL(configured).origin;
  } catch {
    console.warn("Ignoring invalid VITE_APP_URL value.");
    return null;
  }
}

export function getAppOrigin(): string {
  return getConfiguredAppOrigin() ?? window.location.origin;
}

export function getAuthRedirectUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getAppOrigin()}${normalizedPath}`;
}

export const AUTH_REDIRECTS = {
  dashboard: () => getAuthRedirectUrl(ROUTES.DASHBOARD),
  resetPassword: () => getAuthRedirectUrl("/reset-password"),
  signIn: () => getAuthRedirectUrl(ROUTES.SIGNIN),
} as const;

export const ROUTES = {
  ROOT: '/',
  LOGIN: '/login',
  SIGNUP: '/signup',
  ONBOARDING: '/onboarding',
  DASHBOARD: '/dashboard',
  DASHBOARD_WILDCARD: '/dashboard/*',
  ANALYTICS: '/analytics',
  ARTBOARD: '/artboard',
} as const;

export type RouteKey = keyof typeof ROUTES;

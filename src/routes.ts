export const ROUTES = {
  ROOT: '/',
  LOGIN: '/login',
  SIGNUP: '/signup',
  ONBOARDING: '/onboarding',
  DASHBOARD: '/dashboard',
  DASHBOARD_WILDCARD: '/dashboard/*',
  ANALYTICS: '/analytics',
  ARTBOARD: '/artboard',
  BUILDER: '/builder',
  PRIVACY: '/privacy',
} as const;

export type RouteKey = keyof typeof ROUTES;

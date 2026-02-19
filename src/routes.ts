export const ROUTES = {
  ROOT: '/',
  SIGNUP: '/signup',
  SIGNIN: '/signIn',
  ONBOARDING: '/onboarding',
  DASHBOARD: '/dashboard',
  DASHBOARD_WILDCARD: '/dashboard/*',
  ANALYTICS: '/analytics',
  ARTBOARD: '/artboard',
  BUILDER: '/builder',
  PRIVACY: '/privacy',
  PUBLIC_RESUME: '/r/:id',
} as const;

export type RouteKey = keyof typeof ROUTES;

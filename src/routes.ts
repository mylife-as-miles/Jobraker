export const ROUTES = {
  ROOT: '/',
  PRICING: '/pricing',
  WAITLIST: '/waitlist',
  EARLY_ACCESS: '/early-access',
  SIGNUP: '/signup',
  SIGNIN: '/signIn',
  ONBOARDING: '/onboarding',
  DASHBOARD: '/dashboard',
  DASHBOARD_WILDCARD: '/dashboard/*',
  ANALYTICS: '/analytics',
  ARTBOARD: '/artboard',
  BUILDER: '/builder',
  PRIVACY: '/privacy',
  TERMS: '/terms',
  SECURITY: '/security',
  PUBLIC_RESUME: '/r/:id',
  PUBLIC_PROFILE: '/u/:slug',
} as const;

export type RouteKey = keyof typeof ROUTES;

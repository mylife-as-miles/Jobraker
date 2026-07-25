import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../tailwind.css";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { PublicOnly } from "./components/PublicOnly";
import { RequireAuth } from "./components/RequireAuth";
import { ToastProvider } from "./components/ui/toast-provider";
import { AppearanceProvider } from "./providers/AppearanceProvider";

import { TourProvider } from "./providers/TourProvider"; // Product tour context for dashboard pages
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { ROUTES } from "./routes";
import { ToastEventBridge } from "./components/system/ToastEventBridge";
import { InputSecurityGuard } from "./components/system/InputSecurityGuard";
import { AnimatePresence } from "framer-motion";
import { PageTransition } from "./components/transitions";
import posthog, { initPostHog } from "./lib/posthog";
import { PostHogProvider } from "posthog-js/react";
import { HelmetProvider } from "react-helmet-async";
import { usePostHogAuthBridge } from "./hooks/usePostHogAuthBridge";

import { lazyWithRetry } from "./utils/lazyWithRetry";
import { RouteLoadingFallback } from "./components/system/RouteLoadingFallback";

const LandingPage = lazyWithRetry(() => import("./screens/LandingPage"), "LandingPage");
const WaitlistPage = lazyWithRetry(() => import("./screens/Waitlist/WaitlistPage"), "WaitlistPage");
const EarlyAccessPage = lazyWithRetry(() => import("./screens/EarlyAccess/EarlyAccessPage"), "EarlyAccessPage");
const JobrackerSignup = lazyWithRetry(() => import("./screens/JobrackerSignup"), "JobrackerSignup");
const Onboarding = lazyWithRetry(() => import("./screens/Onboarding"), "Onboarding");
const Analytics = lazyWithRetry(() => import("./screens/Analytics"), "Analytics");
const Dashboard = lazyWithRetry(() => import("./screens/Dashboard"), "Dashboard");
const PrivacyPolicy = lazyWithRetry(() => import("./screens/PrivacyPolicy"), "PrivacyPolicy");
const PublicResumePage = lazyWithRetry(() => import("./screens/Public/PublicResumePage"), "PublicResumePage");
const PublicProfilePage = lazyWithRetry(() => import("./screens/Public/PublicProfilePage"), "PublicProfilePage");
const PricingPage = lazyWithRetry(() => import("./screens/Pricing"), "PricingPage");
const GmailCallbackPage = lazyWithRetry(() => import("./screens/AuthCallback/GmailCallbackPage"));
const ComposioCallbackPage = lazyWithRetry(() => import("./screens/AuthCallback/ComposioCallbackPage"));
const TermsOfService = lazyWithRetry(() => import("./screens/TermsOfService"));
const SecurityPage = lazyWithRetry(() => import("./screens/SecurityPage"));
const AdminCheckCredits = lazyWithRetry(() => import("@/pages/AdminCheckCredits"));
const AdminLayout = lazyWithRetry(() => import("./pages/admin/AdminLayout"));
const AdminOverview = lazyWithRetry(() => import("./pages/admin/pages/AdminOverview"));
const AdminUsers = lazyWithRetry(() => import("./pages/admin/pages/AdminUsers"));
const AdminChat = lazyWithRetry(() => import("./pages/admin/pages/AdminChat"));
const AdminRevenue = lazyWithRetry(() => import("./pages/admin/pages/AdminRevenue"));
const AdminCredits = lazyWithRetry(() => import("./pages/admin/pages/AdminCredits"));
const AdminProviderCredits = lazyWithRetry(() => import("./pages/admin/pages/AdminProviderCredits"));
const AdminActivity = lazyWithRetry(() => import("./pages/admin/pages/AdminActivity"));
const AdminDatabase = lazyWithRetry(() => import("./pages/admin/pages/AdminDatabase"));
const AdminPerformance = lazyWithRetry(() => import("./pages/admin/pages/AdminPerformance"));
const AdminSettings = lazyWithRetry(() => import("./pages/admin/pages/AdminSettings"));
const AdminJobs = lazyWithRetry(() => import("./pages/admin/pages/AdminJobs"));
const AdminSubscriptions = lazyWithRetry(() => import("./pages/admin/pages/AdminSubscriptions"));

const APP_ORIGIN = "https://app.jobraker.io";
initPostHog();

function isAdminPublicPath(pathname: string) {
  return (
    pathname === "/signin" ||
    pathname === ROUTES.SIGNIN ||
    pathname === "/login" ||
    pathname === ROUTES.SIGNUP ||
    pathname.startsWith("/auth/")
  );
}

// Error boundary component with interactive recovery actions
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Application Error Boundary caught error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/dashboard";
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-[#08090d] text-foreground flex flex-col items-center justify-center p-6 relative overflow-hidden">
          {/* Subtle Ambient Radial Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#2fd968]/5 rounded-full blur-[140px] pointer-events-none" />

          <div className="relative z-10 max-w-md w-full rounded-2xl border border-foreground/10 bg-card/60 backdrop-blur-2xl p-6 sm:p-8 shadow-2xl text-center space-y-5">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>

            <div className="space-y-1.5">
              <h1 className="text-xl font-bold text-foreground tracking-tight">
                Something went wrong
              </h1>
              <p className="text-xs text-muted-foreground leading-relaxed">
                JobRaker encountered an unexpected state. You can reload the application or return to your dashboard.
              </p>
            </div>

            {this.state.error?.message && (
              <div className="rounded-xl border border-foreground/10 bg-black/40 p-3 text-left">
                <p className="font-mono text-[11px] text-red-400/90 break-words leading-relaxed">
                  {this.state.error.message}
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full sm:flex-1 h-10 rounded-xl bg-brand text-black font-semibold text-xs hover:bg-brand/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-brand/10 cursor-pointer"
              >
                ⚡ Reload Application
              </button>
              <button
                type="button"
                onClick={this.handleReset}
                className="w-full sm:flex-1 h-10 rounded-xl border border-foreground/15 bg-foreground/5 text-foreground font-semibold text-xs hover:bg-foreground/10 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                🏠 Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence initial={false}>
      <React.Suspense fallback={<RouteLoadingFallback />}>
      <Routes location={location} key={location.pathname}>
        {/* Default route shows landing page */}
        <Route
          path={ROUTES.ROOT}
          element={
            <PublicOnly>
              <PageTransition>
                <LandingPage />
              </PageTransition>
            </PublicOnly>
          }
        />

        {/* Waitlist Page */}
        <Route
          path={ROUTES.WAITLIST}
          element={
            <PageTransition>
              <WaitlistPage />
            </PageTransition>
          }
        />

        <Route
          path={ROUTES.EARLY_ACCESS}
          element={
            <PageTransition>
              <EarlyAccessPage />
            </PageTransition>
          }
        />

        <Route
          path={ROUTES.PRICING}
          element={
            <PublicOnly>
              <PageTransition>
                <PricingPage />
              </PageTransition>
            </PublicOnly>
          }
        />

        {/* Step 1: Signup Page */}
        <Route
          path={ROUTES.SIGNUP}
          element={
            <PublicOnly>
              <PageTransition>
                <JobrackerSignup />
              </PageTransition>
            </PublicOnly>
          }
        />

        {/* Sign In Page */}
        <Route
          path='/signin'
          caseSensitive
          element={<Navigate to={ROUTES.SIGNIN} replace />}
        />
        <Route path='/login' element={<Navigate to={ROUTES.SIGNIN} replace />} />
        <Route
          path={ROUTES.SIGNIN}
          element={
            <PublicOnly>
              <PageTransition>
                <JobrackerSignup />
              </PageTransition>
            </PublicOnly>
          }
        />

        {/* Step 2: Onboarding Page (after signup) */}
        <Route
          path={ROUTES.ONBOARDING}
          element={
            <RequireAuth>
              <PageTransition>
                <Onboarding />
              </PageTransition>
            </RequireAuth>
          }
        />

        {/* Step 3: Dashboard Page (after onboarding completion) - Now serves as main container */}
        <Route
          path={ROUTES.DASHBOARD_WILDCARD}
          element={
            <RequireAuth>
              {/* Inject TourProvider so all dashboard subpages can use useProductTour */}
              <TourProvider>
                <Dashboard />
              </TourProvider>
            </RequireAuth>
          }
        />

        {/* Standalone Analytics Page (for backward compatibility) */}
        <Route
          path={ROUTES.ANALYTICS}
          element={
            <RequireAuth>
              <PageTransition>
                <Analytics />
              </PageTransition>
            </RequireAuth>
          }
        />

        {/* Privacy Policy */}
        <Route
          path={ROUTES.PRIVACY}
          element={
            <PublicOnly>
              <PageTransition>
                <PrivacyPolicy />
              </PageTransition>
            </PublicOnly>
          }
        />

        <Route
          path={ROUTES.TERMS}
          element={
            <PublicOnly>
              <PageTransition>
                <TermsOfService />
              </PageTransition>
            </PublicOnly>
          }
        />

        <Route
          path={ROUTES.SECURITY}
          element={
            <PublicOnly>
              <PageTransition>
                <SecurityPage />
              </PageTransition>
            </PublicOnly>
          }
        />

        {/* Public Resume View */}
        <Route
          path={ROUTES.PUBLIC_RESUME}
          element={
            <PageTransition>
              <PublicResumePage />
            </PageTransition>
          }
        />

        {/* Public Profile Portfolio View */}
        <Route
          path={ROUTES.PUBLIC_PROFILE}
          element={
            <PageTransition>
              <PublicProfilePage />
            </PageTransition>
          }
        />

        {/* Auth callback route */}
        <Route
          path='/auth/callback/gmail'
          element={
            <PageTransition>
              <GmailCallbackPage />
            </PageTransition>
          }
        />
        <Route
          path='/auth/callback/composio/:provider'
          element={
            <PageTransition>
              <ComposioCallbackPage />
            </PageTransition>
          }
        />

        {/* Admin Dashboard Routes */}
        <Route
          path='/admin'
          element={
            <RequireAuth>
              <AdminLayout />
            </RequireAuth>
          }
        >
          <Route index element={<AdminOverview />} />
          <Route path='overview' element={<AdminOverview />} />
          <Route path='users' element={<AdminUsers />} />
          <Route path='jobs' element={<AdminJobs />} />
          <Route path='chat' element={<AdminChat />} />
          <Route path='subscriptions' element={<AdminSubscriptions />} />
          <Route path='revenue' element={<AdminRevenue />} />
          <Route path='credits' element={<AdminCredits />} />
          <Route path='provider-credits' element={<AdminProviderCredits />} />
          <Route path='activity' element={<AdminActivity />} />
          <Route path='database' element={<AdminDatabase />} />
          <Route path='performance' element={<AdminPerformance />} />
          <Route path='settings' element={<AdminSettings />} />
        </Route>

        {/* Admin utility route - check user credits */}
        <Route
          path='/admin/check-credits-old'
          element={
            <RequireAuth>
              <PageTransition>
                <AdminCheckCredits />
              </PageTransition>
            </RequireAuth>
          }
        />

        {/* Catch all - redirect to landing page */}
        <Route path='*' element={<Navigate to={ROUTES.ROOT} replace />} />
      </Routes>
      </React.Suspense>
    </AnimatePresence>
  );
}



function ExternalRedirect({ to }: { to: string }) {
  React.useEffect(() => {
    window.location.replace(to);
  }, [to]);

  return null;
}

function SubdomainGuard({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const hostname = window.location.hostname;
  const isAdminHost = hostname.startsWith("admin.");

  if (
    isAdminHost &&
    location.pathname.startsWith("/dashboard")
  ) {
    return (
      <ExternalRedirect
        to={`${APP_ORIGIN}${location.pathname}${location.search}${location.hash}`}
      />
    );
  }

  if (
    isAdminHost &&
    !location.pathname.startsWith("/admin") &&
    !isAdminPublicPath(location.pathname)
  ) {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
}

function App() {
  const [queryClient] = React.useState(() => new QueryClient());
  usePostHogAuthBridge();

  return (
    <HelmetProvider>
      <PostHogProvider client={posthog}>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            {/* Global providers */}
            <ToastProvider>
              <AppearanceProvider>
                <InputSecurityGuard />
                <ToastEventBridge />
                <SubdomainGuard>
                  <AnimatedRoutes />
                </SubdomainGuard>
              </AppearanceProvider>
            </ToastProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </PostHogProvider>
    </HelmetProvider>
  );
}

// Add error logging
window.addEventListener("error", (event) => {
  console.error("Global error:", event.error);
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled promise rejection:", event.reason);
});

const rootElement = document.getElementById("app");
if (!rootElement) {
  console.error("Root element #app not found");
  document.body.innerHTML =
    '<div style="color: red; padding: 20px;">Error: Root element #app not found</div>';
} else {
  try {
    const root = createRoot(rootElement);
    root.render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>,
    );
    console.log("JobRaker app rendered successfully");
  } catch (error) {
    console.error("Failed to render app:", error);
    rootElement.innerHTML =
      '<div style="color: red; padding: 20px;">Failed to render JobRaker app. Check console for details.</div>';
  }
}

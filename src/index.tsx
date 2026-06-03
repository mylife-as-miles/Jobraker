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
import { LandingPage } from "./screens/LandingPage";
import { WaitlistPage } from "./screens/Waitlist/WaitlistPage";
import { EarlyAccessPage } from "./screens/EarlyAccess/EarlyAccessPage";
import { JobrackerSignup } from "./screens/JobrackerSignup";
import { Onboarding } from "./screens/Onboarding";
import { Analytics } from "./screens/Analytics";
import { Dashboard } from "./screens/Dashboard";
import { PrivacyPolicy } from "./screens/PrivacyPolicy";
import { PublicResumePage } from "./screens/Public/PublicResumePage";
import { PublicProfilePage } from "./screens/Public/PublicProfilePage";
import { PublicOnly } from "./components/PublicOnly";
import { RequireAuth } from "./components/RequireAuth";
import GmailCallbackPage from "./screens/AuthCallback/GmailCallbackPage";
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
import AdminCheckCredits from "@/pages/AdminCheckCredits";
import { usePostHogAuthBridge } from "./hooks/usePostHogAuthBridge";
import { PricingPage } from "./screens/Pricing";
import TermsOfService from "./screens/TermsOfService";
import SecurityPage from "./screens/SecurityPage";
import {
  AdminLayout,
  AdminOverview,
  AdminUsers,
  AdminChat,
  AdminRevenue,
  AdminCredits,
  AdminProviderCredits,
  AdminActivity,
  AdminDatabase,
  AdminPerformance,
  AdminSettings,
  AdminJobs,
} from "./pages/admin";
import AdminSubscriptions from "./pages/admin/pages/AdminSubscriptions";

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

// Error boundary component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Application error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "20px", textAlign: "center" }}>
          <h1>Something went wrong.</h1>
          <p>Please refresh the page or contact support.</p>
        </div>
      );
    }

    return this.props.children;
  }
}

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode='wait'>
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

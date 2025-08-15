import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LandingPage } from "./screens/LandingPage";
import { JobrackerSignup } from "./screens/JobrackerSignup";
import { Onboarding } from "./screens/Onboarding";
import { Analytics } from "./screens/Analytics";
import { Dashboard } from "./screens/Dashboard";
import Login from "./screens/Login/Login";
import { WhiteBackgroundFixer } from "./components/WhiteBackgroundFixer";
import { PublicOnly } from "./components/PublicOnly";
import { RequireAuth } from "./components/RequireAuth";
import { ToastProvider } from "./components/ui/toast-provider";
import { ArtboardPage } from "./pages/artboard";
import { BuilderLayout } from "./pages/builder";
import { PreviewLayout } from "./pages/preview";
import { Providers } from "./providers";
import { ROUTES } from "./routes";
// Client pages imported from merged client app
import { PublicResumePage } from "./client/pages/public/page";
import { DashboardLayout as ClientDashboardLayout } from "./client/pages/dashboard/layout";
import { ResumesPage } from "./client/pages/dashboard/resumes/page";
import { SettingsPage } from "./client/pages/dashboard/settings/page";
import { BuilderPage } from "./client/pages/builder/page";
import { Providers as ClientProviders } from "./client/providers";

// Error boundary component
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): {hasError: boolean} {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Application error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <h1>Something went wrong.</h1>
          <p>Please refresh the page or contact support.</p>
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {
  return (
    <BrowserRouter>
      {/* Global providers */}
      <ToastProvider>
        {/* Auto-fix white backgrounds across the app */}
        <WhiteBackgroundFixer autoFix={true} showDebugInfo={false} />
        
        <Routes>
        {/* Default route shows landing page */}
          <Route path={ROUTES.ROOT} element={<PublicOnly><LandingPage /></PublicOnly>} />
        
        {/* Step 1: Signup Page */}
          <Route path={ROUTES.SIGNUP} element={<PublicOnly><JobrackerSignup /></PublicOnly>} />

        {/* Login Page */}
          <Route path={ROUTES.LOGIN} element={<PublicOnly><Login /></PublicOnly>} />
        
        {/* Step 2: Onboarding Page (after signup) */}
          <Route path={ROUTES.ONBOARDING} element={<RequireAuth><Onboarding /></RequireAuth>} />
        
        {/* Step 3: Dashboard Page (after onboarding completion) - Now serves as main container */}
          <Route path={ROUTES.DASHBOARD_WILDCARD} element={<RequireAuth><Dashboard /></RequireAuth>} />
        
        {/* Standalone Analytics Page (for backward compatibility) */}
          <Route path={ROUTES.ANALYTICS} element={<RequireAuth><Analytics /></RequireAuth>} />
        
        {/* Artboard routes */}
        <Route element={<RequireAuth><Providers/></RequireAuth>}>
            <Route path={ROUTES.ARTBOARD} element={<ArtboardPage/>}>
                <Route path="builder" element={<BuilderLayout/>}/>
                <Route path="preview" element={<PreviewLayout/>}/>
            </Route>
        </Route>

        {/* Client public resume routes (/:username/:slug) */}
        <Route element={<ClientProviders />}>
          <Route path=":username">
            <Route path=":slug" element={<PublicResumePage />} />
          </Route>
        </Route>

        {/* Optionally expose client HomePage at root if desired (keep behind PublicOnly) */}
        {/* <Route path="/client" element={<PublicOnly><HomePage /></PublicOnly>} /> */}

        {/* Client dashboard routes under /dashboard/client to avoid collision with main */}
        <Route element={<RequireAuth><ClientProviders /></RequireAuth>}>
          <Route path="/dashboard/client" element={<ClientDashboardLayout />}>
            <Route path="resumes" element={<ResumesPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route index element={<Navigate replace to="resumes" />} />
          </Route>
        </Route>

        {/* Client builder route (protected) */}
        <Route element={<RequireAuth><ClientProviders /></RequireAuth>}>
          <Route path={ROUTES.BUILDER} element={<ClientDashboardLayout />}>
            <Route path=":id" element={<BuilderPage />} />
            <Route index element={<Navigate replace to="/dashboard/client/resumes" />} />
          </Route>
        </Route>

        {/* Catch all - redirect to landing page */}
          <Route path="*" element={<Navigate to={ROUTES.ROOT} replace />} />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  );
}

// Add error logging
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

const rootElement = document.getElementById("app");
if (!rootElement) {
  console.error('Root element #app not found');
  document.body.innerHTML = '<div style="color: red; padding: 20px;">Error: Root element #app not found</div>';
} else {
  try {
    const root = createRoot(rootElement);
    root.render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>
    );
    console.log('JobRaker app rendered successfully');
  } catch (error) {
    console.error('Failed to render app:', error);
    rootElement.innerHTML = '<div style="color: red; padding: 20px;">Failed to render JobRaker app. Check console for details.</div>';
  }
}
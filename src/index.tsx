import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LandingPage } from "./screens/LandingPage";
import { JobrackerSignup } from "./screens/JobrackerSignup";
import { Onboarding } from "./screens/Onboarding";
import { PasswordReset } from "./screens/PasswordReset";
import { Analytics } from "./screens/Analytics";
import { Dashboard } from "./screens/Dashboard";
import Login from "./screens/Login/Login";
import { WhiteBackgroundFixer } from "./components/WhiteBackgroundFixer";
import { RequireAuth } from "./components/RequireAuth";

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
      {/* Auto-fix white backgrounds across the app */}
      <WhiteBackgroundFixer autoFix={true} showDebugInfo={false} />
      
      <Routes>
        {/* Default route shows landing page */}
        <Route path="/" element={<LandingPage />} />
        
        {/* Step 1: Signup Page */}
        <Route path="/signup" element={<JobrackerSignup />} />

        {/* Login Page */}
        <Route path="/login" element={<Login />} />
        
  {/* Step 2: Onboarding Page (after signup) */}
  <Route path="/onboarding" element={<RequireAuth><Onboarding /></RequireAuth>} />
        
  {/* Password reset handler (Supabase recovery flow) */}
  <Route path="/reset-password" element={<PasswordReset />} />

  {/* Step 3: Dashboard Page (after onboarding completion) - Now serves as main container */}
  <Route path="/dashboard/*" element={<RequireAuth><Dashboard /></RequireAuth>} />
        
  {/* Standalone Analytics Page (for backward compatibility) */}
  <Route path="/analytics" element={<RequireAuth><Analytics /></RequireAuth>} />
        
        {/* Catch all - redirect to landing page */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
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
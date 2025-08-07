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

// Error boundary component
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Application Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          backgroundColor: '#000',
          color: '#fff',
          fontFamily: 'Inter, sans-serif',
          padding: '20px',
          textAlign: 'center'
        }}>
          <h1 style={{ color: '#1dff00', marginBottom: '20px' }}>JobRaker</h1>
          <h2>Something went wrong.</h2>
          <p>Please check the console for more details.</p>
          <button 
            onClick={() => window.location.reload()}
            style={{
              backgroundColor: '#1dff00',
              color: '#000',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '5px',
              marginTop: '20px',
              cursor: 'pointer'
            }}
          >
            Reload Page
          </button>
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
        <Route path="/onboarding" element={<Onboarding />} />
        
        {/* Step 3: Dashboard Page (after onboarding completion) - Now serves as main container */}
        <Route path="/dashboard/*" element={<Dashboard />} />
        
        {/* Standalone Analytics Page (for backward compatibility) */}
        <Route path="/analytics" element={<Analytics />} />
        
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
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LandingPage } from "./screens/LandingPage";
import { JobrackerSignup } from "./screens/JobrackerSignup";
import { Onboarding } from "./screens/Onboarding";
import { Analytics } from "./screens/Analytics";
import { Dashboard } from "./screens/Dashboard";
import Login from "./screens/Login/Login";
import { WhiteBackgroundFixer } from "./components/WhiteBackgroundFixer";

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

createRoot(document.getElementById("app") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
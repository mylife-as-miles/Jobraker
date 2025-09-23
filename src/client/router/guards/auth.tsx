import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useUser } from "@/client/services/user";

export const AuthGuard = () => {
  const location = useLocation();
  // const redirectTo = location.pathname + location.search;

  const { user, loading } = useUser();

  if (loading) return null;

  if (user) return <Outlet />;

  // Allow builder and create-resume routes for local/offline usage
  const path = location.pathname;
  if (path.startsWith("/dashboard/resumes/new") || path.startsWith("/builder/")) {
    return <Outlet />;
  }

  // Graceful fallback when signIn route isn't available in this app
  return <Navigate replace to="/" />;
};

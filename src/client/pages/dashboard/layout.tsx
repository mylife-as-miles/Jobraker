import { Outlet, Link, useLocation } from "react-router-dom";
import { FadersHorizontal } from "@phosphor-icons/react";

export const DashboardLayout = () => {
  const location = useLocation();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Mobile top bar with Settings shortcut */}
        <div className="mb-4 flex items-center justify-end lg:hidden">
          {location.pathname !== "/dashboard/settings" && (
            <Link
              to="/dashboard/settings"
              aria-label="Settings"
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <FadersHorizontal size={20} />
            </Link>
          )}
        </div>
        <Outlet />
      </div>
    </div>
  );
};

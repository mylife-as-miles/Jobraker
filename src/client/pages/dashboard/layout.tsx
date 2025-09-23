import { Outlet, Link, useLocation } from "react-router-dom";
import { FadersHorizontal, List } from "@phosphor-icons/react";
import { useState } from "react";
import { Sidebar } from "@/client/pages/dashboard/_components/sidebar";

export const DashboardLayout = () => {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="w-full mx-auto p-4 sm:p-5 lg:p-8">
        {/* Mobile top bar with Menu and Settings */}
        <div className="mb-4 flex items-center justify-between lg:hidden">
          <button
            type="button"
            aria-label="Open sidebar"
            onClick={() => setSidebarOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <List width={20} height={20} />
          </button>
          {location.pathname !== "/dashboard/settings" && (
            <Link
              to="/dashboard/settings"
              aria-label="Settings"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <FadersHorizontal width={20} height={20} />
            </Link>
          )}
        </div>

        {/* Layout grid: Sidebar (desktop) + Content */}
        <div className="mx-auto max-w-7xl lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-8">
          {/* Desktop sidebar */}
          <aside className="hidden lg:block">
            <div className="sticky top-6 h-[calc(100vh-6rem)] rounded-xl border border-border bg-card/70 backdrop-blur-sm p-3">
              <Sidebar />
            </div>
          </aside>

          {/* Main content */}
          <main className="min-w-0">
            <Outlet />
          </main>
        </div>

        {/* Mobile Sidebar Drawer */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-[110] lg:hidden">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setSidebarOpen(false)}
            />
            <div className="absolute left-0 top-0 h-full w-80 max-w-[85%] border-r border-border bg-background shadow-xl">
              <div className="h-full p-3">
                <Sidebar setOpen={setSidebarOpen} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

import { Outlet } from "react-router-dom";

export const DashboardLayout = () => {
  return (
    <div className="min-h-screen bg-black">
      <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <Outlet />
      </div>
    </div>
  );
};

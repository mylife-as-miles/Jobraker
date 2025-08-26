import { createBrowserRouter, createRoutesFromElements, Navigate, Route } from "react-router-dom";

import { BuilderLayout } from "../pages/builder/layout";
import { builderLoader, BuilderPage } from "../pages/builder/page";
import { DashboardLayout } from "../pages/dashboard/layout";
import { ImportResumePage } from "../pages/dashboard/resumes/import";
import { ResumesPage } from "../pages/dashboard/resumes/page";
import { SettingsPage } from "../pages/dashboard/settings/page";
import { HomeLayout } from "../pages/home/layout";
import { HomePage } from "../pages/home/page";
import { ErrorPage } from "../pages/public/error";
import { publicLoader, PublicResumePage } from "../pages/public/page";
import { Providers } from "../providers";
// Auth-related routes and guards removed; main app handles auth (Supabase)

export const routes = createRoutesFromElements(
  <Route element={<Providers />}>
    <Route errorElement={<ErrorPage />}>
      <Route element={<HomeLayout />}>
        <Route path="/" element={<HomePage />} />
      </Route>

  {/* Auth routes removed; handled by main app */}

      <Route path="dashboard">
        <Route element={<DashboardLayout />}>
          <Route path="resumes" element={<ResumesPage />} />
          <Route path="resumes/import" element={<ImportResumePage />} />
          <Route path="settings" element={<SettingsPage />} />

          <Route index element={<Navigate replace to="/dashboard/resumes" />} />
        </Route>
      </Route>

      <Route path="builder">
        <Route element={<BuilderLayout />}>
          <Route path=":id" loader={builderLoader} element={<BuilderPage />} />

          <Route index element={<Navigate replace to="/dashboard/resumes" />} />
        </Route>
      </Route>

      {/* Public Routes */}
      <Route path=":username">
        <Route path=":slug" loader={publicLoader} element={<PublicResumePage />} />
      </Route>
    </Route>
  </Route>,
);

export const router = createBrowserRouter(routes);

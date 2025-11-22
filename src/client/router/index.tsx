import { createBrowserRouter, createRoutesFromElements, Navigate, Route } from "react-router-dom";

import { BuilderLayout } from "@/client/pages/builder/layout";
import { builderLoader, builderNewLoader, BuilderPage } from "@/client/pages/builder/page";
import { CoverLetterPage } from "@/client/pages/dashboard/cover-letter/page";
import { DashboardLayout } from "@/client/pages/dashboard/layout";
import { ResumesPage } from "@/client/pages/dashboard/resumes/page";
import { SettingsPage } from "@/client/pages/dashboard/settings/page";
import { HomeLayout } from "@/client/pages/home/layout";
import { HomePage } from "@/client/pages/home/page";
import { ErrorPage } from "@/client/pages/public/error";
import { publicLoader, PublicResumePage } from "@/client/pages/public/page";
import { Providers } from "@/client/providers";
import { AuthGuard } from "./guards/auth";

export const routes = createRoutesFromElements(
  <Route element={<Providers />}>
    <Route errorElement={<ErrorPage />}>
      <Route element={<HomeLayout />}>
        <Route path="/" element={<HomePage />} />
      </Route>

  {/* Auth routes removed; handled by main app */}

      <Route path="dashboard">
        <Route element={<AuthGuard />}>
          <Route element={<DashboardLayout />}>
            <Route path="resumes" element={<ResumesPage />}>
              <Route path="builder">
                <Route element={<BuilderLayout />}>
                  <Route path="new" loader={builderNewLoader} element={<BuilderPage />} />
                  <Route path=":id" loader={builderLoader} element={<BuilderPage />} />
                </Route>
              </Route>
            </Route>
            <Route path="settings" element={<SettingsPage />} />
            <Route path="cover-letter" element={<CoverLetterPage />} />

            <Route index element={<Navigate replace to="/dashboard/resumes" />} />
          </Route>
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

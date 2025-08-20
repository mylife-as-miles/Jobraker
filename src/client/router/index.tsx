import { createBrowserRouter, createRoutesFromElements, Navigate, Route } from "react-router-dom";

import { BuilderLayout } from "../pages/builder/layout";
import { builderLoader, BuilderPage } from "../pages/builder/page";
import { HomeLayout } from "../pages/home/layout";
import { HomePage } from "../pages/home/page";
import { ErrorPage } from "../pages/public/error";
import { publicLoader, PublicResumePage } from "../pages/public/page";
import { Providers } from "../providers";
import { Dashboard } from "../../screens/Dashboard";
import { ApplicationPage } from "../../screens/Dashboard/pages/ApplicationPage";
import { ChatPage } from "../../screens/Dashboard/pages/ChatPage";
import { JobPage } from "../../screens/Dashboard/pages/JobPage";
import { NotificationPage } from "../../screens/Dashboard/pages/NotificationPage";
import { OverviewPage } from "../../screens/Dashboard/pages/OverviewPage";
import { ProfilePage } from "../../screens/Dashboard/pages/ProfilePage";
import { ResumePage } from "../../screens/Dashboard/pages/ResumePage";
import { SettingsPage } from "../../screens/Dashboard/pages/SettingsPage";
import { AnalyticsContent } from "../../components/analytics/AnalyticsContent";

export const routes = createRoutesFromElements(
  <Route element={<Providers />}>
    <Route errorElement={<ErrorPage />}>
      <Route element={<HomeLayout />}>
        <Route path="/" element={<HomePage />} />
      </Route>

      <Route path="/dashboard" element={<Dashboard />}>
        <Route index element={<Navigate replace to="/dashboard/resume" />} />
        <Route path="overview" element={<OverviewPage />} />
        <Route path="analytics" element={<AnalyticsContent />} />
        <Route path="chat" element={<ChatPage />} />
        <Route path="resume" element={<ResumePage />} />
        <Route path="jobs" element={<JobPage />} />
        <Route path="application" element={<ApplicationPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="notifications" element={<NotificationPage />} />
        <Route path="profile" element={<ProfilePage />} />
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

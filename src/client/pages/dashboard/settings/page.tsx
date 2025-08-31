import { Helmet } from "react-helmet-async";
import { t } from "@lingui/macro";
import { AccountSettings } from "./_sections/account";
import { SecuritySettings } from "./_sections/security";
import { DangerZoneSettings } from "./_sections/danger";
import { JobSourceSettings } from "./_sections/job-sources";

export const SettingsPage = () => {
  return (
    <div className="space-y-6">
      <Helmet>
        <title>
          {t`Settings`} - JobRaker
        </title>
      </Helmet>

      <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">{t`Settings`}</h1>

      <div className="grid gap-6">
        <AccountSettings />
        <SecuritySettings />
        <JobSourceSettings />
        <DangerZoneSettings />
      </div>
    </div>
  );
};

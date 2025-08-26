import { t } from "@lingui/macro";
import { Helmet } from "react-helmet-async";

export const ImportResumePage = () => {
  return (
    <>
      <Helmet>
        <title>
          {t`Import Resume`} - {t`Reactive Resume`}
        </title>
      </Helmet>

      <div className="space-y-6">
        <h1 className="text-3xl font-semibold tracking-tight">{t`Import Resume`}</h1>
        <p>{t`This is the page for importing resumes.`}</p>
      </div>
    </>
  );
};

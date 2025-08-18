import React from "react";
import { Providers as ClientProviders } from "@/client/providers";
import { BuilderPage } from "@/client/pages/builder/page";

const ResumeBuilderRoute: React.FC = () => {
  return (
    <ClientProviders>
      <BuilderPage />
    </ClientProviders>
  );
};

export default ResumeBuilderRoute;

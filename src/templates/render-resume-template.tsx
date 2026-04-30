import type React from "react";
import { AzurillTemplate } from "./azurill";
import { BronzorTemplate } from "./bronzor";
import { ChikoritaTemplate } from "./chikorita";
import { DitgarTemplate } from "./ditgar";
import { DittoTemplate } from "./ditto";
import { EeveeTemplate } from "./eevee";
import { GengarTemplate } from "./gengar";
import { GlalieTemplate } from "./glalie";
import { KakunaTemplate } from "./kakuna";
import { LaprasTemplate } from "./lapras";
import { OnyxTemplate } from "./onyx";
import { PikachuTemplate } from "./pikachu";
import { RhyhornTemplate } from "./rhyhorn";
import type { TemplateProps } from "./azurill/types";
import type { ResumeData } from "@/store/artboard";
import {
  ResumeTemplateDataProvider,
  useResumeTemplateData,
} from "./use-resume-template-data";

interface ResumeTemplateRendererProps extends TemplateProps {
  templateId: string;
  resumeDataOverride?: ResumeData;
}

export function ResumeTemplateRenderer({
  templateId,
  pageIndex = 0,
  pageLayout,
  metadataOverride,
  resumeDataOverride,
}: ResumeTemplateRendererProps) {
  let templateNode: JSX.Element;

  switch (templateId) {
    case "azurill":
      templateNode = (
        <AzurillTemplate
          pageIndex={pageIndex}
          pageLayout={pageLayout}
          metadataOverride={metadataOverride}
        />
      );
      break;
    case "onyx":
      templateNode = (
        <OnyxTemplate
          pageIndex={pageIndex}
          pageLayout={pageLayout}
          metadataOverride={metadataOverride}
        />
      );
      break;
    case "bronzor":
      templateNode = (
        <BronzorTemplate
          pageIndex={pageIndex}
          pageLayout={pageLayout}
          metadataOverride={metadataOverride}
        />
      );
      break;
    case "chikorita":
      templateNode = (
        <ChikoritaTemplate
          pageIndex={pageIndex}
          pageLayout={pageLayout}
          metadataOverride={metadataOverride}
        />
      );
      break;
    case "ditgar":
      templateNode = (
        <DitgarTemplate
          pageIndex={pageIndex}
          pageLayout={pageLayout}
          metadataOverride={metadataOverride}
        />
      );
      break;
    case "ditto":
      templateNode = (
        <DittoTemplate
          pageIndex={pageIndex}
          pageLayout={pageLayout}
          metadataOverride={metadataOverride}
        />
      );
      break;
    case "eevee":
      templateNode = (
        <EeveeTemplate
          pageIndex={pageIndex}
          pageLayout={pageLayout}
          metadataOverride={metadataOverride}
        />
      );
      break;
    case "gengar":
      templateNode = (
        <GengarTemplate
          pageIndex={pageIndex}
          pageLayout={pageLayout}
          metadataOverride={metadataOverride}
        />
      );
      break;
    case "glalie":
      templateNode = (
        <GlalieTemplate
          pageIndex={pageIndex}
          pageLayout={pageLayout}
          metadataOverride={metadataOverride}
        />
      );
      break;
    case "kakuna":
      templateNode = (
        <KakunaTemplate
          pageIndex={pageIndex}
          pageLayout={pageLayout}
          metadataOverride={metadataOverride}
        />
      );
      break;
    case "lapras":
      templateNode = (
        <LaprasTemplate
          pageIndex={pageIndex}
          pageLayout={pageLayout}
          metadataOverride={metadataOverride}
        />
      );
      break;
    case "pikachu":
      templateNode = (
        <PikachuTemplate
          pageIndex={pageIndex}
          pageLayout={pageLayout}
          metadataOverride={metadataOverride}
        />
      );
      break;
    case "rhyhorn":
      templateNode = (
        <RhyhornTemplate
          pageIndex={pageIndex}
          pageLayout={pageLayout}
          metadataOverride={metadataOverride}
        />
      );
      break;
    default:
      templateNode = (
        <AzurillTemplate
          pageIndex={pageIndex}
          pageLayout={pageLayout}
          metadataOverride={metadataOverride}
        />
      );
      break;
  }

  return (
    <ResumeTemplateDataProvider
      value={
        resumeDataOverride || metadataOverride
          ? { resumeDataOverride, metadataOverride }
          : null
      }
    >
      <ResumeTemplateShell>
        {templateNode}
      </ResumeTemplateShell>
    </ResumeTemplateDataProvider>
  );
}

function ResumeTemplateShell({ children }: { children: React.ReactNode }) {
  const resumeData = useResumeTemplateData();
  const paragraphSpacing =
    resumeData.metadata.typography.font.paragraphSpacing ?? 8;

  return (
    <div
      className='h-full w-full'
      style={
        {
          "--resume-paragraph-spacing": `${paragraphSpacing}px`,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}

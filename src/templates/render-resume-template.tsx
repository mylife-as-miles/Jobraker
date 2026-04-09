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

interface ResumeTemplateRendererProps extends TemplateProps {
  templateId: string;
}

export function ResumeTemplateRenderer({
  templateId,
  pageIndex = 0,
  pageLayout,
  metadataOverride,
}: ResumeTemplateRendererProps) {
  switch (templateId) {
    case "azurill":
      return <AzurillTemplate pageIndex={pageIndex} pageLayout={pageLayout} metadataOverride={metadataOverride} />;
    case "onyx":
      return <OnyxTemplate pageIndex={pageIndex} pageLayout={pageLayout} metadataOverride={metadataOverride} />;
    case "bronzor":
      return <BronzorTemplate pageIndex={pageIndex} pageLayout={pageLayout} metadataOverride={metadataOverride} />;
    case "chikorita":
      return <ChikoritaTemplate pageIndex={pageIndex} pageLayout={pageLayout} metadataOverride={metadataOverride} />;
    case "ditgar":
      return <DitgarTemplate pageIndex={pageIndex} pageLayout={pageLayout} metadataOverride={metadataOverride} />;
    case "ditto":
      return <DittoTemplate pageIndex={pageIndex} pageLayout={pageLayout} metadataOverride={metadataOverride} />;
    case "eevee":
      return <EeveeTemplate pageIndex={pageIndex} pageLayout={pageLayout} metadataOverride={metadataOverride} />;
    case "gengar":
      return <GengarTemplate pageIndex={pageIndex} pageLayout={pageLayout} metadataOverride={metadataOverride} />;
    case "glalie":
      return <GlalieTemplate pageIndex={pageIndex} pageLayout={pageLayout} metadataOverride={metadataOverride} />;
    case "kakuna":
      return <KakunaTemplate pageIndex={pageIndex} pageLayout={pageLayout} metadataOverride={metadataOverride} />;
    case "lapras":
      return <LaprasTemplate pageIndex={pageIndex} pageLayout={pageLayout} metadataOverride={metadataOverride} />;
    case "pikachu":
      return <PikachuTemplate pageIndex={pageIndex} pageLayout={pageLayout} metadataOverride={metadataOverride} />;
    case "rhyhorn":
      return <RhyhornTemplate pageIndex={pageIndex} pageLayout={pageLayout} metadataOverride={metadataOverride} />;
    default:
      return <AzurillTemplate pageIndex={pageIndex} pageLayout={pageLayout} metadataOverride={metadataOverride} />;
  }
}

import type React from "react";
import { LayoutTemplate } from "lucide-react";
import { AndersonTemplate } from "./anderson";
import { ClarkeTemplate } from "./clarke";
import { DianTemplate } from "./dian";
import { KumarTemplate } from "./kumar";
import { LaurentTemplate } from "./laurent";
import { LintonTemplate } from "./linton";
import { MercadoTemplate } from "./mercado";
import { MicahTemplate } from "./micah";
import { RoscaTemplate } from "./rosca";
import { SmithTemplate } from "./smith";
import type { TemplateProps } from "./types";
import type { ResumeData } from "@/store/artboard";
import {
  ResumeTemplateDataProvider,
  useResumeTemplateData,
} from "./use-resume-template-data";

/**
 * Registry of available resume templates.
 *
 * The previous batch of templates has been removed. To add the new batch,
 * import each template and map its id to the component here, e.g.:
 *
 *   import { MyTemplate } from "./my-template";
 *
 *   const TEMPLATE_REGISTRY: Record<string, TemplateComponent> = {
 *     "my-template": MyTemplate,
 *   };
 *
 * Also register the id/name/description in the gallery lists
 * (TemplateGallery.tsx, TemplateSelector.tsx, TemplateDetailPreview.tsx).
 */
type TemplateComponent = React.ComponentType<TemplateProps>;

const TEMPLATE_REGISTRY: Record<string, TemplateComponent> = {
  linton: LintonTemplate,
  kumar: KumarTemplate,
  micah: MicahTemplate,
  smith: SmithTemplate,
  clarke: ClarkeTemplate,
  mercado: MercadoTemplate,
  anderson: AndersonTemplate,
  rosca: RoscaTemplate,
  laurent: LaurentTemplate,
  dian: DianTemplate,
};

// Resumes created before this batch (or by AI) may carry an old / deleted template id.
// Map known legacy ids to equivalent templates, and fall back to "linton" if unmapped.
const LEGACY_TEMPLATE_MAP: Record<string, string> = {
  azurill: "linton",
  onyx: "kumar",
  pikachu: "micah",
  charmander: "smith",
  squirtle: "clarke",
  bulbasaur: "mercado",
  eevee: "anderson",
  snorlax: "rosca",
  mewtwo: "laurent",
  classic: "linton",
  modern: "kumar",
  minimal: "micah",
  professional: "smith",
  creative: "dian",
  executive: "laurent",
  tech: "mercado",
  default: "linton",
};

const FALLBACK_TEMPLATE_ID = "linton";

export function getTemplateComponent(templateId?: string | null): TemplateComponent {
  if (!templateId) return TEMPLATE_REGISTRY[FALLBACK_TEMPLATE_ID];
  const normalized = String(templateId).toLowerCase().trim();
  const aliased = LEGACY_TEMPLATE_MAP[normalized] || normalized;
  return (
    TEMPLATE_REGISTRY[aliased] ||
    TEMPLATE_REGISTRY[normalized] ||
    TEMPLATE_REGISTRY[FALLBACK_TEMPLATE_ID]
  );
}

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
  const Template = getTemplateComponent(templateId);

  return (
    <ResumeTemplateDataProvider
      value={
        resumeDataOverride || metadataOverride
          ? { resumeDataOverride, metadataOverride }
          : null
      }
    >
      <ResumeTemplateShell>
        <Template
          pageIndex={pageIndex}
          pageLayout={pageLayout}
          metadataOverride={metadataOverride}
        />
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

function ResumeTemplatePlaceholder() {
  return (
    <div className='flex h-full min-h-[400px] w-full flex-col items-center justify-center gap-3 bg-white p-10 text-center text-gray-400'>
      <LayoutTemplate className='h-10 w-10' />
      <p className='text-sm font-semibold text-gray-500'>
        No resume templates available yet
      </p>
      <p className='max-w-xs text-xs leading-relaxed'>
        A new batch of templates is on the way. Register them in
        render-resume-template.tsx.
      </p>
    </div>
  );
}

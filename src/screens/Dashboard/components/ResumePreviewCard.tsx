import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  initialResumeState,
  type ResumeData,
  type ResumeSection,
} from "@/store/artboard";
import { resolveResumePageLayout } from "@/lib/resumeLayout";
import { ResumeTemplateRenderer } from "@/templates/render-resume-template";

const PREVIEW_BASE_WIDTH = 794;
const PREVIEW_BASE_HEIGHT = 1123;
const PREVIEW_FRAME_PADDING = 8;

type ResumePreviewInput = Partial<ResumeData> & {
  basics?: Partial<ResumeData["basics"]>;
  summary?: Partial<ResumeData["summary"]>;
  sections?: Record<string, Partial<ResumeSection>>;
  metadata?: Partial<ResumeData["metadata"]>;
};

interface ResumePreviewCardProps {
  data?: ResumePreviewInput | null;
  templateId?: string | null;
}

function fallbackSection(sectionId: string, section?: Partial<ResumeSection>) {
  return {
    id: section?.id || sectionId,
    title:
      section?.title ||
      sectionId.charAt(0).toUpperCase() + sectionId.slice(1).replace(/-/g, " "),
    columns: 1,
    hidden: false,
    items: [],
    type: "basic" as const,
  };
}

function mergeSection(
  baseSection: ResumeSection | undefined,
  sectionId: string,
  section?: Partial<ResumeSection>,
): ResumeSection {
  const fallback = baseSection ?? fallbackSection(sectionId, section);

  return {
    ...fallback,
    ...section,
    id: section?.id || fallback.id,
    title: section?.title || fallback.title,
    columns: section?.columns ?? fallback.columns,
    hidden: section?.hidden ?? fallback.hidden,
    items: Array.isArray(section?.items) ? section.items : fallback.items,
    type: section?.type ?? fallback.type,
  };
}

function normalizeResumePreviewData(
  data?: ResumePreviewInput | null,
): ResumeData | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const base = structuredClone(initialResumeState.data);
  const mergedSections = { ...base.sections } as ResumeData["sections"];

  for (const [sectionId, section] of Object.entries(data.sections ?? {})) {
    mergedSections[sectionId] = mergeSection(
      mergedSections[sectionId],
      sectionId,
      section,
    );
  }

  return {
    ...base,
    ...data,
    basics: {
      ...base.basics,
      ...data.basics,
      website: {
        ...base.basics.website,
        ...data.basics?.website,
      },
      customFields: data.basics?.customFields ?? base.basics.customFields,
      profiles: data.basics?.profiles ?? base.basics.profiles,
      picture: data.basics?.picture ?? base.basics.picture,
    },
    summary: {
      ...base.summary,
      ...data.summary,
      items: data.summary?.items ?? base.summary.items,
    },
    sections: mergedSections,
    metadata: {
      ...base.metadata,
      ...data.metadata,
      layout: {
        ...base.metadata.layout,
        ...data.metadata?.layout,
        pages: data.metadata?.layout?.pages ?? base.metadata.layout.pages,
      },
      page: {
        ...base.metadata.page,
        ...data.metadata?.page,
        options: {
          ...base.metadata.page.options,
          ...data.metadata?.page?.options,
        },
      },
      typography: {
        ...base.metadata.typography,
        ...data.metadata?.typography,
        font: {
          ...base.metadata.typography.font,
          ...data.metadata?.typography?.font,
        },
      },
      theme: {
        ...base.metadata.theme,
        ...data.metadata?.theme,
      },
    },
  };
}

export const ResumePreviewCard: React.FC<ResumePreviewCardProps> = ({
  data,
  templateId,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.28);

  const previewData = useMemo(() => normalizeResumePreviewData(data), [data]);

  const previewLayout = useMemo(
    () => (previewData ? resolveResumePageLayout(previewData, 0) : undefined),
    [previewData],
  );

  const resolvedTemplateId =
    previewData?.metadata.template || templateId || "azurill";

  useEffect(() => {
    const updateScale = () => {
      const container = containerRef.current;
      if (!container) return;

      const availableWidth = Math.max(
        0,
        container.clientWidth - PREVIEW_FRAME_PADDING,
      );
      const availableHeight = Math.max(
        0,
        container.clientHeight - PREVIEW_FRAME_PADDING,
      );

      if (!availableWidth || !availableHeight) return;

      const nextScale = Math.min(
        1,
        Math.max(
          availableWidth / PREVIEW_BASE_WIDTH,
          availableHeight / PREVIEW_BASE_HEIGHT,
        ),
      );

      setScale(Number(nextScale.toFixed(4)));
    };

    updateScale();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateScale);
      return () => window.removeEventListener("resize", updateScale);
    }

    const observer = new ResizeObserver(updateScale);
    const container = containerRef.current;
    if (container) {
      observer.observe(container);
    }

    window.addEventListener("resize", updateScale);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateScale);
    };
  }, []);

  if (!previewData) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-foreground/5">
        <span className="text-xs text-foreground/50">No preview</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden p-2"
    >
      <div
        className="relative h-full w-full overflow-hidden rounded-[14px]"
      >
        <div
          className="pointer-events-none absolute left-1/2 top-0 select-none"
          style={{
            width: `${PREVIEW_BASE_WIDTH}px`,
            height: `${PREVIEW_BASE_HEIGHT}px`,
            transform: "translateX(-50%)",
          }}
        >
          <div
            className="origin-top"
            style={{
              width: `${PREVIEW_BASE_WIDTH}px`,
              height: `${PREVIEW_BASE_HEIGHT}px`,
              transform: `scale(${scale})`,
              transformOrigin: "top center",
            }}
          >
            <ResumeTemplateRenderer
              templateId={resolvedTemplateId}
              pageLayout={previewLayout}
              resumeDataOverride={previewData}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  type ResumeData,
} from "@/store/artboard";
import { resolveResumePageLayout } from "@/lib/resumeLayout";
import { ResumeTemplateRenderer } from "@/templates/render-resume-template";
import { normalizeResumeDataForEditor } from "@/lib/resumeHydration";

const PREVIEW_BASE_WIDTH = 794;
const PREVIEW_BASE_HEIGHT = 1123;
const PREVIEW_FRAME_PADDING = 8;

interface ResumePreviewCardProps {
  data?: unknown;
  templateId?: string | null;
}

export const ResumePreviewCard: React.FC<ResumePreviewCardProps> = ({
  data,
  templateId,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.28);

  const previewData = useMemo<ResumeData | null>(
    () =>
      data && typeof data === "object"
        ? normalizeResumeDataForEditor(data)
        : null,
    [data],
  );

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

import React from "react";
import { cn, pageSizeMap } from "@reactive-resume/utils";

import { useArtboardStore, type ArtboardStore } from "../store/artboard";

type Props = {
  mode?: "preview" | "builder";
  pageNumber: number;
  children: React.ReactNode;
};

export const Page = ({ mode = "preview", pageNumber, children }: Props) => {
  const page = useArtboardStore((state: ArtboardStore) => state.resume?.data?.metadata?.page);
  const fontFamily = useArtboardStore((state: ArtboardStore) => state.resume?.data?.metadata?.typography?.font?.family || "Inter");

  if (!page) {
    return <div data-page={pageNumber} className="relative bg-background text-foreground">Loading...</div>;
  }

  const { width, height } = pageSizeMap[(page.format?.toLowerCase() as keyof typeof pageSizeMap) || "a4"];

  return (
    <div
      data-page={pageNumber}
      className={cn(
        "relative bg-background text-foreground print:!shadow-none",
        mode === "builder" && "shadow-2xl",
      )}
      style={{
        fontFamily,
        width: `${width}mm`,
        minHeight: `${height}mm`,
      }}
    >
      {mode === "builder" && page.options?.pageNumbers && (
        <div className="absolute -top-7 left-0 font-bold text-foreground">Page {pageNumber}</div>
      )}

      {children}

      {mode === "builder" && page.options?.breakLine && (
        <div
          className="absolute inset-x-0 border-b border-dashed"
          style={{ top: `${height}mm` }}
        />
      )}
    </div>
  );
};

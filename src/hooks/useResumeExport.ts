import { useCallback, useRef, useState } from "react";
import type { ResumeData } from "@/store/artboard";
import { downloadResumePDF } from "@/utils/resume-download";

type ResumeExporter = (data: ResumeData) => Promise<void>;

function exportErrorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : "The PDF could not be generated. Please try again.";
}

export function useResumeExport(
  onError?: (message: string) => void,
  exporter: ResumeExporter = downloadResumePDF,
  onSuccess?: () => void,
) {
  const [exporting, setExporting] = useState(false);
  const exportInFlightRef = useRef(false);

  const downloadPdf = useCallback(async (data: ResumeData) => {
    if (exportInFlightRef.current) return false;

    exportInFlightRef.current = true;
    setExporting(true);
    try {
      await exporter(data);
      onSuccess?.();
      return true;
    } catch (error) {
      onError?.(exportErrorMessage(error));
      return false;
    } finally {
      exportInFlightRef.current = false;
      setExporting(false);
    }
  }, [exporter, onError, onSuccess]);

  return { downloadPdf, exporting } as const;
}

import React, { useState } from "react";
import { Download, FileText, Printer, Check, Sparkles, ChevronDown } from "lucide-react";
import {
  exportDocumentAsPdf,
  parseMarkdownToDocBlocks,
  previewDocumentPdf,
  type DocumentPdfOptions,
} from "@/utils/document-pdf-export";
import { useToast } from "@/components/ui/toast-provider";

interface DocumentExportCardProps {
  content: string;
  candidateName?: string;
  candidateEmail?: string;
  candidateRole?: string;
}

export const DocumentExportCard: React.FC<DocumentExportCardProps> = ({
  content,
  candidateName,
  candidateEmail,
  candidateRole,
}) => {
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [theme, setTheme] = useState<"emerald" | "slate" | "classic">("emerald");
  const [showThemeMenu, setShowThemeMenu] = useState(false);

  const { success: toastSuccess, error: toastError } = useToast();

  const { title } = parseMarkdownToDocBlocks(content);
  const displayTitle = title || "Executive Brief";

  const options: DocumentPdfOptions = {
    title: displayTitle,
    candidateName,
    candidateEmail,
    candidateRole,
    theme,
    fitToOnePage: true,
  };

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const result = await exportDocumentAsPdf(content, options);
      setDownloaded(true);
      toastSuccess("PDF Ready", `Downloaded ${result.filename}`);
      setTimeout(() => setDownloaded(false), 3000);
    } catch (err) {
      console.error("PDF Export Error:", err);
      toastError("Export Failed", "Could not generate PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const handlePreview = () => {
    try {
      previewDocumentPdf(content, options);
    } catch (err) {
      console.error("PDF Preview Error:", err);
      toastError("Preview Failed", "Could not open print preview.");
    }
  };

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-brand/25 bg-gradient-to-r from-brand/5 via-card/80 to-card p-3.5 shadow-sm backdrop-blur transition-all hover:border-brand/40">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Document Info */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/15 text-brand ring-1 ring-brand/30">
            <FileText className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="truncate text-sm font-semibold text-foreground">
                {displayTitle}
              </h4>
              <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-medium text-brand">
                <Sparkles className="h-2.5 w-2.5" />
                1-Page Brief
              </span>
            </div>
            <p className="truncate text-xs text-muted-foreground">
              Print-ready executive vector PDF • Formatted for interview & sharing
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 relative">
          {/* Theme Selector */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowThemeMenu((prev) => !prev)}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-card/60 px-2 text-xs text-muted-foreground transition hover:bg-card hover:text-foreground"
              title="Change PDF Style Theme"
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  theme === "emerald"
                    ? "bg-emerald-500"
                    : theme === "slate"
                    ? "bg-sky-500"
                    : "bg-slate-700"
                }`}
              />
              <span className="capitalize">{theme}</span>
              <ChevronDown className="h-3 w-3 opacity-60" />
            </button>

            {showThemeMenu && (
              <div className="absolute right-0 top-full z-50 mt-1 w-32 rounded-lg border border-border bg-popover p-1 shadow-lg backdrop-blur">
                {(["emerald", "slate", "classic"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setTheme(t);
                      setShowThemeMenu(false);
                    }}
                    className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs capitalize transition ${
                      theme === t
                        ? "bg-brand/10 font-medium text-brand"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        t === "emerald"
                          ? "bg-emerald-500"
                          : t === "slate"
                          ? "bg-sky-500"
                          : "bg-slate-700"
                      }`}
                    />
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Preview / Print */}
          <button
            type="button"
            onClick={handlePreview}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card/60 px-2.5 text-xs font-medium text-foreground transition hover:bg-card hover:border-brand/30"
            title="Preview & Print"
          >
            <Printer className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Print</span>
          </button>

          {/* Download PDF Button */}
          <button
            type="button"
            onClick={() => void handleDownload()}
            disabled={downloading}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-semibold text-brand-foreground shadow-sm transition hover:bg-brand/90 active:scale-95 disabled:opacity-50"
            title="Download Executive PDF"
          >
            {downloading ? (
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : downloaded ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            <span>{downloaded ? "Downloaded" : "Download PDF"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default DocumentExportCard;

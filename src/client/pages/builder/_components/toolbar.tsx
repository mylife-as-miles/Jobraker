import { t } from "@lingui/macro";
import {
  Undo2 as ArrowCounterClockwise,
  Redo2 as ArrowClockwise,
  Scan as ArrowsOutCardinal,
  Loader2 as CircleNotch,
  RotateCcw as ClockClockwise,
  Focus as CubeFocus,
  FileDown as FilePdf,
  Hash,
  Minus as LineSegment,
  Link as LinkSimple,
  Search as MagnifyingGlass,
  ZoomOut as MagnifyingGlassMinus,
  ZoomIn as MagnifyingGlassPlus,
} from "lucide-react";
import { Button, Separator, Toggle, Tooltip } from "@reactive-resume/ui";
import { cn } from "@reactive-resume/utils";
import { motion } from "framer-motion";
import { useState } from "react";

import { useToast } from "@/client/hooks/use-toast";
import { usePrintResume } from "@/client/services/resume";
import { useResumeStore, useTemporalResumeStore } from "@/client/stores/resume";

const openInNewTab = (url: string) => {
  const win = window.open(url, "_blank");
  if (win) win.focus();
};

export const BuilderToolbar = () => {
  const { toast } = useToast();

  const [panMode, setPanMode] = useState<boolean>(true);

  const setValue = useResumeStore((state) => state.setValue);
  const undo = useTemporalResumeStore((state) => state.undo);
  const redo = useTemporalResumeStore((state) => state.redo);

  const id = useResumeStore((state) => state.resume.id);
  const isPublic = useResumeStore((state) => state.resume.visibility === "public");
  const pageOptions = useResumeStore((state) => state.resume.data.metadata.page.options);

  const { printResume, loading } = usePrintResume();

  const onPrint = async () => {
    const { url } = await printResume({ id });

    openInNewTab(url);
  };

  const onCopy = async () => {
    const { url } = await printResume({ id });
    await navigator.clipboard.writeText(url);

    toast({
      variant: "success",
      title: t`A link has been copied to your clipboard.`,
      description: t`Anyone with this link can view and download the resume. Share it on your profile or with recruiters.`,
    });
  };

  const onZoomIn = () => window.dispatchEvent(new CustomEvent("ARTBOARD_CMD", { detail: { type: "ZOOM_IN" } }));
  const onZoomOut = () => window.dispatchEvent(new CustomEvent("ARTBOARD_CMD", { detail: { type: "ZOOM_OUT" } }));
  const onResetView = () => window.dispatchEvent(new CustomEvent("ARTBOARD_CMD", { detail: { type: "RESET_VIEW" } }));
  const onCenterView = () => window.dispatchEvent(new CustomEvent("ARTBOARD_CMD", { detail: { type: "CENTER_VIEW" } }));
  const onTogglePanMode = () => {
    setPanMode(!panMode);
  window.dispatchEvent(new CustomEvent("ARTBOARD_CMD", { detail: { type: "TOGGLE_PAN_MODE", panMode: !panMode } }));
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="fixed inset-x-0 bottom-0 mx-auto hidden py-6 text-center md:block pointer-events-none"
    >
      <div className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-[#0a0a0a]/98 via-[#0f0f0f]/98 to-[#0a0a0a]/98 backdrop-blur-xl border border-[#1dff00]/30 shadow-[0_0_50px_rgba(29,255,0,0.2)] px-2 py-2 pointer-events-auto">
        <Tooltip content={t`Undo`}>
          <Button
            variant="ghost"
            className="w-10 h-10 p-0 rounded-xl hover:bg-[#1dff00]/10 hover:text-[#1dff00] hover:scale-110 hover:shadow-[0_0_20px_rgba(29,255,0,0.15)] transition-all duration-200 group"
            onClick={() => {
              undo();
            }}
          >
            <ArrowCounterClockwise className="w-5 h-5 group-hover:rotate-12 transition-transform" />
          </Button>
        </Tooltip>

        <Tooltip content={t`Redo`}>
          <Button
            variant="ghost"
            className="w-10 h-10 p-0 rounded-xl hover:bg-[#1dff00]/10 hover:text-[#1dff00] hover:scale-110 hover:shadow-[0_0_20px_rgba(29,255,0,0.15)] transition-all duration-200 group"
            onClick={() => {
              redo();
            }}
          >
            <ArrowClockwise className="w-5 h-5 group-hover:-rotate-12 transition-transform" />
          </Button>
        </Tooltip>

        <Separator className="h-8 mx-1 bg-gradient-to-b from-transparent via-[#1dff00]/30 to-transparent" />

        <Tooltip content={panMode ? t`Scroll to Pan` : t`Scroll to Zoom`}>
          <Toggle 
            className={cn(
              "rounded-xl hover:bg-[#1dff00]/10 hover:scale-110 transition-all duration-200 group w-10 h-10 p-0",
              panMode && "bg-gradient-to-br from-[#1dff00]/20 to-[#1dff00]/10 border border-[#1dff00]/50 text-[#1dff00] shadow-[0_0_25px_rgba(29,255,0,0.2)]"
            )}
            pressed={panMode} 
            onPressedChange={onTogglePanMode}
          >
            {panMode ? (
              <ArrowsOutCardinal className="w-5 h-5 group-hover:scale-110 transition-transform" />
            ) : (
              <MagnifyingGlass className="w-5 h-5 group-hover:scale-110 transition-transform" />
            )}
          </Toggle>
        </Tooltip>

        <Separator className="h-8 mx-1 bg-gradient-to-b from-transparent via-[#1dff00]/30 to-transparent" />

        <Tooltip content={t`Zoom In`}>
          <Button 
            variant="ghost" 
            className="w-10 h-10 p-0 rounded-xl hover:bg-[#1dff00]/10 hover:text-[#1dff00] hover:scale-110 hover:shadow-[0_0_20px_rgba(29,255,0,0.15)] transition-all duration-200 group" 
            onClick={onZoomIn}
          >
            <MagnifyingGlassPlus className="w-5 h-5 group-hover:scale-125 transition-transform" />
          </Button>
        </Tooltip>

        <Tooltip content={t`Zoom Out`}>
          <Button 
            variant="ghost" 
            className="w-10 h-10 p-0 rounded-xl hover:bg-[#1dff00]/10 hover:text-[#1dff00] hover:scale-110 hover:shadow-[0_0_20px_rgba(29,255,0,0.15)] transition-all duration-200 group" 
            onClick={onZoomOut}
          >
            <MagnifyingGlassMinus className="w-5 h-5 group-hover:scale-75 transition-transform" />
          </Button>
        </Tooltip>

        <Tooltip content={t`Reset Zoom`}>
          <Button 
            variant="ghost" 
            className="w-10 h-10 p-0 rounded-xl hover:bg-[#1dff00]/10 hover:text-[#1dff00] hover:scale-110 hover:shadow-[0_0_20px_rgba(29,255,0,0.15)] transition-all duration-200 group" 
            onClick={onResetView}
          >
            <ClockClockwise className="w-5 h-5 group-hover:rotate-180 transition-transform duration-300" />
          </Button>
        </Tooltip>

        <Tooltip content={t`Center Artboard`}>
          <Button 
            variant="ghost" 
            className="w-10 h-10 p-0 rounded-xl hover:bg-[#1dff00]/10 hover:text-[#1dff00] hover:scale-110 hover:shadow-[0_0_20px_rgba(29,255,0,0.15)] transition-all duration-200 group" 
            onClick={onCenterView}
          >
            <CubeFocus className="w-5 h-5 group-hover:scale-110 transition-transform" />
          </Button>
        </Tooltip>

        <Separator className="h-8 mx-1 bg-gradient-to-b from-transparent via-[#1dff00]/30 to-transparent" />

        <Tooltip content={t`Toggle Page Break Line`}>
          <Toggle
            className={cn(
              "rounded-xl hover:bg-[#1dff00]/10 hover:scale-110 transition-all duration-200 group w-10 h-10 p-0",
              pageOptions.breakLine && "bg-gradient-to-br from-[#1dff00]/20 to-[#1dff00]/10 border border-[#1dff00]/50 text-[#1dff00] shadow-[0_0_25px_rgba(29,255,0,0.2)]"
            )}
            pressed={pageOptions.breakLine}
            onPressedChange={(pressed) => {
              setValue("metadata.page.options.breakLine", pressed);
            }}
          >
            <LineSegment className="w-5 h-5 group-hover:scale-110 transition-transform" />
          </Toggle>
        </Tooltip>

        <Tooltip content={t`Toggle Page Numbers`}>
          <Toggle
            className={cn(
              "rounded-xl hover:bg-[#1dff00]/10 hover:scale-110 transition-all duration-200 group w-10 h-10 p-0",
              pageOptions.pageNumbers && "bg-gradient-to-br from-[#1dff00]/20 to-[#1dff00]/10 border border-[#1dff00]/50 text-[#1dff00] shadow-[0_0_25px_rgba(29,255,0,0.2)]"
            )}
            pressed={pageOptions.pageNumbers}
            onPressedChange={(pressed) => {
              setValue("metadata.page.options.pageNumbers", pressed);
            }}
          >
            <Hash className="w-5 h-5 group-hover:scale-110 transition-transform" />
          </Toggle>
        </Tooltip>

        <Separator className="h-8 mx-1 bg-gradient-to-b from-transparent via-[#1dff00]/30 to-transparent" />

        <Tooltip content={t`Copy Link to Resume`}>
          <Button
            variant="ghost"
            className="w-10 h-10 p-0 rounded-xl hover:bg-[#1dff00]/10 hover:text-[#1dff00] hover:scale-110 hover:shadow-[0_0_20px_rgba(29,255,0,0.15)] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 group"
            disabled={!isPublic}
            onClick={onCopy}
          >
            <LinkSimple className="w-5 h-5 group-hover:scale-110 transition-transform" />
          </Button>
        </Tooltip>

        <Tooltip content={t`Download PDF`}>
          <Button
            variant="ghost"
            disabled={loading}
            className="w-10 h-10 p-0 rounded-xl hover:bg-gradient-to-br hover:from-[#1dff00]/20 hover:to-[#1dff00]/10 hover:text-[#1dff00] hover:border-[#1dff00]/50 hover:scale-110 hover:shadow-[0_0_30px_rgba(29,255,0,0.25)] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 border border-transparent group"
            onClick={onPrint}
          >
            {loading ? (
              <CircleNotch className="w-5 h-5 animate-spin text-[#1dff00]" />
            ) : (
              <FilePdf className="w-5 h-5 group-hover:scale-110 group-hover:translate-y-0.5 transition-transform" />
            )}
          </Button>
        </Tooltip>
      </div>
    </motion.div>
  );
};

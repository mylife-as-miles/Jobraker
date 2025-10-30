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
      <div className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-br from-[#0a0a0a]/98 to-[#0f0f0f]/98 backdrop-blur-xl border border-[#1dff00]/30 shadow-[0_0_50px_rgba(29,255,0,0.2)] px-2 py-2 gap-1 pointer-events-auto">
        <Tooltip content={t`Undo`}>
          <Button
            variant="ghost"
            className="rounded-xl h-10 w-10 p-0 hover:bg-gradient-to-br hover:from-[#1dff00]/15 hover:to-[#1dff00]/5 hover:border hover:border-[#1dff00]/30 hover:scale-110 transition-all duration-200 group"
            onClick={() => {
              undo();
            }}
          >
            <ArrowCounterClockwise className="group-hover:scale-110 group-hover:text-[#1dff00] transition-all" />
          </Button>
        </Tooltip>

        <Tooltip content={t`Redo`}>
          <Button
            variant="ghost"
            className="rounded-xl h-10 w-10 p-0 hover:bg-gradient-to-br hover:from-[#1dff00]/15 hover:to-[#1dff00]/5 hover:border hover:border-[#1dff00]/30 hover:scale-110 transition-all duration-200 group"
            onClick={() => {
              redo();
            }}
          >
            <ArrowClockwise className="group-hover:scale-110 group-hover:text-[#1dff00] transition-all" />
          </Button>
        </Tooltip>

  <Separator className="h-8 mx-1 bg-gradient-to-b from-transparent via-[#1dff00]/30 to-transparent" />

        <Tooltip content={panMode ? t`Scroll to Pan` : t`Scroll to Zoom`}>
          <Toggle 
            className="rounded-xl h-10 w-10 hover:bg-gradient-to-br hover:from-[#1dff00]/15 hover:to-[#1dff00]/5 data-[state=on]:bg-gradient-to-br data-[state=on]:from-[#1dff00]/20 data-[state=on]:to-[#1dff00]/10 data-[state=on]:border data-[state=on]:border-[#1dff00]/40 data-[state=on]:text-[#1dff00] hover:border hover:border-[#1dff00]/30 hover:scale-110 transition-all duration-200 group" 
            pressed={panMode} 
            onPressedChange={onTogglePanMode}
          >
            {panMode ? <ArrowsOutCardinal className="group-hover:scale-110 transition-transform" /> : <MagnifyingGlass className="group-hover:scale-110 transition-transform" />}
          </Toggle>
        </Tooltip>

  <Separator className="h-8 mx-1 bg-gradient-to-b from-transparent via-[#1dff00]/30 to-transparent" />

        <Tooltip content={t`Zoom In`}>
          <Button variant="ghost" className="rounded-xl h-10 w-10 p-0 hover:bg-gradient-to-br hover:from-[#1dff00]/15 hover:to-[#1dff00]/5 hover:border hover:border-[#1dff00]/30 hover:scale-110 transition-all duration-200 group" onClick={onZoomIn}>
            <MagnifyingGlassPlus className="group-hover:scale-110 group-hover:text-[#1dff00] transition-all" />
          </Button>
        </Tooltip>

        <Tooltip content={t`Zoom Out`}>
          <Button variant="ghost" className="rounded-xl h-10 w-10 p-0 hover:bg-gradient-to-br hover:from-[#1dff00]/15 hover:to-[#1dff00]/5 hover:border hover:border-[#1dff00]/30 hover:scale-110 transition-all duration-200 group" onClick={onZoomOut}>
            <MagnifyingGlassMinus className="group-hover:scale-110 group-hover:text-[#1dff00] transition-all" />
          </Button>
        </Tooltip>

        <Tooltip content={t`Reset Zoom`}>
          <Button variant="ghost" className="rounded-xl h-10 w-10 p-0 hover:bg-gradient-to-br hover:from-[#1dff00]/15 hover:to-[#1dff00]/5 hover:border hover:border-[#1dff00]/30 hover:scale-110 transition-all duration-200 group" onClick={onResetView}>
            <ClockClockwise className="group-hover:scale-110 group-hover:text-[#1dff00] transition-all" />
          </Button>
        </Tooltip>

        <Tooltip content={t`Center Artboard`}>
          <Button variant="ghost" className="rounded-xl h-10 w-10 p-0 hover:bg-gradient-to-br hover:from-[#1dff00]/15 hover:to-[#1dff00]/5 hover:border hover:border-[#1dff00]/30 hover:scale-110 transition-all duration-200 group" onClick={onCenterView}>
            <CubeFocus className="group-hover:scale-110 group-hover:text-[#1dff00] transition-all" />
          </Button>
        </Tooltip>

  <Separator className="h-8 mx-1 bg-gradient-to-b from-transparent via-[#1dff00]/30 to-transparent" />

        <Tooltip content={t`Toggle Page Break Line`}>
          <Toggle
            className="rounded-xl h-10 w-10 hover:bg-gradient-to-br hover:from-[#1dff00]/15 hover:to-[#1dff00]/5 data-[state=on]:bg-gradient-to-br data-[state=on]:from-[#1dff00]/20 data-[state=on]:to-[#1dff00]/10 data-[state=on]:border data-[state=on]:border-[#1dff00]/40 data-[state=on]:text-[#1dff00] hover:border hover:border-[#1dff00]/30 hover:scale-110 transition-all duration-200 group"
            pressed={pageOptions.breakLine}
            onPressedChange={(pressed) => {
              setValue("metadata.page.options.breakLine", pressed);
            }}
          >
            <LineSegment className="group-hover:scale-110 transition-transform" />
          </Toggle>
        </Tooltip>

        <Tooltip content={t`Toggle Page Numbers`}>
          <Toggle
            className="rounded-xl h-10 w-10 hover:bg-gradient-to-br hover:from-[#1dff00]/15 hover:to-[#1dff00]/5 data-[state=on]:bg-gradient-to-br data-[state=on]:from-[#1dff00]/20 data-[state=on]:to-[#1dff00]/10 data-[state=on]:border data-[state=on]:border-[#1dff00]/40 data-[state=on]:text-[#1dff00] hover:border hover:border-[#1dff00]/30 hover:scale-110 transition-all duration-200 group"
            pressed={pageOptions.pageNumbers}
            onPressedChange={(pressed) => {
              setValue("metadata.page.options.pageNumbers", pressed);
            }}
          >
            <Hash className="group-hover:scale-110 transition-transform" />
          </Toggle>
        </Tooltip>

  <Separator className="h-8 mx-1 bg-gradient-to-b from-transparent via-[#1dff00]/30 to-transparent" />

        <Tooltip content={t`Copy Link to Resume`}>
          <Button
            variant="ghost"
            className="rounded-xl h-10 w-10 p-0 hover:bg-gradient-to-br hover:from-[#1dff00]/15 hover:to-[#1dff00]/5 hover:border hover:border-[#1dff00]/30 hover:scale-110 disabled:opacity-40 disabled:hover:scale-100 transition-all duration-200 group"
            disabled={!isPublic}
            onClick={onCopy}
          >
            <LinkSimple className="group-hover:scale-110 group-hover:text-[#1dff00] transition-all" />
          </Button>
        </Tooltip>

        <Tooltip content={t`Download PDF`}>
          <Button
            variant="ghost"
            disabled={loading}
            className="rounded-xl h-10 w-10 p-0 hover:bg-gradient-to-br hover:from-[#1dff00]/15 hover:to-[#1dff00]/5 hover:border hover:border-[#1dff00]/30 hover:scale-110 disabled:opacity-40 disabled:hover:scale-100 transition-all duration-200 group"
            onClick={onPrint}
          >
            {loading ? <CircleNotch className="animate-spin text-[#1dff00]" /> : <FilePdf className="group-hover:scale-110 group-hover:text-[#1dff00] group-hover:translate-y-0.5 transition-all" />}
          </Button>
        </Tooltip>
      </div>
    </motion.div>
  );
};

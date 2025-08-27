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
    <motion.div className="fixed inset-x-0 bottom-0 mx-auto hidden py-6 text-center md:block">
      <div className="inline-flex items-center justify-center rounded-full bg-background px-4 shadow-xl">
        <Tooltip content={t`Undo`}>
          <Button
            size="icon"
            variant="ghost"
            className="rounded-none"
            onClick={() => {
              undo();
            }}
          >
            <ArrowCounterClockwise />
          </Button>
        </Tooltip>

        <Tooltip content={t`Redo`}>
          <Button
            size="icon"
            variant="ghost"
            className="rounded-none"
            onClick={() => {
              redo();
            }}
          >
            <ArrowClockwise />
          </Button>
        </Tooltip>

  <Separator className="h-9" />

        <Tooltip content={panMode ? t`Scroll to Pan` : t`Scroll to Zoom`}>
          <Toggle className="rounded-none" pressed={panMode} onPressedChange={onTogglePanMode}>
            {panMode ? <ArrowsOutCardinal /> : <MagnifyingGlass />}
          </Toggle>
        </Tooltip>

  <Separator className="h-9" />

        <Tooltip content={t`Zoom In`}>
          <Button size="icon" variant="ghost" className="rounded-none" onClick={onZoomIn}>
            <MagnifyingGlassPlus />
          </Button>
        </Tooltip>

        <Tooltip content={t`Zoom Out`}>
          <Button size="icon" variant="ghost" className="rounded-none" onClick={onZoomOut}>
            <MagnifyingGlassMinus />
          </Button>
        </Tooltip>

        <Tooltip content={t`Reset Zoom`}>
          <Button size="icon" variant="ghost" className="rounded-none" onClick={onResetView}>
            <ClockClockwise />
          </Button>
        </Tooltip>

        <Tooltip content={t`Center Artboard`}>
          <Button size="icon" variant="ghost" className="rounded-none" onClick={onCenterView}>
            <CubeFocus />
          </Button>
        </Tooltip>

  <Separator className="h-9" />

        <Tooltip content={t`Toggle Page Break Line`}>
          <Toggle
            className="rounded-none"
            pressed={pageOptions.breakLine}
            onPressedChange={(pressed) => {
              setValue("metadata.page.options.breakLine", pressed);
            }}
          >
            <LineSegment />
          </Toggle>
        </Tooltip>

        <Tooltip content={t`Toggle Page Numbers`}>
          <Toggle
            className="rounded-none"
            pressed={pageOptions.pageNumbers}
            onPressedChange={(pressed) => {
              setValue("metadata.page.options.pageNumbers", pressed);
            }}
          >
            <Hash />
          </Toggle>
        </Tooltip>

  <Separator className="h-9" />

        <Tooltip content={t`Copy Link to Resume`}>
          <Button
            size="icon"
            variant="ghost"
            className="rounded-none"
            disabled={!isPublic}
            onClick={onCopy}
          >
            <LinkSimple />
          </Button>
        </Tooltip>

        <Tooltip content={t`Download PDF`}>
          <Button
            size="icon"
            variant="ghost"
            disabled={loading}
            className="rounded-none"
            onClick={onPrint}
          >
            {loading ? <CircleNotch className="animate-spin" /> : <FilePdf />}
          </Button>
        </Tooltip>
      </div>
    </motion.div>
  );
};

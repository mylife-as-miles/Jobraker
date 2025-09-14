import type { SectionKey } from "@reactive-resume/schema";
import type { Template, PageFormat } from "@reactive-resume/utils";
import { pageSizeMap } from "@reactive-resume/utils";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactZoomPanPinchRef } from "react-zoom-pan-pinch";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";

import { Page } from "../components/page";
import { useArtboardStore } from "../store/artboard";
import { getTemplate } from "../templates";

export const BuilderLayout = () => {
  const [wheelPanning, setWheelPanning] = useState(true);

  const transformRef = useRef<ReactZoomPanPinchRef>(null);

  const MM_TO_PX = 3.78;

  const layout = useArtboardStore((state) => state.resume?.metadata?.layout);
  const format = useArtboardStore((state) => state.resume?.metadata?.page?.format as PageFormat);
  const template = useArtboardStore((state) => state.resume?.metadata?.template as Template);

  const Template = useMemo(() => (template ? getTemplate(template) : null), [template]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      if (detail.type === "ZOOM_IN") transformRef.current?.zoomIn(0.2);
      if (detail.type === "ZOOM_OUT") transformRef.current?.zoomOut(0.2);
      if (detail.type === "CENTER_VIEW") transformRef.current?.centerView();
      if (detail.type === "RESET_VIEW") {
        transformRef.current?.resetTransform(0);
        setTimeout(() => transformRef.current?.centerView(0.8, 0), 10);
      }
      if (detail.type === "TOGGLE_PAN_MODE") {
        setWheelPanning(!!detail.panMode);
      }
    };
    window.addEventListener("ARTBOARD_CMD", handler as EventListener);
    return () => window.removeEventListener("ARTBOARD_CMD", handler as EventListener);
  }, [transformRef]);

  if (!layout || !format || !Template) {
    return <div className="w-screen h-screen grid place-items-center text-white">Loading…</div>;
  }

  return (
    <TransformWrapper
      ref={transformRef}
      centerOnInit
      maxScale={2}
      minScale={0.4}
      initialScale={0.8}
      limitToBounds={false}
      wheel={{ wheelDisabled: wheelPanning }}
      panning={{ wheelPanning: wheelPanning }}
    >
      <TransformComponent
        wrapperClass="!w-screen !h-screen"
        contentClass="grid items-start justify-center space-x-12 pointer-events-none"
        contentStyle={{
          width: `${layout.length * (pageSizeMap[format!].width * MM_TO_PX + 42)}px`,
          gridTemplateColumns: `repeat(${layout.length}, 1fr)`,
        }}
      >
        <AnimatePresence>
          {layout.map((columns: any, pageIndex: number) => (
            <motion.div
              key={pageIndex}
              layout
              initial={{ opacity: 0, x: -200, y: 0 }}
              animate={{ opacity: 1, x: 0, transition: { delay: pageIndex * 0.3 } }}
              exit={{ opacity: 0, x: -200 }}
            >
              <Page mode="builder" pageNumber={pageIndex + 1}>
                <Template isFirstPage={pageIndex === 0} columns={columns as SectionKey[][]} />
              </Page>
            </motion.div>
          ))}
        </AnimatePresence>
      </TransformComponent>
    </TransformWrapper>
  );
};

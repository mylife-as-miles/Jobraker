import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { TransformComponent, TransformWrapper, ReactZoomPanPinchRef } from "react-zoom-pan-pinch";
import webfontloader from "webfontloader";
import { pageSizeMap, Template, PageFormat } from "@reactive-resume/utils";
import { SectionKey } from "@reactive-resume/schema";

import { useArtboardStore } from "@/store/artboard";
import { getTemplate } from "@/templates";
import { Page } from "@/components/page";

export const EmbeddedBuilderCanvas = () => {
    const transformRef = useRef<ReactZoomPanPinchRef>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [wheelPanning, setWheelPanning] = useState(true);

    const resume = useArtboardStore((state) => state.resume);
    const layout = resume?.metadata?.layout;
    const format = resume?.metadata?.page?.format as PageFormat;
    const template = resume?.metadata?.template as Template;
    const metadata = resume?.metadata;

    const MM_TO_PX = 3.78;

    const TemplateComponent = useMemo(() => (template ? getTemplate(template) : null), [template]);

    // Handle Artboard Commands (Zoom/Pan) - dispatched from toolbar
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
    }, []);

    // Load Fonts
    const fontString = useMemo(() => {
        if (!metadata?.typography?.font) return "Inter:regular:latin";
        const family = metadata.typography.font.family || "Inter";
        const variants = metadata.typography.font.variants?.join(",") || "regular";
        const subset = metadata.typography.font.subset || "latin";
        return `${family}:${variants}:${subset}`;
    }, [metadata?.typography?.font]);

    useEffect(() => {
        webfontloader.load({
            google: { families: [fontString] },
            active: () => {
                // Font loaded
            },
        });
    }, [fontString]);

    // Apply CSS Variables to Container
    useEffect(() => {
        if (!metadata || !containerRef.current) return;

        const fontSize = metadata.typography?.font?.size || 16;
        const lineHeight = metadata.typography?.lineHeight || 1.5;
        const margin = metadata.page?.margin || 20;
        const textColor = metadata.theme?.text || "#000000";
        const primaryColor = metadata.theme?.primary || "#000000";
        const bgColor = metadata.theme?.background || "#ffffff";

        const style = containerRef.current.style;
        style.setProperty("--font-size", `${fontSize}px`);
        style.setProperty("--line-height", `${lineHeight}`);
        style.setProperty("--margin", `${margin}px`);
        style.setProperty("--color-foreground", textColor);
        style.setProperty("--color-primary", primaryColor);
        style.setProperty("--color-background", bgColor);

        // Also set font-size on the container so rem units work locally if needed
        style.fontSize = `${fontSize}px`;
        style.lineHeight = `${lineHeight}`;

    }, [metadata]);

    // Handle Typography Options (hide icons, underline links)
    useEffect(() => {
        if (!metadata?.typography || !containerRef.current) return;

        // We scope this to our container to avoid global pollution
        const elements = Array.from(containerRef.current.querySelectorAll(`[data-page]`));
        for (const el of elements) {
            el.classList.toggle("hide-icons", metadata.typography.hideIcons || false);
            el.classList.toggle("underline-links", metadata.typography.underlineLinks || false);
        }
    }, [metadata]);

    // Get page dimensions with fallback (A4 default: 210mm x 297mm)
    const pageSize = format && pageSizeMap ? pageSizeMap[format] : null;
    const pageWidth = pageSize?.width ?? 210;

    if (!layout || !Array.isArray(layout) || !format || !TemplateComponent || !pageSize) {
        return <div className="grid place-items-center h-full text-white/50">Loading Preview...</div>;
    }

    return (
        <div ref={containerRef} className="w-full h-full bg-[#1a1a1a] relative overflow-hidden resume-params-layer">
            {/* Custom CSS Injection */}
            {metadata?.css?.visible && metadata?.css?.value && (
                <style>{metadata.css.value}</style>
            )}

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
                    wrapperClass="!w-full !h-full"
                    contentClass="grid items-start justify-center space-x-12 pointer-events-none"
                    contentStyle={{
                        width: `${layout.length * (pageWidth * MM_TO_PX + 42)}px`,
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
                                    <TemplateComponent isFirstPage={pageIndex === 0} columns={columns as SectionKey[][]} />
                                </Page>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </TransformComponent>
            </TransformWrapper>
        </div>
    );
};

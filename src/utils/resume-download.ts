import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ResumeData } from "../store/artboard";
import { ResumeTemplateRenderer } from "../templates/render-resume-template";

// A4 at 96dpi — the exact size the on-screen preview is rendered at.
const A4_WIDTH_PX = 794;
const A4_MIN_HEIGHT_PX = 1123;

/**
 * Copy the app's stylesheets / font links into the print frame so the resume
 * renders with the exact same styles it has on screen. Returns promises that
 * resolve once external stylesheets have loaded.
 */
function cloneHeadStyles(source: Document, target: Document): Promise<void>[] {
  const waits: Promise<void>[] = [];
  const nodes = source.querySelectorAll(
    'style, link[rel="stylesheet"], link[rel="preconnect"], link[href*="fonts.googleapis"], link[href*="fonts.gstatic"]',
  );
  nodes.forEach((node) => {
    const clone = node.cloneNode(true) as HTMLElement;
    target.head.appendChild(clone);
    if (
      clone.tagName === "LINK" &&
      (clone as HTMLLinkElement).rel === "stylesheet"
    ) {
      waits.push(
        new Promise<void>((resolve) => {
          clone.addEventListener("load", () => resolve(), { once: true });
          clone.addEventListener("error", () => resolve(), { once: true });
          window.setTimeout(resolve, 3000);
        }),
      );
    }
  });
  return waits;
}

function waitForImages(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll("img"));
  return Promise.all(
    images.map((img) =>
      img.complete && img.naturalWidth > 0
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            img.addEventListener("load", () => resolve(), { once: true });
            img.addEventListener("error", () => resolve(), { once: true });
            window.setTimeout(resolve, 3000);
          }),
    ),
  ).then(() => undefined);
}

/**
 * Export a resume to PDF exactly as it appears in the preview.
 *
 * Renders the template at true A4 size into an isolated, off-screen iframe and
 * invokes the browser's native print engine. Unlike a canvas rasteriser, this
 * reproduces gradients, filters, shadows, rotated text and SVG faithfully, and
 * paginates naturally. The user picks "Save as PDF" in the print dialog.
 */
export const downloadResumePDF = async (resumeData: ResumeData) => {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.title = "Resume print frame";
  iframe.style.cssText = [
    "position:fixed",
    "left:-10000px",
    "top:0",
    `width:${A4_WIDTH_PX}px`,
    `height:${A4_MIN_HEIGHT_PX}px`,
    "border:0",
    "opacity:0",
    "pointer-events:none",
  ].join(";");
  document.body.appendChild(iframe);

  let root: Root | null = null;
  const cleanup = () => {
    try {
      root?.unmount();
    } catch {
      /* noop */
    }
    try {
      iframe.remove();
    } catch {
      /* noop */
    }
  };

  try {
    const doc = iframe.contentDocument;
    const win = iframe.contentWindow;
    if (!doc || !win) throw new Error("The print frame could not be created.");

    doc.open();
    doc.write(
      '<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>',
    );
    doc.close();

    doc.documentElement.className = document.documentElement.className;
    doc.body.className = document.body.className;

    const baseStyle = doc.createElement("style");
    baseStyle.textContent = `
      @page { size: A4 portrait; margin: 0; }
      html, body { margin: 0; padding: 0; background: #ffffff; }
      *, *::before, *::after {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      #print-root { width: ${A4_WIDTH_PX}px; min-height: ${A4_MIN_HEIGHT_PX}px; }
    `;
    doc.head.appendChild(baseStyle);

    const styleWaits = cloneHeadStyles(document, doc);

    const mount = doc.createElement("div");
    mount.id = "print-root";
    doc.body.appendChild(mount);

    root = createRoot(mount);
    root.render(
      createElement(ResumeTemplateRenderer, {
        templateId: resumeData.metadata.template,
        resumeDataOverride: resumeData,
      }),
    );

    // Let styles, the React commit, fonts and images settle before printing.
    await Promise.all(styleWaits);
    await new Promise((resolve) => window.setTimeout(resolve, 80));
    try {
      await (doc as Document & { fonts?: FontFaceSet }).fonts?.ready;
    } catch {
      /* fonts API unavailable */
    }
    await waitForImages(mount);
    await new Promise((resolve) => window.setTimeout(resolve, 150));

    // Clean up after the print dialog is dismissed (or a safety timeout).
    win.addEventListener(
      "afterprint",
      () => window.setTimeout(cleanup, 300),
      { once: true },
    );
    window.setTimeout(cleanup, 60000);

    win.focus();
    win.print();
  } catch (error) {
    cleanup();
    console.error("PDF generation failed:", error);
    throw error;
  }
};

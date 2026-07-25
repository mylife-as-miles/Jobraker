import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ResumeData } from "../store/artboard";
import { ResumeTemplateRenderer } from "../templates/render-resume-template";

// A4 at 96dpi — the exact size the on-screen preview is rendered at.
const A4_WIDTH_PX = 794;
const A4_HEIGHT_PX = 1123;

/**
 * Reproduce the app's styles inside the print frame.
 *
 * Same-origin stylesheets are inlined as already-parsed CSS text rather than
 * re-linked: a cloned <link> has to be re-fetched and re-parsed by the frame,
 * which can lose the race against print() (and leaves the resume completely
 * unstyled when it does). Cross-origin sheets — Google Fonts — cannot be read,
 * so those keep the <link> clone and are awaited.
 */
function injectStyles(source: Document, target: Document): Promise<void>[] {
  const waits: Promise<void>[] = [];

  // Keeps relative url() references (fonts, background images) resolvable.
  const base = target.createElement("base");
  base.href = source.baseURI;
  target.head.appendChild(base);

  const cssChunks: string[] = [];

  Array.from(source.styleSheets).forEach((sheet) => {
    let rules: CSSRuleList | null = null;
    try {
      rules = (sheet as CSSStyleSheet).cssRules;
    } catch {
      rules = null; // cross-origin — not readable
    }

    if (rules) {
      cssChunks.push(
        Array.from(rules)
          .map((rule) => rule.cssText)
          .join("\n"),
      );
      return;
    }

    const owner = sheet.ownerNode as HTMLElement | null;
    if (owner && owner.tagName === "LINK") {
      const clone = owner.cloneNode(true) as HTMLLinkElement;
      target.head.appendChild(clone);
      waits.push(
        new Promise<void>((resolve) => {
          clone.addEventListener("load", () => resolve(), { once: true });
          clone.addEventListener("error", () => resolve(), { once: true });
          window.setTimeout(resolve, 3000);
        }),
      );
    }
  });

  // Preconnect hints help the cross-origin font links above resolve quickly.
  source
    .querySelectorAll('link[rel="preconnect"]')
    .forEach((node) => target.head.appendChild(node.cloneNode(true)));

  const style = target.createElement("style");
  style.textContent = cssChunks.join("\n");
  target.head.appendChild(style);

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

export interface ResumePrintFrame {
  iframe: HTMLIFrameElement;
  win: Window;
  cleanup: () => void;
}

/**
 * Render a resume at true A4 size into an isolated, off-screen iframe that
 * carries the app's stylesheets, so it looks byte-for-byte like the preview.
 *
 * Exported separately from {@link downloadResumePDF} so the rendering can be
 * exercised without opening a print dialog.
 */
export async function renderResumePrintFrame(
  resumeData: ResumeData,
): Promise<ResumePrintFrame> {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.title = "Resume print frame";
  iframe.style.cssText = [
    "position:fixed",
    "left:-10000px",
    "top:0",
    `width:${A4_WIDTH_PX}px`,
    `height:${A4_HEIGHT_PX}px`,
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

    // The print dialog seeds the "Save as PDF" filename from the title.
    doc.title = `${(resumeData.basics.name || "Resume").replace(/\s+/g, "_")}_Resume`;

    const styleWaits = injectStyles(document, doc);

    // Appended AFTER the app's stylesheets so these rules win the cascade —
    // otherwise the app's dark `body { background }` bleeds into the page.
    const baseStyle = doc.createElement("style");
    baseStyle.textContent = `
      @page { size: A4 portrait; margin: 0; }
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
      }
      *, *::before, *::after {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      /* A definite height (not just min-height) so the templates' h-full /
         flex-1 rules resolve exactly as they do in the fixed-size on-screen
         preview. The renderer wraps each template in a shell div, so both
         levels need it. */
      #print-root,
      #print-root > *,
      #print-root > * > * {
        width: ${A4_WIDTH_PX}px;
        height: ${A4_HEIGHT_PX}px;
      }
    `;
    doc.head.appendChild(baseStyle);

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

    return { iframe, win, cleanup };
  } catch (error) {
    cleanup();
    throw error;
  }
}

/**
 * Export a resume to PDF exactly as it appears in the preview.
 *
 * Uses the browser's native print engine rather than a canvas rasteriser, so
 * gradients, filters, shadows, rotated text and SVG reproduce faithfully — and
 * the resulting PDF contains real, selectable text (which ATS systems can
 * parse) instead of a flat image. The user picks "Save as PDF" in the dialog.
 */
export const downloadResumePDF = async (resumeData: ResumeData) => {
  try {
    const { win, cleanup } = await renderResumePrintFrame(resumeData);

    // Clean up after the print dialog is dismissed (or a safety timeout).
    win.addEventListener("afterprint", () => window.setTimeout(cleanup, 300), {
      once: true,
    });
    window.setTimeout(cleanup, 60000);

    win.focus();
    win.print();
  } catch (error) {
    console.error("PDF generation failed:", error);
    throw error;
  }
};

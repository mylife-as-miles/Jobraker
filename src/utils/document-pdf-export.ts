import { jsPDF } from "jspdf";

export interface DocumentPdfOptions {
  title?: string;
  subtitle?: string;
  candidateName?: string;
  candidateEmail?: string;
  candidateRole?: string;
  theme?: "emerald" | "slate" | "classic";
  fitToOnePage?: boolean;
  filename?: string;
}

interface ThemeConfig {
  accent: [number, number, number];
  accentDark: [number, number, number];
  accentLight: [number, number, number];
  borderAccent: [number, number, number];
  textPrimary: [number, number, number];
  textSecondary: [number, number, number];
  textMuted: [number, number, number];
  divider: [number, number, number];
  cardBg: [number, number, number];
}

const THEMES: Record<"emerald" | "slate" | "classic", ThemeConfig> = {
  emerald: {
    accent: [16, 185, 129], // #10b981
    accentDark: [4, 120, 87], // #047857
    accentLight: [240, 253, 244], // #f0fdf4
    borderAccent: [167, 243, 208], // #a7f3d0
    textPrimary: [15, 23, 42], // #0f172a
    textSecondary: [51, 65, 85], // #334155
    textMuted: [148, 163, 184], // #94a3b8
    divider: [226, 232, 240], // #e2e8f0
    cardBg: [248, 250, 252], // #f8fafc
  },
  slate: {
    accent: [2, 132, 199], // #0284c7
    accentDark: [3, 105, 161], // #0369a1
    accentLight: [240, 249, 255], // #f0f9ff
    borderAccent: [186, 230, 253], // #bae6fd
    textPrimary: [15, 23, 42],
    textSecondary: [51, 65, 85],
    textMuted: [148, 163, 184],
    divider: [226, 232, 240],
    cardBg: [248, 250, 252],
  },
  classic: {
    accent: [15, 23, 42], // #0f172a
    accentDark: [51, 65, 85],
    accentLight: [248, 250, 252],
    borderAccent: [203, 213, 225],
    textPrimary: [15, 23, 42],
    textSecondary: [51, 65, 85],
    textMuted: [148, 163, 184],
    divider: [226, 232, 240],
    cardBg: [248, 250, 252],
  },
};

type BlockType =
  | "h1"
  | "h2"
  | "h3"
  | "paragraph"
  | "bullet"
  | "numbered"
  | "blockquote"
  | "hr"
  | "table";

interface DocBlock {
  type: BlockType;
  text: string;
  items?: string[];
  tableData?: { headers: string[]; rows: string[][] };
}

/**
 * Strips raw markdown syntax for clean text rendering in vector PDF,
 * retaining words and essential punctuation.
 */
export function cleanMarkdownText(raw: string): string {
  if (!raw) return "";
  return raw
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1") // [text](url) -> text
    .replace(/\*\*([^*]+)\*\*/g, "$1") // **bold** -> bold
    .replace(/__([^_]+)__/g, "$1") // __bold__ -> bold
    .replace(/\*([^*]+)\*/g, "$1") // *italic* -> italic
    .replace(/_([^_]+)_/g, "$1") // _italic_ -> italic
    .replace(/`([^`]+)`/g, "$1") // `code` -> code
    .replace(/~~([^~]+)~~/g, "$1") // ~~strikethrough~~ -> strikethrough
    .replace(/<[^>]+>/g, "") // strip html tags
    .trim();
}

/**
 * Parses markdown into structured blocks for PDF document layout.
 */
export function parseMarkdownToDocBlocks(markdown: string): {
  title: string | null;
  subtitle: string | null;
  blocks: DocBlock[];
} {
  const lines = markdown.split(/\r?\n/);
  const blocks: DocBlock[] = [];
  let title: string | null = null;
  let subtitle: string | null = null;

  let currentParagraphLines: string[] = [];
  let currentListItems: string[] = [];
  let currentListType: "bullet" | "numbered" | null = null;
  let inBlockquote = false;
  let currentBlockquoteLines: string[] = [];

  let inTable = false;
  let tableHeaders: string[] = [];
  let tableRows: string[][] = [];

  const flushParagraph = () => {
    if (currentParagraphLines.length > 0) {
      const rawText = currentParagraphLines.join(" ").trim();
      const text = cleanMarkdownText(rawText);
      if (text) {
        if (
          title &&
          !subtitle &&
          blocks.length === 0 &&
          ((rawText.startsWith("*") && rawText.endsWith("*")) ||
            (rawText.startsWith("_") && rawText.endsWith("_")))
        ) {
          subtitle = text;
        } else {
          blocks.push({ type: "paragraph", text });
        }
      }
      currentParagraphLines = [];
    }
  };

  const flushList = () => {
    if (currentListItems.length > 0 && currentListType) {
      blocks.push({
        type: currentListType,
        text: "",
        items: [...currentListItems],
      });
      currentListItems = [];
      currentListType = null;
    }
  };

  const flushBlockquote = () => {
    if (currentBlockquoteLines.length > 0) {
      blocks.push({
        type: "blockquote",
        text: currentBlockquoteLines.join(" ").trim(),
      });
      currentBlockquoteLines = [];
      inBlockquote = false;
    }
  };

  const flushTable = () => {
    if (inTable && tableHeaders.length > 0) {
      blocks.push({
        type: "table",
        text: "",
        tableData: {
          headers: [...tableHeaders],
          rows: [...tableRows],
        },
      });
      tableHeaders = [];
      tableRows = [];
      inTable = false;
    }
  };

  const flushAll = () => {
    flushParagraph();
    flushList();
    flushBlockquote();
    flushTable();
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      flushAll();
      continue;
    }

    // Horizontal rule
    if (/^(---|___|\*\*\*)$/.test(trimmed)) {
      flushAll();
      blocks.push({ type: "hr", text: "" });
      continue;
    }

    // Table row detection
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      flushParagraph();
      flushList();
      flushBlockquote();

      const cells = trimmed
        .slice(1, -1)
        .split("|")
        .map((c) => cleanMarkdownText(c.trim()));

      if (cells.every((c) => /^:?-+:?$/.test(c))) {
        inTable = true;
        continue;
      }

      if (!inTable && tableHeaders.length === 0) {
        tableHeaders = cells;
      } else {
        tableRows.push(cells);
        inTable = true;
      }
      continue;
    } else if (inTable) {
      flushTable();
    }

    // Blockquote
    if (trimmed.startsWith(">")) {
      flushParagraph();
      flushList();
      const quoteText = cleanMarkdownText(trimmed.replace(/^>\s?/, ""));
      currentBlockquoteLines.push(quoteText);
      inBlockquote = true;
      continue;
    } else if (inBlockquote) {
      flushBlockquote();
    }

    // Headings
    if (trimmed.startsWith("# ")) {
      flushAll();
      const heading = cleanMarkdownText(trimmed.slice(2));
      if (!title) {
        title = heading;
      } else {
        blocks.push({ type: "h1", text: heading });
      }
      continue;
    }

    if (trimmed.startsWith("## ")) {
      flushAll();
      blocks.push({ type: "h2", text: cleanMarkdownText(trimmed.slice(3)) });
      continue;
    }

    if (trimmed.startsWith("### ") || trimmed.startsWith("#### ")) {
      flushAll();
      const text = cleanMarkdownText(trimmed.replace(/^#{3,4}\s/, ""));
      blocks.push({ type: "h3", text });
      continue;
    }

    // Bullet lists (- or * or •)
    const bulletMatch = trimmed.match(/^[-*•]\s+(.*)$/);
    if (bulletMatch) {
      flushParagraph();
      flushBlockquote();
      if (currentListType && currentListType !== "bullet") flushList();
      currentListType = "bullet";
      currentListItems.push(cleanMarkdownText(bulletMatch[1]));
      continue;
    }

    // Numbered lists (1. or 1))
    const numberedMatch = trimmed.match(/^\d+[.)]\s+(.*)$/);
    if (numberedMatch) {
      flushParagraph();
      flushBlockquote();
      if (currentListType && currentListType !== "numbered") flushList();
      currentListType = "numbered";
      currentListItems.push(cleanMarkdownText(numberedMatch[1]));
      continue;
    }

    // Regular paragraph line
    if (currentListType) flushList();
    currentParagraphLines.push(trimmed);
  }

  flushAll();

  // If title was not an H1, infer from the first H2 or first bold sentence
  if (!title && blocks.length > 0) {
    const firstH2 = blocks.find((b) => b.type === "h2");
    if (firstH2) {
      title = firstH2.text;
      const idx = blocks.indexOf(firstH2);
      blocks.splice(idx, 1);
    }
  }

  return { title, subtitle, blocks };
}

/**
 * Creates a beautifully styled, print-ready jsPDF document from markdown.
 */
export function createDocumentPdf(
  markdown: string,
  options: DocumentPdfOptions = {},
): jsPDF {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4",
  });

  const themeKey = options.theme || "emerald";
  const theme = THEMES[themeKey] || THEMES.emerald;

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const marginX = 48; // 48pt
  const marginTop = 52;
  const marginBottom = 50;
  const contentWidth = pageWidth - marginX * 2;

  const { title: parsedTitle, subtitle: parsedSubtitle, blocks } =
    parseMarkdownToDocBlocks(markdown);

  const docTitle = options.title || parsedTitle || "Executive Strategy Summary";
  const docSubtitle =
    options.subtitle ||
    parsedSubtitle ||
    "Prepared for Technical & Executive Interview • JobRaker Systems Brief";

  const fitToOnePage = options.fitToOnePage ?? true;

  // Scale factor if 1-page fit is requested and block count is moderate
  let fontScale = 1.0;
  let lineSpacingFactor = 1.45;
  let blockMargin = 10;

  // Estimate total content density to auto-fit
  const totalItemCount = blocks.reduce(
    (acc, b) => acc + (b.items ? b.items.length : 1),
    0,
  );
  if (fitToOnePage && totalItemCount > 14) {
    fontScale = Math.max(0.85, 1 - (totalItemCount - 14) * 0.012);
    lineSpacingFactor = Math.max(1.25, 1.45 - (totalItemCount - 14) * 0.01);
    blockMargin = Math.max(6, 10 - (totalItemCount - 14) * 0.25);
  }

  let currentPage = 1;
  let cursorY = marginTop;

  // Helper: Draw running header on page
  const drawPageHeader = (isFirstPage: boolean) => {
    // Top colored brand accent line across full width
    doc.setFillColor(...theme.accent);
    doc.rect(0, 0, pageWidth, 4, "F");

    if (!isFirstPage) {
      // Subtle top header on subsequent pages
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...theme.textMuted);
      doc.text(docTitle, marginX, 32);

      const dateStr = new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      doc.text(dateStr, pageWidth - marginX, 32, { align: "right" });

      doc.setDrawColor(...theme.divider);
      doc.setLineWidth(0.5);
      doc.line(marginX, 38, pageWidth - marginX, 38);
    }
  };

  // Helper: Draw running footer on page
  const drawPageFooter = (pageNum: number, totalPages: number) => {
    const footerY = pageHeight - 26;
    doc.setDrawColor(...theme.divider);
    doc.setLineWidth(0.5);
    doc.line(marginX, footerY - 8, pageWidth - marginX, footerY - 8);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...theme.textMuted);

    // Left: confidential & source tag
    doc.text("JobRaker Executive Document • Confidential", marginX, footerY);

    // Right: Page number
    const pageText = `Page ${pageNum} of ${totalPages}`;
    doc.text(pageText, pageWidth - marginX, footerY, { align: "right" });
  };

  const ensureSpace = (neededHeight: number) => {
    if (cursorY + neededHeight > pageHeight - marginBottom) {
      if (!fitToOnePage || cursorY > pageHeight - 15) {
        doc.addPage();
        currentPage++;
        cursorY = marginTop;
        drawPageHeader(false);
      }
    }
  };

  // 1. Initial Page 1 Header Setup
  drawPageHeader(true);

  // 2. Render Document Header Banner
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18 * fontScale);
  doc.setTextColor(...theme.textPrimary);
  const titleLines = doc.splitTextToSize(docTitle, contentWidth);
  doc.text(titleLines, marginX, cursorY + 14 * fontScale);
  cursorY += titleLines.length * (20 * fontScale) + 4;

  // Subtitle / Context
  if (docSubtitle) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9.5 * fontScale);
    doc.setTextColor(...theme.textSecondary);
    const subLines = doc.splitTextToSize(docSubtitle, contentWidth);
    doc.text(subLines, marginX, cursorY + 8 * fontScale);
    cursorY += subLines.length * (13 * fontScale) + 6;
  }

  // Candidate Metadata Bar (if candidate name, role or date available)
  const candidateParts = [
    options.candidateName,
    options.candidateRole,
    options.candidateEmail,
    new Date().toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
  ].filter(Boolean);

  if (candidateParts.length > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5 * fontScale);
    doc.setTextColor(...theme.textMuted);
    const metaStr = candidateParts.join("  •  ");
    doc.text(metaStr, marginX, cursorY + 6 * fontScale);
    cursorY += 14 * fontScale;
  }

  // Header bottom dividing accent bar
  doc.setDrawColor(...theme.accent);
  doc.setLineWidth(1.5);
  doc.line(marginX, cursorY + 2, marginX + 60, cursorY + 2);

  doc.setDrawColor(...theme.divider);
  doc.setLineWidth(0.5);
  doc.line(marginX + 60, cursorY + 2, pageWidth - marginX, cursorY + 2);
  cursorY += blockMargin + 8;

  // 3. Render Document Blocks
  for (const block of blocks) {
    switch (block.type) {
      case "h1":
      case "h2": {
        const fontSize = (block.type === "h1" ? 13 : 11.5) * fontScale;
        const headingSpacing = (block.type === "h1" ? 18 : 15) * fontScale;
        ensureSpace(headingSpacing + 20);

        cursorY += blockMargin;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(fontSize);
        doc.setTextColor(...theme.textPrimary);

        const hLines = doc.splitTextToSize(block.text, contentWidth);
        doc.text(hLines, marginX, cursorY);
        cursorY += hLines.length * (fontSize * 1.25);

        // Section accent line
        doc.setDrawColor(...theme.accent);
        doc.setLineWidth(1);
        doc.line(marginX, cursorY + 2, marginX + 28, cursorY + 2);

        doc.setDrawColor(...theme.divider);
        doc.setLineWidth(0.5);
        doc.line(marginX + 28, cursorY + 2, pageWidth - marginX, cursorY + 2);

        cursorY += 8 * fontScale;
        break;
      }

      case "h3": {
        const fontSize = 10 * fontScale;
        ensureSpace(fontSize * 2 + 10);
        cursorY += 4;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(fontSize);
        doc.setTextColor(...theme.accentDark);

        const subLines = doc.splitTextToSize(block.text, contentWidth);
        doc.text(subLines, marginX, cursorY);
        cursorY += subLines.length * (fontSize * 1.3) + 4;
        break;
      }

      case "paragraph": {
        const fontSize = 9 * fontScale;
        const lineHeight = fontSize * lineSpacingFactor;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(fontSize);
        doc.setTextColor(...theme.textSecondary);

        const pLines = doc.splitTextToSize(block.text, contentWidth);
        const needed = pLines.length * lineHeight;
        ensureSpace(needed + 4);

        doc.text(pLines, marginX, cursorY);
        cursorY += needed + blockMargin * 0.7;
        break;
      }

      case "bullet":
      case "numbered": {
        const items = block.items || [];
        const fontSize = 8.8 * fontScale;
        const lineHeight = fontSize * lineSpacingFactor;
        const indentX = 14;
        const itemWidth = contentWidth - indentX;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(fontSize);

        for (let idx = 0; idx < items.length; idx++) {
          const itemText = items[idx];
          const lines = doc.splitTextToSize(itemText, itemWidth);
          const itemHeight = lines.length * lineHeight;
          ensureSpace(itemHeight + 4);

          // Draw custom bullet or number
          if (block.type === "bullet") {
            doc.setFillColor(...theme.accent);
            doc.circle(marginX + 4, cursorY - 2.5, 1.8, "F");
          } else {
            doc.setFont("helvetica", "bold");
            doc.setTextColor(...theme.accentDark);
            doc.text(`${idx + 1}.`, marginX, cursorY);
            doc.setFont("helvetica", "normal");
          }

          doc.setTextColor(...theme.textSecondary);
          doc.text(lines, marginX + indentX, cursorY);
          cursorY += itemHeight + 3.5 * fontScale;
        }
        cursorY += blockMargin * 0.5;
        break;
      }

      case "blockquote": {
        const fontSize = 8.8 * fontScale;
        const lineHeight = fontSize * lineSpacingFactor;
        const quoteWidth = contentWidth - 28;

        doc.setFont("helvetica", "italic");
        doc.setFontSize(fontSize);
        const qLines = doc.splitTextToSize(block.text, quoteWidth);
        const boxHeight = qLines.length * lineHeight + 14;

        ensureSpace(boxHeight + 8);

        // Callout box background
        doc.setFillColor(...theme.accentLight);
        doc.roundedRect(marginX, cursorY - 4, contentWidth, boxHeight, 3, 3, "F");

        // Left vertical highlight border
        doc.setFillColor(...theme.accent);
        doc.rect(marginX, cursorY - 4, 3.5, boxHeight, "F");

        // Text inside quote box
        doc.setTextColor(...theme.textPrimary);
        doc.text(qLines, marginX + 16, cursorY + 8);

        cursorY += boxHeight + blockMargin * 0.6;
        break;
      }

      case "table": {
        if (!block.tableData || block.tableData.headers.length === 0) break;
        const headers = block.tableData.headers;
        const rows = block.tableData.rows;
        const colCount = headers.length;
        const colWidth = contentWidth / colCount;
        const rowHeight = 16 * fontScale;
        const totalTableHeight = (rows.length + 1) * rowHeight + 10;

        ensureSpace(totalTableHeight);

        // Table Header background
        doc.setFillColor(...theme.accentLight);
        doc.rect(marginX, cursorY, contentWidth, rowHeight, "F");
        doc.setDrawColor(...theme.borderAccent);
        doc.setLineWidth(0.5);
        doc.rect(marginX, cursorY, contentWidth, rowHeight, "S");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8 * fontScale);
        doc.setTextColor(...theme.accentDark);

        headers.forEach((h, colIdx) => {
          const cellX = marginX + colIdx * colWidth + 6;
          doc.text(h, cellX, cursorY + rowHeight * 0.65);
        });

        cursorY += rowHeight;

        // Table Rows
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.8 * fontScale);
        doc.setTextColor(...theme.textSecondary);

        rows.forEach((r, rowIdx) => {
          if (rowIdx % 2 === 1) {
            doc.setFillColor(...theme.cardBg);
            doc.rect(marginX, cursorY, contentWidth, rowHeight, "F");
          }
          doc.setDrawColor(...theme.divider);
          doc.setLineWidth(0.5);
          doc.rect(marginX, cursorY, contentWidth, rowHeight, "S");

          r.forEach((cellText, colIdx) => {
            const cellX = marginX + colIdx * colWidth + 6;
            const truncated = doc.splitTextToSize(cellText, colWidth - 10)[0] || "";
            doc.text(truncated, cellX, cursorY + rowHeight * 0.65);
          });
          cursorY += rowHeight;
        });

        cursorY += blockMargin;
        break;
      }

      case "hr": {
        ensureSpace(12);
        cursorY += 6;
        doc.setDrawColor(...theme.divider);
        doc.setLineWidth(0.5);
        doc.line(marginX, cursorY, pageWidth - marginX, cursorY);
        cursorY += 8;
        break;
      }
    }
  }

  // 4. Draw footers on all pages
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawPageFooter(p, totalPages);
  }

  return doc;
}

/**
 * Downloads a generated PDF document directly in the user's browser.
 */
export async function exportDocumentAsPdf(
  markdown: string,
  options: DocumentPdfOptions = {},
): Promise<{ success: boolean; filename: string }> {
  try {
    const doc = createDocumentPdf(markdown, options);
    const rawTitle =
      options.title ||
      parseMarkdownToDocBlocks(markdown).title ||
      "Systems_Strategy_Summary";
    const sanitizedTitle = rawTitle
      .replace(/[^a-zA-Z0-9_\-\s]/g, "")
      .trim()
      .replace(/\s+/g, "_");
    const filename = options.filename || `${sanitizedTitle}.pdf`;

    doc.save(filename);
    return { success: true, filename };
  } catch (error) {
    console.error("Failed to export document as PDF:", error);
    throw error;
  }
}

/**
 * Generates a PDF Blob for previewing or embedding.
 */
export function generateDocumentPdfBlob(
  markdown: string,
  options: DocumentPdfOptions = {},
): { blob: Blob; filename: string; pageCount: number } {
  const doc = createDocumentPdf(markdown, options);
  const rawTitle =
    options.title ||
    parseMarkdownToDocBlocks(markdown).title ||
    "Executive_Document";
  const sanitizedTitle = rawTitle
    .replace(/[^a-zA-Z0-9_\-\s]/g, "")
    .trim()
    .replace(/\s+/g, "_");
  const filename = options.filename || `${sanitizedTitle}.pdf`;

  const blob = doc.output("blob");
  const pageCount = doc.getNumberOfPages();
  return { blob, filename, pageCount };
}

/**
 * Checks whether a chat message content string is a document or report
 * suitable for 1-click PDF export.
 */
export function isExportableDocument(content: string): boolean {
  if (!content || typeof content !== "string") return false;
  const trimmed = content.trim();
  if (trimmed.length < 160) return false;

  const hasHeadings = /^(#|##|###)\s+/m.test(trimmed);
  const hasBullets = /^[-*•]\s+/m.test(trimmed);
  const hasSections = (trimmed.match(/##\s+/g) || []).length >= 2;
  const isDocLike =
    /strategy|overview|architecture|roadmap|cheat sheet|summary|plan|proposal|brief|interview|assessment|cover letter/i.test(
      trimmed.slice(0, 300),
    );

  return (hasHeadings && hasSections) || (hasHeadings && hasBullets && isDocLike);
}

/**
 * Opens a generated PDF blob in a new browser tab for preview/printing.
 */
export function previewDocumentPdf(
  markdown: string,
  options: DocumentPdfOptions = {},
): void {
  const { blob } = generateDocumentPdfBlob(markdown, options);
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (!win) {
    // Popup blocked fallback
    void exportDocumentAsPdf(markdown, options);
  }
}


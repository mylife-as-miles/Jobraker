// Minimal PDF parsing using pdfjs-dist (text extraction only)
// Lazy loads pdfjs to avoid heavy initial bundle impact.

export interface ParsedPdfResult {
  text: string;
  lines: string[];
  /** Text-line positions from the embedded PDF text layer, ordered as parsed. */
  pageLines: Array<{ page: number; text: string; x: number; y: number }>;
}

let workerInitialized = false;
let pdfjsLibPromise: Promise<typeof import("pdfjs-dist")> | null = null;

async function getPdfJs() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import("pdfjs-dist").then(async (pdfjs) => {
      if (!workerInitialized) {
        try {
          // @ts-ignore - bundler query param
          const workerSrc: string = (
            await import("pdfjs-dist/build/pdf.worker.mjs?url")
          ).default;
          if (pdfjs.GlobalWorkerOptions) {
            (pdfjs.GlobalWorkerOptions as any).workerSrc = workerSrc;
          }
        } catch {
          // If worker URL import fails, pdf.js may still work with inline worker in dev
        }
        workerInitialized = true;
      }
      return pdfjs;
    });
  }
  return pdfjsLibPromise;
}

interface ExtractedItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontName: string;
}

const HEADING_KEYWORDS = [
  "experience",
  "work experience",
  "professional experience",
  "employment history",
  "work history",
  "career history",
  "education",
  "academic background",
  "qualifications",
  "skills",
  "technical skills",
  "core competencies",
  "technologies",
  "proficiencies",
  "projects",
  "selected projects",
  "key projects",
  "certifications",
  "certificates",
  "licenses",
  "summary",
  "professional summary",
  "profile",
  "about me",
  "objective",
  "awards",
  "honors",
  "languages",
  "publications",
  "volunteer",
];

function isHeadingText(text: string, height: number, medianHeight: number, fontName: string): boolean {
  const clean = text.replace(/^[#*\-•\d.]+\s*/, "").replace(/[:\s]+$/, "").trim().toLowerCase();
  if (!clean || clean.length > 50) return false;

  const matchesKeyword = HEADING_KEYWORDS.some(
    (kw) => clean === kw || clean.startsWith(kw + " ") || clean.endsWith(" " + kw)
  );
  if (!matchesKeyword) return false;

  const isLarger = height >= medianHeight * 1.15;
  const isBold = /bold|heavy|black|medium/i.test(fontName);
  const isAllUpper = text === text.toUpperCase() && /[A-Z]/.test(text);

  return matchesKeyword && (isLarger || isBold || isAllUpper || clean.length < 30);
}

function reconstructLines(items: ExtractedItem[], medianHeight: number) {
  const lines: { y: number; height: number; items: ExtractedItem[] }[] = [];
  for (const item of items) {
    if (!item.str.trim() && item.str !== " ") continue;
    const threshold = Math.max(item.height / 2, 4);
    let found = false;
    for (const line of lines) {
      if (Math.abs(line.y - item.y) <= threshold) {
        line.items.push(item);
        found = true;
        break;
      }
    }
    if (!found) {
      lines.push({ y: item.y, height: item.height, items: [item] });
    }
  }

  // Sort lines from top to bottom (Y coordinate is higher at top in PDF space)
  lines.sort((a, b) => b.y - a.y);

  const renderedLines: Array<{ text: string; x: number; y: number }> = [];
  for (const line of lines) {
    line.items.sort((a, b) => a.x - b.x);

    let lineText = "";
    for (let idx = 0; idx < line.items.length; idx++) {
      const item = line.items[idx];
      if (idx === 0) {
        lineText = item.str;
      } else {
        const prevItem = line.items[idx - 1];
        const hasSpace = prevItem.str.endsWith(" ") || item.str.startsWith(" ");
        if (hasSpace) {
          lineText += item.str;
        } else {
          const estimatedWidth = prevItem.width > 0 ? prevItem.width : prevItem.str.length * (prevItem.height * 0.4);
          const gap = item.x - (prevItem.x + estimatedWidth);
          if (gap > 2.5) {
            lineText += " " + item.str;
          } else {
            lineText += item.str;
          }
        }
      }
    }

    const trimmed = lineText.replace(/[ \t]+/g, " ").trim();
    if (trimmed) {
      const firstItem = line.items[0];
      const heading = isHeadingText(trimmed, line.height, medianHeight, firstItem?.fontName || "");
      const formatted = heading && !trimmed.startsWith("##") ? `## ${trimmed}` : trimmed;

      renderedLines.push({
        text: formatted,
        x: Math.min(...line.items.map((entry) => entry.x)),
        y: line.y,
      });
    }
  }

  return renderedLines;
}

export function extractPageLayoutLines(items: ExtractedItem[]): Array<{ text: string; x: number; y: number }> {
  if (items.length === 0) return [];

  // Calculate median font height for heading discrimination
  const heights = items.map((it) => it.height).sort((a, b) => a - b);
  const medianHeight = heights[Math.floor(heights.length / 2)] || 10;

  const minX = Math.min(...items.map((it) => it.x));
  const maxX = Math.max(...items.map((it) => it.x + (it.width || 0)));
  const minY = Math.min(...items.map((it) => it.y));
  const maxY = Math.max(...items.map((it) => it.y));
  const pageWidth = maxX - minX;

  // Detect if page has a 2-column layout with a vertical gutter
  let detectedGutter: number | null = null;
  if (pageWidth >= 200 && items.length >= 15) {
    const minSplit = minX + 0.22 * pageWidth;
    const maxSplit = maxX - 0.22 * pageWidth;
    let bestGutterScore = -1;
    let bestSplit = 0;

    for (let split = minSplit; split <= maxSplit; split += 6) {
      const leftItems = items.filter((it) => it.x + (it.width || 0) <= split);
      const rightItems = items.filter((it) => it.x >= split);
      const crossingItems = items.filter(
        (it) => it.x < split && it.x + (it.width || 0) > split
      );

      if (leftItems.length >= 6 && rightItems.length >= 6) {
        const bodyCrossings = crossingItems.filter(
          (it) => it.y < maxY - (maxY - minY) * 0.25
        );
        if (bodyCrossings.length <= 2) {
          const leftMinX = Math.min(...leftItems.map((it) => it.x));
          const leftMaxX = Math.max(...leftItems.map((it) => it.x + (it.width || 0)));
          const rightMinX = Math.min(...rightItems.map((it) => it.x));
          const rightMaxX = Math.max(...rightItems.map((it) => it.x + (it.width || 0)));
          const gap = rightMinX - leftMaxX;
          const leftColWidth = leftMaxX - leftMinX;
          const rightColWidth = rightMaxX - rightMinX;

          // Both columns must have substantial width (>= 18% of page width)
          const hasSufficientWidth =
            leftColWidth >= 0.18 * pageWidth && rightColWidth >= 0.18 * pageWidth;

          // The right column must contain substantial content (>= 140 characters),
          // not just sparse right-aligned date/city strings.
          const rightChars = rightItems.reduce(
            (sum, it) => sum + it.str.trim().length,
            0
          );
          const hasSufficientRightVolume = rightChars >= 140;

          // Check if right items are predominantly short right-aligned metadata (e.g. dates, locations)
          const validRightItems = rightItems.filter((it) => it.str.trim());
          const avgRightLen =
            rightChars / (validRightItems.length || 1);
          const dateLikeCount = validRightItems.filter((it) =>
            /\b(?:19|20)\d{2}|present|current\b/i.test(it.str)
          ).length;
          const isMostlyDates =
            validRightItems.length > 0 &&
            dateLikeCount / validRightItems.length >= 0.4 &&
            avgRightLen < 28;

          const sharedLineCount = rightItems.filter((rit) =>
            leftItems.some(
              (lit) => Math.abs(lit.y - rit.y) <= Math.max(rit.height / 2, 4)
            )
          ).length;

          const isRightAlignedMetadata =
            isMostlyDates ||
            (sharedLineCount / rightItems.length > 0.6 &&
              avgRightLen < 22 &&
              rightColWidth < 0.22 * pageWidth);

          if (
            gap >= 10 &&
            hasSufficientWidth &&
            hasSufficientRightVolume &&
            !isRightAlignedMetadata
          ) {
            const score =
              gap * (leftItems.length + rightItems.length) -
              bodyCrossings.length * 500;
            if (score > bestGutterScore) {
              bestGutterScore = score;
              bestSplit = (leftMaxX + rightMinX) / 2;
            }
          }
        }
      }
    }

    if (bestGutterScore > 0) {
      detectedGutter = bestSplit;
    }
  }

  if (detectedGutter !== null) {
    const splitX = detectedGutter;
    const crossingHeaderItems = items.filter(
      (it) => it.x < splitX && it.x + (it.width || 0) > splitX
    );
    const headerThresholdY = crossingHeaderItems.length > 0
      ? Math.min(...crossingHeaderItems.map((it) => it.y)) - 5
      : maxY + 1;

    const headerItems = items.filter((it) => it.y >= headerThresholdY);
    const bodyItems = items.filter((it) => it.y < headerThresholdY);

    const leftColumnItems = bodyItems.filter(
      (it) => it.x + (it.width || 0) / 2 < splitX
    );
    const rightColumnItems = bodyItems.filter(
      (it) => it.x + (it.width || 0) / 2 >= splitX
    );

    const renderedHeader = reconstructLines(headerItems, medianHeight);
    const renderedLeft = reconstructLines(leftColumnItems, medianHeight);
    const renderedRight = reconstructLines(rightColumnItems, medianHeight);

    return [
      ...renderedHeader,
      ...renderedLeft,
      ...renderedRight,
    ];
  }

  return reconstructLines(items, medianHeight);
}

export async function parsePdfFile(file: File): Promise<ParsedPdfResult> {
  const [arrayBuffer, { getDocument }] = await Promise.all([
    file.arrayBuffer(),
    getPdfJs(),
  ]);

  const doc = await getDocument({
    data: arrayBuffer,
    // Keep PDF parsing compatible with a strict CSP by avoiding runtime code generation.
    isEvalSupported: false,
  }).promise;

  let fullText = "";
  const pageLines: ParsedPdfResult["pageLines"] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();

    const rawItems: ExtractedItem[] = content.items.map((it: any) => {
      const str = it.str || "";
      const x = it.transform ? it.transform[4] : 0;
      const y = it.transform ? it.transform[5] : 0;
      const height = it.transform ? Math.abs(it.transform[3]) : 10;
      const width = it.width || 0;
      const fontName = it.fontName || "";
      return { str, x, y, width, height, fontName };
    });

    const items = rawItems.filter((it) => it.str && it.str.trim().length > 0);
    if (items.length === 0) continue;

    const pageRenderedLines = extractPageLayoutLines(items);

    for (const line of pageRenderedLines) {
      pageLines.push({
        page: i,
        text: line.text,
        x: line.x,
        y: line.y,
      });
      fullText += line.text + "\n";
    }
  }

  const cleaned = fullText
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .trim();

  return { text: cleaned, lines: cleaned.split("\n"), pageLines };
}

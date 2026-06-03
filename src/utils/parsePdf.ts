// Minimal PDF parsing using pdfjs-dist (text extraction only)
// Lazy loads pdfjs to avoid heavy initial bundle impact.

export interface ParsedPdfResult {
  text: string;
  lines: string[];
}

export async function parsePdfFile(file: File): Promise<ParsedPdfResult> {
  const arrayBuffer = await file.arrayBuffer();
  // pdfjs-dist v4 ESM: import API and worker URL explicitly for Vite
  const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist');
  try {
    // Vite: import worker as URL so pdf.js can load it
    // @ts-ignore - bundler query param
    const workerSrc: string = (await import('pdfjs-dist/build/pdf.worker.mjs?url')).default;
    if (GlobalWorkerOptions) {
      (GlobalWorkerOptions as any).workerSrc = workerSrc;
    }
  } catch {
    // If worker URL import fails, pdf.js may still work with inline worker in dev
  }

  const doc = await getDocument({
    data: arrayBuffer,
    // Keep PDF parsing compatible with a strict CSP by avoiding runtime code generation.
    isEvalSupported: false,
  }).promise;
  let fullText = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    
    // Group text items by Y coordinate (vertical position) to reconstruct lines
    const items = content.items.map((it: any) => {
      const str = it.str || '';
      const x = it.transform ? it.transform[4] : 0;
      const y = it.transform ? it.transform[5] : 0;
      const height = it.transform ? Math.abs(it.transform[3]) : 10;
      return { str, x, y, height };
    });

    const lines: { y: number; items: typeof items }[] = [];
    for (const item of items) {
      if (!item.str.trim() && item.str !== ' ') continue;
      
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
        lines.push({ y: item.y, items: [item] });
      }
    }

    // Sort lines from top to bottom (Y coordinate is higher at the top of the page)
    lines.sort((a, b) => b.y - a.y);

    let pageText = '';
    for (const line of lines) {
      // Sort items on the same line from left to right
      line.items.sort((a, b) => a.x - b.x);
      
      let lineText = '';
      for (let idx = 0; idx < line.items.length; idx++) {
        const item = line.items[idx];
        if (idx === 0) {
          lineText = item.str;
        } else {
          const prevItem = line.items[idx - 1];
          const hasSpace = prevItem.str.endsWith(' ') || item.str.startsWith(' ');
          if (hasSpace) {
            lineText += item.str;
          } else {
            // Check horizontal gap. If they are very close, merge without a space (indicates PDF.js split single word)
            // Otherwise, insert a space.
            const estimatedWidth = prevItem.str.length * (prevItem.height * 0.4);
            const gap = item.x - (prevItem.x + estimatedWidth);
            if (gap > 3) {
              lineText += ' ' + item.str;
            } else {
              lineText += item.str;
            }
          }
        }
      }
      
      if (lineText.trim()) {
        pageText += lineText + '\n';
      }
    }
    
    fullText += pageText + '\n';
  }

  // Preserve newlines, but collapse multiple consecutive spaces on each line
  const cleaned = fullText
    .split('\n')
    .map(line => line.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .trim();

  return { text: cleaned, lines: cleaned.split('\n') };
}

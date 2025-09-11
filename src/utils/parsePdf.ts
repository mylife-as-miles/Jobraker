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

  const doc = await getDocument({ data: arrayBuffer }).promise;
  let fullText = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map((it: any) => (it.str || ''));
    fullText += strings.join(' ') + '\n';
  }
  const cleaned = fullText.replace(/\s+/g, ' ').trim();
  return { text: cleaned, lines: fullText.split(/\n+/).map(l => l.trim()).filter(Boolean) };
}

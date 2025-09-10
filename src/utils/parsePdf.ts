// Minimal PDF parsing using pdfjs-dist (text extraction only)
// Lazy loads pdfjs to avoid heavy initial bundle impact.

export interface ParsedPdfResult {
  text: string;
  lines: string[];
}

export async function parsePdfFile(file: File): Promise<ParsedPdfResult> {
  const arrayBuffer = await file.arrayBuffer();
  // pdfjs-dist v4 exports from root; dynamic import keeps bundle size small
  const pdfjs = await import('pdfjs-dist');
  // Some bundlers (Vite) need explicit worker entry (asset handled separately)
  try {
    // @ts-ignore - worker entry asset
    const worker = await import('pdfjs-dist/build/pdf.worker.js');
    // @ts-ignore - set worker source path/URL
    if (pdfjs.GlobalWorkerOptions && worker) {
      // Worker may be a module URL string or object; attempt common patterns
      const workerSrc = (worker && (worker.default || worker)) as any;
      if (typeof workerSrc === 'string') {
        pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
      }
    }
  } catch {
    // Fallback: rely on default worker bundling; ignore if missing
  }

  const doc = await pdfjs.getDocument({ data: arrayBuffer }).promise;
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

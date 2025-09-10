// Minimal PDF parsing using pdfjs-dist (text extraction only)
// Lazy loads pdfjs to avoid heavy initial bundle impact.

export interface ParsedPdfResult {
  text: string;
  lines: string[];
}

export async function parsePdfFile(file: File): Promise<ParsedPdfResult> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfjs = await import('pdfjs-dist/build/pdf');
  // @ts-ignore
  const workerSrc = await import('pdfjs-dist/build/pdf.worker');
  // @ts-ignore
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc; // may rely on bundler asset handling

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

export async function extractTextFromPdf(file: File): Promise<string> {
    const pdfjsLib = await import('pdfjs-dist');
    try {
        // @ts-ignore - bundler query param
        const workerSrc: string = (await import('pdfjs-dist/build/pdf.worker.mjs?url')).default;
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
    } catch {
        // If the worker URL import fails, pdf.js can still fall back in development.
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({
        data: arrayBuffer,
        // Avoid `unsafe-eval` requirements when parsing PDFs under a strict CSP.
        isEvalSupported: false,
    }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ');
        fullText += pageText + '\n\n';
    }

    return fullText.trim();
}

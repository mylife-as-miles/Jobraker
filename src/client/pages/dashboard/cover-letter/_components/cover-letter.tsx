import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Minus, Plus, Download, Wand2, Pencil, Share2, Check } from "lucide-react";
import { Button, Card } from "@reactive-resume/ui";
import { createClient } from "@/lib/supabaseClient";
import { useToast } from "@/components/ui/toast-provider";

// This component renders the UI for the cover letter page.
// It includes a header, the cover letter content, and a footer with controls.
export const CoverLetter = () => {
  const navigate = useNavigate();
  const supabase = useMemo(() => createClient(), []);
  const { success, error: toastError } = useToast();
  const [fontSize, setFontSize] = useState(16);
  const [role, setRole] = useState("Software Engineer");
  const [recipient, setRecipient] = useState("Hiring Manager");
  const [company, setCompany] = useState("Acme Corp");
  const [content, setContent] = useState("");
  const [copied, setCopied] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const previewRef = useRef<HTMLDivElement | null>(null);

  // Load/save from localStorage (keeps it functional without backend migrations)
  const STORAGE_KEY = "jr.coverLetter.draft.v1";
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setRole(parsed?.role ?? "Software Engineer");
        setRecipient(parsed?.recipient ?? "Hiring Manager");
        setCompany(parsed?.company ?? "Acme Corp");
        setContent(parsed?.content ?? "");
        setFontSize(parsed?.fontSize ?? 16);
        setSavedAt(parsed?.savedAt ?? null);
      }
    } catch {}
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const payload = { role, recipient, company, content, fontSize, savedAt: new Date().toISOString() };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        setSavedAt(payload.savedAt);
      } catch {}
    }, 400);
    return () => clearTimeout(t);
  }, [role, recipient, company, content, fontSize]);

  const preview = useMemo(() => {
    if (content.trim().length) return content;
    return `Dear ${recipient},\n\nI’m excited to apply for the ${role} role at ${company}. I bring hands-on experience building production-grade systems, a bias for ownership, and a track record shipping polished user experiences.\n\nHighlights:\n• Led end-to-end delivery of complex features across frontend/backends.\n• Collaborated across design, product, and data to align on impact.\n• Elevated code quality with tests, performance tuning, and strong reviews.\n\nI’d love to discuss how I can contribute to ${company}.\n\nBest regards,\n[Your Name]`;
  }, [content, role, recipient, company]);

  const zoomIn = () => setFontSize((size) => Math.min(28, size + 1));
  const zoomOut = () => setFontSize((size) => Math.max(12, size - 1));
  const download = () => {
    try {
      const node = previewRef.current;
      if (!node) return;
      const html = node.innerHTML;
      const win = window.open("", "_blank", "noopener,noreferrer,width=900,height=1200");
      if (!win) return;
      win.document.write(`<!doctype html><html><head><title>Cover Letter</title>
        <meta charset=\"utf-8\" />
        <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
        <style>
          @page { margin: 24mm; }
          body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Inter, Helvetica, Arial, sans-serif; }
          .doc { max-width: 800px; margin: 0 auto; }
          pre { white-space: pre-wrap; font-family: inherit; }
        </style>
      </head><body><div class="doc">${html}</div></body></html>`);
      win.document.close();
      win.focus();
      win.print();
      setTimeout(() => { try { win.close(); } catch {} }, 300);
    } catch (e) {
      console.error(e);
      alert("Failed to prepare PDF. Use your browser's Print to PDF as a fallback.");
    }
  };
  const aiPolish = async () => {
    if (aiLoading) return;
    setAiLoading(true);
    try {
      const payload = {
        role: role?.trim() || undefined,
        company: company?.trim() || undefined,
        recipient: recipient?.trim() || undefined,
        job_description: undefined,
        tone: 'professional',
        length: 'medium',
      } as any;

      const { data, error } = await (supabase as any).functions.invoke('generate-cover-letter', {
        body: payload,
      });
      if (error) throw new Error(error?.message || 'Failed to generate');
      const text: string = (data?.text || '').trim();
      if (!text) {
        throw new Error('No content returned. Try again later.');
      }
      setContent(text);
      success('Draft updated', 'AI polished your cover letter');
    } catch (e: any) {
      console.error('AI generate error:', e);
      toastError('AI failed', e?.message || 'Please try again later.');
    } finally {
      setAiLoading(false);
    }
  };
  const quickEdit = () => {
    const textarea = document.getElementById("cover-letter-content") as HTMLTextAreaElement | null;
    textarea?.focus();
  };
  const share = async () => {
    try {
      const text = preview;
      if (navigator.share) {
        await navigator.share({ title: `Cover Letter - ${company}`, text });
      } else {
        await navigator.clipboard.writeText(text);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      console.error(e);
      try {
        await navigator.clipboard.writeText(preview);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch {}
    }
  };

  const clearDraft = () => {
    setRole("");
    setRecipient("");
    setCompany("");
    setContent("");
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col gap-4 px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
      {/* Header */}
      <div className="flex items-center justify-between sticky top-0 z-10 bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60 rounded-xl border border-border px-3 sm:px-4 py-2 sm:py-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-lg sm:text-xl md:text-2xl font-semibold tracking-tight">Cover Letter</h1>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto">
          <Button variant="outline" onClick={quickEdit} className="rounded-xl whitespace-nowrap"> <Pencil className="w-4 h-4 mr-2"/> Quick Edit</Button>
          <Button variant="outline" disabled={aiLoading} onClick={aiPolish} className="rounded-xl whitespace-nowrap"> <Wand2 className={`w-4 h-4 mr-2 ${aiLoading ? 'animate-pulse' : ''}`}/> {aiLoading ? 'Polishing…' : 'AI Polish'}</Button>
          <Button variant="outline" onClick={share} className="rounded-xl whitespace-nowrap"> {copied ? <><Check className="w-4 h-4 mr-2"/> Copied</> : <><Share2 className="w-4 h-4 mr-2"/> Share</>} </Button>
          <Button onClick={download} className="rounded-xl whitespace-nowrap"> <Download className="w-4 h-4 mr-2"/> Download</Button>
        </div>
      </div>

      {/* Workspace */}
      <div className="grid gap-4 grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)]">
        {/* Left: Controls */}
        <Card className="p-4 rounded-xl">
          <div className="grid gap-4">
            <div>
              <label className="text-xs opacity-70">Role</label>
              <input value={role} onChange={(e)=>setRole(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs opacity-70">Recipient</label>
                <input value={recipient} onChange={(e)=>setRecipient(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="text-xs opacity-70">Company</label>
                <input value={company} onChange={(e)=>setCompany(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs opacity-70">Content</label>
                <span className="text-[11px] opacity-60">{content.length} chars</span>
              </div>
              <textarea id="cover-letter-content" value={content} onChange={(e)=>setContent(e.target.value)} rows={12} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="Write or paste your cover letter here..." />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" className="h-9 w-9 p-0" onClick={zoomOut}>
                <Minus className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" className="h-9 w-9 p-0" onClick={zoomIn}>
                <Plus className="w-4 h-4" />
              </Button>
              <span className="text-xs opacity-70">Font: {fontSize}px</span>
              <div className="ml-auto flex items-center gap-2">
                <Button variant="outline" size="sm" className="rounded-xl" onClick={clearDraft}>Clear</Button>
                {savedAt && <span className="text-[11px] opacity-60">Saved {new Date(savedAt).toLocaleTimeString()}</span>}
              </div>
            </div>
          </div>
        </Card>

        {/* Right: Preview */}
        <Card className="p-3 sm:p-4 md:p-6 overflow-hidden rounded-xl">
          <div ref={previewRef} className="mx-auto w-full max-w-[800px] rounded-xl border border-border bg-white text-black shadow-xl">
            <div className="p-6 sm:p-8" style={{ fontSize: `${fontSize}px`, lineHeight: 1.6 }}>
              <div className="mb-6">
                <p className="font-bold">[Your Name]</p>
                <p>[Your Phone Number]</p>
                <p>[Your Email]</p>
              </div>
              <pre className="whitespace-pre-wrap font-sans text-[inherit] leading-[inherit]">{preview}</pre>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

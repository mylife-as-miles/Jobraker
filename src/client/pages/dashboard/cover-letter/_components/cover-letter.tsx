import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Minus, Plus, Download, Wand2, Pencil, Share2 } from "lucide-react";
import { Button, Card } from "@reactive-resume/ui";

// This component renders the UI for the cover letter page.
// It includes a header, the cover letter content, and a footer with controls.
export const CoverLetter = () => {
  const navigate = useNavigate();
  const [fontSize, setFontSize] = useState(16);
  const [role, setRole] = useState("Software Engineer");
  const [recipient, setRecipient] = useState("Hiring Manager");
  const [company, setCompany] = useState("Acme Corp");
  const [content, setContent] = useState("");

  const preview = useMemo(() => {
    if (content.trim().length) return content;
    return `Dear ${recipient},\n\nI’m excited to apply for the ${role} role at ${company}. I bring hands-on experience building production-grade systems, a bias for ownership, and a track record shipping polished user experiences.\n\nHighlights:\n• Led end-to-end delivery of complex features across frontend/backends.\n• Collaborated across design, product, and data to align on impact.\n• Elevated code quality with tests, performance tuning, and strong reviews.\n\nI’d love to discuss how I can contribute to ${company}.\n\nBest regards,\n[Your Name]`;
  }, [content, role, recipient, company]);

  const zoomIn = () => setFontSize((size) => Math.min(28, size + 1));
  const zoomOut = () => setFontSize((size) => Math.max(12, size - 1));
  const download = () => alert("Downloading PDF...");
  const aiPolish = () => alert("AI Polishing content...");
  const quickEdit = () => alert("Open structured editor...");
  const share = () => alert("Generating share link...");

  return (
    <div className="flex h-[calc(100vh-2rem)] flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Cover Letter</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={quickEdit} className="rounded-xl"> <Pencil className="w-4 h-4 mr-2"/> Quick Edit</Button>
          <Button variant="outline" onClick={aiPolish} className="rounded-xl"> <Wand2 className="w-4 h-4 mr-2"/> AI Polish</Button>
          <Button variant="outline" onClick={share} className="rounded-xl"> <Share2 className="w-4 h-4 mr-2"/> Share</Button>
          <Button onClick={download} className="rounded-xl"> <Download className="w-4 h-4 mr-2"/> Download</Button>
        </div>
      </div>

      {/* Workspace */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        {/* Left: Controls */}
        <Card className="p-4">
          <div className="grid gap-3">
            <div>
              <label className="text-xs opacity-70">Role</label>
              <input value={role} onChange={(e)=>setRole(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="grid grid-cols-2 gap-3">
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
              <label className="text-xs opacity-70">Content</label>
              <textarea value={content} onChange={(e)=>setContent(e.target.value)} rows={12} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="Write or paste your cover letter here..." />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-9 w-9 p-0" onClick={zoomOut}>
                <Minus className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" className="h-9 w-9 p-0" onClick={zoomIn}>
                <Plus className="w-4 h-4" />
              </Button>
              <span className="text-xs opacity-70">Font: {fontSize}px</span>
            </div>
          </div>
        </Card>

        {/* Right: Preview */}
        <Card className="p-6 overflow-hidden">
          <div className="mx-auto w-full max-w-[800px] rounded-xl border border-border bg-white text-black shadow-xl">
            <div className="p-8" style={{ fontSize: `${fontSize}px`, lineHeight: 1.6 }}>
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

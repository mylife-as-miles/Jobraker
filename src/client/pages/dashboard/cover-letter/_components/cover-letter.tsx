import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Minus, Plus, Download, Wand2, Pencil, Share2, Check, Trash2, ArrowUp, ArrowDown } from "lucide-react";
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
  // Meta/context
  const [role, setRole] = useState("Software Engineer");
  const [company, setCompany] = useState("Acme Corp");
  const [jobDescription, setJobDescription] = useState("");
  const [tone, setTone] = useState<"professional" | "friendly" | "enthusiastic">("professional");
  const [lengthPref, setLengthPref] = useState<"short" | "medium" | "long">("medium");

  // Sender block
  const [senderName, setSenderName] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  const [senderAddress, setSenderAddress] = useState("");

  // Recipient block
  const [recipient, setRecipient] = useState("Hiring Manager");
  const [recipientTitle, setRecipientTitle] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");

  // Letter header & structure
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [subject, setSubject] = useState("");
  const [salutation, setSalutation] = useState("Dear Hiring Manager,");
  const [paragraphs, setParagraphs] = useState<string[]>([]);
  const [closing, setClosing] = useState("Best regards,");
  const [signatureName, setSignatureName] = useState("");
  const [content, setContent] = useState("");
  const [copied, setCopied] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [inlineEdit, setInlineEdit] = useState(false);
  const previewRef = useRef<HTMLDivElement | null>(null);

  // Load/save from localStorage (keeps it functional without backend migrations)
  const STORAGE_KEY = "jr.coverLetter.draft.v2";
  useEffect(() => {
    try {
      const rawV2 = localStorage.getItem(STORAGE_KEY);
      const rawV1 = !rawV2 ? localStorage.getItem("jr.coverLetter.draft.v1") : null; // backwards compat
      const raw = rawV2 || rawV1;
      if (raw) {
        const parsed = JSON.parse(raw);
        setRole(parsed?.role ?? "Software Engineer");
        setCompany(parsed?.company ?? "Acme Corp");
        setJobDescription(parsed?.jobDescription ?? "");
        setTone(parsed?.tone ?? "professional");
        setLengthPref(parsed?.lengthPref ?? "medium");

        setSenderName(parsed?.senderName ?? "");
        setSenderEmail(parsed?.senderEmail ?? "");
        setSenderPhone(parsed?.senderPhone ?? "");
        setSenderAddress(parsed?.senderAddress ?? "");

        setRecipient(parsed?.recipient ?? "Hiring Manager");
        setRecipientTitle(parsed?.recipientTitle ?? "");
        setRecipientAddress(parsed?.recipientAddress ?? "");

        setDate(parsed?.date ?? new Date().toISOString().slice(0, 10));
        setSubject(parsed?.subject ?? "");
        setSalutation(parsed?.salutation ?? `Dear ${parsed?.recipient ?? "Hiring Manager"},`);
        setParagraphs(Array.isArray(parsed?.paragraphs) ? parsed.paragraphs : []);
        setClosing(parsed?.closing ?? "Best regards,");
        setSignatureName(parsed?.signatureName ?? parsed?.senderName ?? "");

        setContent(parsed?.content ?? "");
        setFontSize(parsed?.fontSize ?? 16);
        setSavedAt(parsed?.savedAt ?? null);

        // If migrating from v1 with only content, populate paragraphs
        if ((!parsed?.paragraphs || !parsed.paragraphs.length) && (parsed?.content || "").trim()) {
          const parts = String(parsed.content)
            .split(/\n\s*\n+/)
            .map((p: string) => p.trim())
            .filter(Boolean);
          if (parts.length) setParagraphs(parts);
        }
      }
    } catch {}
  }, []);

  // Auto-hydrate sender details from profile/auth on first load if missing
  useEffect(() => {
    (async () => {
      try {
        const hasSender = !!(senderName || senderEmail || senderPhone || senderAddress);
        if (hasSender) return;
        const { data: userData } = await (supabase as any).auth.getUser();
        const uid = userData?.user?.id;
        if (!uid) return;
        // Fill email from auth immediately if present
        if (!senderEmail && userData?.user?.email) setSenderEmail(userData.user.email);
        const { data, error } = await (supabase as any)
          .from('profiles')
          .select('first_name,last_name,job_title,location,phone')
          .eq('id', uid)
          .maybeSingle();
        if (error) return; // silent on auto
        if (data) {
          const name = [data.first_name, data.last_name].filter(Boolean).join(' ');
          if (!senderName && name) {
            setSenderName(name);
            if (!signatureName) setSignatureName(name);
          }
          if (!senderPhone && data.phone) setSenderPhone(data.phone);
          if (!senderAddress && data.location) setSenderAddress(data.location);
          if (!role && data.job_title) setRole(data.job_title);
        }
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const payload = {
          role,
          company,
          jobDescription,
          tone,
          lengthPref,
          senderName,
          senderEmail,
          senderPhone,
          senderAddress,
          recipient,
          recipientTitle,
          recipientAddress,
          date,
          subject,
          salutation,
          paragraphs,
          closing,
          signatureName,
          content,
          fontSize,
          savedAt: new Date().toISOString(),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        setSavedAt(payload.savedAt);
      } catch {}
    }, 400);
    return () => clearTimeout(t);
  }, [role, company, jobDescription, tone, lengthPref, senderName, senderEmail, senderPhone, senderAddress, recipient, recipientTitle, recipientAddress, date, subject, salutation, paragraphs, closing, signatureName, content, fontSize]);

  const fallbackBody = useMemo(() => {
    if (content.trim().length) return content;
    return `I’m excited to apply for the ${role} role at ${company}. I bring hands-on experience building production-grade systems, a bias for ownership, and a track record shipping polished user experiences.\n\nHighlights:\n• Led end-to-end delivery of complex features across frontend/backends.\n• Collaborated across design, product, and data to align on impact.\n• Elevated code quality with tests, performance tuning, and strong reviews.\n\nI’d love to discuss how I can contribute to ${company}.`;
  }, [content, role, company]);

  const finalBody = useMemo(() => {
    if (paragraphs.length) return paragraphs.join("\n\n");
    return fallbackBody;
  }, [paragraphs, fallbackBody]);

  // Keep signature in sync with sender name if not customized
  useEffect(() => {
    if (!signatureName.trim() && senderName.trim()) setSignatureName(senderName.trim());
  }, [senderName]);

  const serializeLetter = () => {
    const lines: string[] = [];
    if (senderName || senderPhone || senderEmail || senderAddress) {
      if (senderName) lines.push(senderName);
      if (senderPhone) lines.push(senderPhone);
      if (senderEmail) lines.push(senderEmail);
      if (senderAddress) lines.push(senderAddress);
      lines.push("");
    }
    if (date) lines.push(new Date(date).toLocaleDateString());
    if (date) lines.push("");
    if (recipient || recipientTitle || company || recipientAddress) {
      const nameLine = [recipient, recipientTitle].filter(Boolean).join(", ");
      if (nameLine) lines.push(nameLine);
      if (company) lines.push(company);
      if (recipientAddress) lines.push(recipientAddress);
      lines.push("");
    }
    if (subject) {
      lines.push(`Subject: ${subject}`);
      lines.push("");
    }
    if (salutation) lines.push(salutation);
    if (salutation) lines.push("");
    if (finalBody) lines.push(finalBody);
    if (finalBody) lines.push("");
    if (closing) lines.push(closing);
    if (signatureName) lines.push(signatureName);
    return lines.join("\n");
  };

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
        job_description: jobDescription?.trim() || undefined,
        tone: tone,
        length: lengthPref,
      } as any;

      const { data, error } = await (supabase as any).functions.invoke('generate-cover-letter', {
        body: payload,
      });
      if (error) throw new Error(error?.message || 'Failed to generate');
      const text: string = (data?.text || '').trim();
      if (!text) {
        throw new Error('No content returned. Try again later.');
      }
      // Try to parse salutation/closing/signature heuristically, and body paragraphs
      let newSal = salutation;
      let newClose = closing;
      let newSig = signatureName || senderName || '';
      let bodyTxt = text;
      // Extract first line if it looks like a salutation (starts with Dear)
      const lines = text.split(/\n+/);
      if (lines.length > 2 && /^dear\b/i.test(lines[0].trim())) {
        newSal = lines[0].trim();
        bodyTxt = lines.slice(1).join('\n');
      }
      // Extract closing from last lines if match common closings
      const closingIdx = lines.findIndex((l) => /^(best|sincerely|regards|kind regards|respectfully)/i.test(l.trim()));
      if (closingIdx !== -1) {
        newClose = lines[closingIdx].trim();
        const sigCandidate = (lines[closingIdx + 1] || '').trim();
        if (sigCandidate) newSig = sigCandidate;
        bodyTxt = lines.slice(0, closingIdx).join('\n');
      }
      // Update body paragraphs
      const parts = bodyTxt
        .split(/\n\s*\n+/)
        .map((p) => p.trim())
        .filter(Boolean);
      if (parts.length) {
        setParagraphs(parts);
        setContent('');
      } else {
        setContent(bodyTxt);
      }
      setSalutation(newSal);
      setClosing(newClose);
      setSignatureName(newSig);
      success('Draft updated', 'AI generated and structured your letter');
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
      const text = serializeLetter();
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
        await navigator.clipboard.writeText(serializeLetter());
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch {}
    }
  };

  const clearDraft = () => {
    setRole("");
    setCompany("");
    setJobDescription("");
    setTone("professional");
    setLengthPref("medium");
    setSenderName("");
    setSenderEmail("");
    setSenderPhone("");
    setSenderAddress("");
    setRecipient("");
    setRecipientTitle("");
    setRecipientAddress("");
    setDate(new Date().toISOString().slice(0, 10));
    setSubject("");
    setSalutation("Dear Hiring Manager,");
    setParagraphs([]);
    setClosing("Best regards,");
    setSignatureName("");
    setContent("");
  };

  const loadProfile = async () => {
    try {
      const { data: userData } = await (supabase as any).auth.getUser();
      const uid = userData?.user?.id;
      if (!uid) {
        toastError('Not signed in', 'Please sign in to load your profile.');
        return;
      }
      const { data, error } = await (supabase as any)
        .from('profiles')
        .select('first_name,last_name,job_title,location,phone')
        .eq('id', uid)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        const name = [data.first_name, data.last_name].filter(Boolean).join(' ');
        if (name) {
          setSenderName(name);
          if (!signatureName) setSignatureName(name);
        }
        if (data.phone) setSenderPhone(data.phone);
        // Also set email from auth profile if available
        if (userData?.user?.email) setSenderEmail(userData.user.email);
        // We don't have email/website column in schema.sql; leave email empty for manual entry.
        if (data.location) setSenderAddress(data.location);
        if (data.job_title) setRole(data.job_title);
        success('Profile loaded', 'Filled details from your profile');
      } else {
        toastError('No profile found', 'Please complete your profile first.');
      }
    } catch (e: any) {
      console.error('Load profile error', e);
      toastError('Profile load failed', e?.message || 'Try again later');
    }
  };

  const addParagraph = () => setParagraphs((arr) => [...arr, ""]);
  const updateParagraph = (idx: number, val: string) => setParagraphs((arr) => arr.map((p, i) => (i === idx ? val : p)));
  const removeParagraph = (idx: number) => setParagraphs((arr) => arr.filter((_, i) => i !== idx));
  const moveParagraphUp = (idx: number) => setParagraphs((arr) => {
    if (idx <= 0) return arr;
    const copy = arr.slice();
    [copy[idx - 1], copy[idx]] = [copy[idx], copy[idx - 1]];
    return copy;
  });
  const moveParagraphDown = (idx: number) => setParagraphs((arr) => {
    if (idx >= arr.length - 1) return arr;
    const copy = arr.slice();
    [copy[idx + 1], copy[idx]] = [copy[idx], copy[idx + 1]];
    return copy;
  });
  const splitContentIntoParagraphs = () => {
    const parts = String(content)
      .split(/\n\s*\n+/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length) {
      setParagraphs(parts);
      success('Split into paragraphs', 'You can now edit each paragraph');
    } else {
      toastError('Nothing to split', 'Add content first or use AI to generate');
    }
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
          <Button variant="outline" onClick={() => setInlineEdit((v)=>!v)} className={`rounded-xl whitespace-nowrap ${inlineEdit ? 'bg-primary/10 border-primary text-primary' : ''}`}> <Pencil className="w-4 h-4 mr-2"/> {inlineEdit ? 'Edit in Preview: On' : 'Edit in Preview'} </Button>
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
            {/* Sender */}
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <label className="text-xs opacity-70 uppercase tracking-wide">Sender</label>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="rounded-xl" onClick={loadProfile}>Use Profile</Button>
                  <Button variant="outline" size="sm" className="rounded-xl" onClick={() => { setSenderName(""); setSenderEmail(""); setSenderPhone(""); setSenderAddress(""); }}>Clear</Button>
                </div>
              </div>
              <input value={senderName} onChange={(e)=>setSenderName(e.target.value)} placeholder="Your name" className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input value={senderEmail} onChange={(e)=>setSenderEmail(e.target.value)} placeholder="Email" className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
                <input value={senderPhone} onChange={(e)=>setSenderPhone(e.target.value)} placeholder="Phone" className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <input value={senderAddress} onChange={(e)=>setSenderAddress(e.target.value)} placeholder="Address" className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>

            {/* Recipient */}
            <div className="grid gap-2">
              <label className="text-xs opacity-70 uppercase tracking-wide">Recipient</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input value={recipient} onChange={(e)=>setRecipient(e.target.value)} placeholder="Recipient name" className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
                <input value={recipientTitle} onChange={(e)=>setRecipientTitle(e.target.value)} placeholder="Recipient title" className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input value={company} onChange={(e)=>setCompany(e.target.value)} placeholder="Company" className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
                <input value={recipientAddress} onChange={(e)=>setRecipientAddress(e.target.value)} placeholder="Company address" className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
              </div>
            </div>

            {/* Header/meta */}
            <div className="grid gap-2">
              <label className="text-xs opacity-70 uppercase tracking-wide">Letter Details</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input type="date" value={date} onChange={(e)=>setDate(e.target.value)} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
                <input value={subject} onChange={(e)=>setSubject(e.target.value)} placeholder="Subject (optional)" className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <input value={salutation} onChange={(e)=>setSalutation(e.target.value)} placeholder="Salutation (e.g., Dear …,)" className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>

            {/* Closing/signature */}
            <div className="grid gap-2">
              <label className="text-xs opacity-70 uppercase tracking-wide">Closing & Signature</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input value={closing} onChange={(e)=>setClosing(e.target.value)} placeholder="Closing (e.g., Best regards,)" className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
                <input value={signatureName} onChange={(e)=>setSignatureName(e.target.value)} placeholder="Signature name" className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
              </div>
            </div>

            {/* AI Config */}
            <div className="grid gap-2">
              <label className="text-xs opacity-70 uppercase tracking-wide">AI Settings</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] opacity-60">Role</label>
                  <input value={role} onChange={(e)=>setRole(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div>
                  <label className="text-[11px] opacity-60">Tone</label>
                  <select value={tone} onChange={(e)=>setTone(e.target.value as any)} className="mt-1 w-full rounded-xl border border-border bg-background px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-ring">
                    <option value="professional">Professional</option>
                    <option value="friendly">Friendly</option>
                    <option value="enthusiastic">Enthusiastic</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] opacity-60">Length</label>
                  <select value={lengthPref} onChange={(e)=>setLengthPref(e.target.value as any)} className="mt-1 w-full rounded-xl border border-border bg-background px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-ring">
                    <option value="short">Short</option>
                    <option value="medium">Medium</option>
                    <option value="long">Long</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[11px] opacity-60">Job Description (optional)</label>
                <textarea value={jobDescription} onChange={(e)=>setJobDescription(e.target.value)} rows={4} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="Paste job description here to tailor the letter..." />
              </div>
            </div>

            {/* Body controls */}
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs opacity-70">Body (raw)</label>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="rounded-xl" onClick={splitContentIntoParagraphs}>Split into paragraphs</Button>
                  <span className="text-[11px] opacity-60">{content.length} chars</span>
                </div>
              </div>
              <textarea id="cover-letter-content" value={content} onChange={(e)=>setContent(e.target.value)} rows={8} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="Write or paste your cover letter here..." />
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <label className="text-xs opacity-70">Paragraphs (advanced)</label>
                <Button variant="outline" size="sm" className="rounded-xl" onClick={addParagraph}><Plus className="w-4 h-4 mr-1"/>Add paragraph</Button>
              </div>
              <div className="grid gap-3">
                {paragraphs.map((p, idx) => (
                  <div key={idx} className="rounded-xl border border-border bg-background/50">
                    <div className="flex items-center justify-between px-2 py-1 border-b border-border/70">
                      <span className="text-[11px] opacity-60">Paragraph {idx + 1}</span>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => moveParagraphUp(idx)} disabled={idx === 0}><ArrowUp className="w-4 h-4"/></Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => moveParagraphDown(idx)} disabled={idx === paragraphs.length - 1}><ArrowDown className="w-4 h-4"/></Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-400 hover:text-red-500" onClick={() => removeParagraph(idx)}><Trash2 className="w-4 h-4"/></Button>
                      </div>
                    </div>
                    <textarea value={p} onChange={(e)=>updateParagraph(idx, e.target.value)} rows={4} className="w-full rounded-b-xl bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="Write paragraph..." />
                  </div>
                ))}
                {!paragraphs.length && (
                  <p className="text-xs opacity-60">No paragraphs added yet. Use AI, paste into the raw body, or click "Add paragraph".</p>
                )}
              </div>
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
              {/* Sender (right-aligned for professional layout) */}
              {(senderName || senderPhone || senderEmail || senderAddress) && (
                <div className="mb-6 flex">
                  <div className="ml-auto text-right">
                    {senderName && (
                      <p
                        className="font-bold focus:outline-none focus:ring-2 ring-primary/50"
                        contentEditable={inlineEdit}
                        suppressContentEditableWarning
                        onBlur={(e) => setSenderName(e.currentTarget.innerText.trim())}
                      >{senderName}</p>
                    )}
                    {senderPhone && (
                      <p
                        className="focus:outline-none focus:ring-2 ring-primary/50"
                        contentEditable={inlineEdit}
                        suppressContentEditableWarning
                        onBlur={(e) => setSenderPhone(e.currentTarget.innerText.trim())}
                      >{senderPhone}</p>
                    )}
                    {senderEmail && (
                      <p
                        className="focus:outline-none focus:ring-2 ring-primary/50"
                        contentEditable={inlineEdit}
                        suppressContentEditableWarning
                        onBlur={(e) => setSenderEmail(e.currentTarget.innerText.trim())}
                      >{senderEmail}</p>
                    )}
                    {senderAddress && (
                      <p
                        className="focus:outline-none focus:ring-2 ring-primary/50"
                        contentEditable={inlineEdit}
                        suppressContentEditableWarning
                        onBlur={(e) => setSenderAddress(e.currentTarget.innerText.trim())}
                      >{senderAddress}</p>
                    )}
                  </div>
                </div>
              )}
              {/* Date */}
              {date && (
                <p
                  className="mb-4 focus:outline-none focus:ring-2 ring-primary/50 text-right"
                  contentEditable={inlineEdit}
                  suppressContentEditableWarning
                  onBlur={(e) => {
                    const raw = e.currentTarget.innerText.trim();
                    // try parse; if fails, keep raw string
                    const d = new Date(raw);
                    if (!isNaN(d.getTime())) setDate(raw.length === 10 && /\d{4}-\d{2}-\d{2}/.test(date) ? raw : new Date(d).toISOString().slice(0,10));
                    else e.currentTarget.innerText = new Date(date).toLocaleDateString();
                  }}
                >{new Date(date).toLocaleDateString()}</p>
              )}
              {/* Recipient (left-aligned) */}
              {(recipient || recipientTitle || company || recipientAddress) && (
                <div className="mb-6">
                  {[recipient, recipientTitle].filter(Boolean).length > 0 && (
                    <p
                      className="focus:outline-none focus:ring-2 ring-primary/50"
                      contentEditable={inlineEdit}
                      suppressContentEditableWarning
                      onBlur={(e) => {
                        const t = e.currentTarget.innerText.trim();
                        const [namePart, ...rest] = t.split(',');
                        setRecipient((namePart || '').trim());
                        setRecipientTitle(rest.join(',').trim());
                      }}
                    >{[recipient, recipientTitle].filter(Boolean).join(', ')}</p>
                  )}
                  {company && (
                    <p
                      className="focus:outline-none focus:ring-2 ring-primary/50"
                      contentEditable={inlineEdit}
                      suppressContentEditableWarning
                      onBlur={(e) => setCompany(e.currentTarget.innerText.trim())}
                    >{company}</p>
                  )}
                  {recipientAddress && (
                    <p
                      className="focus:outline-none focus:ring-2 ring-primary/50"
                      contentEditable={inlineEdit}
                      suppressContentEditableWarning
                      onBlur={(e) => setRecipientAddress(e.currentTarget.innerText.trim())}
                    >{recipientAddress}</p>
                  )}
                </div>
              )}
              {/* Subject */}
              {subject && (
                <p
                  className="font-semibold underline mb-4 focus:outline-none focus:ring-2 ring-primary/50"
                  contentEditable={inlineEdit}
                  suppressContentEditableWarning
                  onBlur={(e) => {
                    const t = e.currentTarget.innerText.replace(/^\s*Subject\s*:\s*/i, '').trim();
                    setSubject(t);
                    e.currentTarget.innerText = `Subject: ${t}`;
                  }}
                >{`Subject: ${subject}`}</p>
              )}
              {/* Salutation */}
              {salutation && (
                <p
                  className="mb-4 focus:outline-none focus:ring-2 ring-primary/50"
                  contentEditable={inlineEdit}
                  suppressContentEditableWarning
                  onBlur={(e) => setSalutation(e.currentTarget.innerText.trim())}
                >{salutation}</p>
              )}
              {/* Body */}
              <div className="space-y-4">
                {(paragraphs.length ? paragraphs : finalBody.split(/\n\s*\n+/)).map((p, i) => (
                  <p
                    key={i}
                    className="whitespace-pre-wrap focus:outline-none focus:ring-2 ring-primary/50"
                    contentEditable={inlineEdit}
                    suppressContentEditableWarning
                    onBlur={(e) => {
                      const text = e.currentTarget.innerText.trim();
                      if (paragraphs.length) {
                        updateParagraph(i, text);
                      } else {
                        const parts = finalBody.split(/\n\s*\n+/);
                        parts[i] = text;
                        setParagraphs(parts);
                        setContent('');
                      }
                    }}
                  >{p}</p>
                ))}
              </div>
              {/* Closing & signature */}
              {(closing || signatureName) && (
                <div className="mt-6">
                  {closing && (
                    <p
                      className="mb-8 focus:outline-none focus:ring-2 ring-primary/50"
                      contentEditable={inlineEdit}
                      suppressContentEditableWarning
                      onBlur={(e) => setClosing(e.currentTarget.innerText.trim())}
                    >{closing}</p>
                  )}
                  {signatureName && (
                    <p
                      className="font-semibold focus:outline-none focus:ring-2 ring-primary/50"
                      contentEditable={inlineEdit}
                      suppressContentEditableWarning
                      onBlur={(e) => setSignatureName(e.currentTarget.innerText.trim())}
                    >{signatureName}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

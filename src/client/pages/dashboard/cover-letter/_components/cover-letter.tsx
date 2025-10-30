import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Minus, Plus, Download, Wand2, Pencil, Share2, Check, Trash2, ArrowUp, ArrowDown, Printer, X, FileText, FileType, Lock } from "lucide-react";
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
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [tone, setTone] = useState<"professional" | "friendly" | "enthusiastic">("professional");
  const [lengthPref, setLengthPref] = useState<"short" | "medium" | "long">("medium");

  // Sender block
  const [senderName, setSenderName] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  const [senderAddress, setSenderAddress] = useState("");

  // Recipient block
  const [recipient, setRecipient] = useState("");
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
  const [exportOpen, setExportOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState<string | null>(null);
  const LAST_EXPORT_KEY = "jr.coverLetter.lastExport";
  const [lastExport, setLastExport] = useState<string>(() => localStorage.getItem(LAST_EXPORT_KEY) || "");
  const previewRef = useRef<HTMLDivElement | null>(null);
  // Local Library for multiple cover letters
  type LibraryEntry = { id: string; name: string; updatedAt: string; data: any };
  const LIB_KEY = "jr.coverLetters.library.v1";
  const LIB_DEFAULT_KEY = "jr.coverLetters.defaultId";
  const [library, setLibrary] = useState<LibraryEntry[]>([]);
  const [libName, setLibName] = useState("");
  const [currentLibId, setCurrentLibId] = useState<string | null>(null);
  
  // Subscription tier state
  const [subscriptionTier, setSubscriptionTier] = useState<'Free' | 'Basics' | 'Pro' | 'Ultimate'>('Free');

  // Load/save from localStorage (keeps it functional without backend migrations)
  const STORAGE_KEY = "jr.coverLetter.draft.v2";
  useEffect(() => {
    try {
      // Load library
      const libRaw = localStorage.getItem(LIB_KEY);
      if (libRaw) {
        const arr = JSON.parse(libRaw);
        if (Array.isArray(arr)) setLibrary(arr);
      }
      const defId = localStorage.getItem(LIB_DEFAULT_KEY);
      if (defId) setCurrentLibId(defId);

      const rawV2 = localStorage.getItem(STORAGE_KEY);
      const rawV1 = !rawV2 ? localStorage.getItem("jr.coverLetter.draft.v1") : null; // backwards compat
      const raw = rawV2 || rawV1;
      if (raw) {
        const parsed = JSON.parse(raw);
        setRole(parsed?.role ?? "");
        setCompany(parsed?.company ?? "");
        setJobDescription(parsed?.jobDescription ?? "");
        setTone(parsed?.tone ?? "professional");
        setLengthPref(parsed?.lengthPref ?? "medium");

        setSenderName(parsed?.senderName ?? "");
        setSenderEmail(parsed?.senderEmail ?? "");
        setSenderPhone(parsed?.senderPhone ?? "");
        setSenderAddress(parsed?.senderAddress ?? "");

        setRecipient(parsed?.recipient ?? "");
        setRecipientTitle(parsed?.recipientTitle ?? "");
        setRecipientAddress(parsed?.recipientAddress ?? "");

        setDate(parsed?.date ?? new Date().toISOString().slice(0, 10));
        setSubject(parsed?.subject ?? "");
        setSalutation(parsed?.salutation ?? "Dear Hiring Manager,");
        setParagraphs(Array.isArray(parsed?.paragraphs) ? parsed.paragraphs : []);
        setClosing(parsed?.closing ?? "Best regards,");
        setSignatureName(parsed?.signatureName ?? "");

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

  // Fetch subscription tier
  useEffect(() => {
    (async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData?.user?.id;
        if (!userId) {
          return;
        }
        
        // Try to fetch from user_subscriptions first
        const { data: subscription } = await supabase
          .from('user_subscriptions')
          .select('subscription_plans(name)')
          .eq('user_id', userId)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        const planName = (subscription as any)?.subscription_plans?.name;
        if (planName && (planName === 'Free' || planName === 'Basics' || planName === 'Pro' || planName === 'Ultimate')) {
          setSubscriptionTier(planName as 'Free' | 'Basics' | 'Pro' | 'Ultimate');
        } else {
          // Fallback to profiles table
          const { data: profileData } = await supabase
            .from('profiles')
            .select('subscription_tier')
            .eq('id', userId)
            .single();
          
          if (profileData?.subscription_tier && (profileData.subscription_tier === 'Free' || profileData.subscription_tier === 'Basics' || profileData.subscription_tier === 'Pro' || profileData.subscription_tier === 'Ultimate')) {
            setSubscriptionTier(profileData.subscription_tier);
          } else {
            setSubscriptionTier('Free');
          }
        }
      } catch (error) {
        console.error('Error fetching subscription tier:', error);
        setSubscriptionTier('Free');
      }
    })();
  }, [supabase]);

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

        // If a library entry is active, keep it updated live
        if (currentLibId) {
          const libRaw = localStorage.getItem(LIB_KEY);
          let arr: LibraryEntry[] = [];
          if (libRaw) {
            try {
              const parsed = JSON.parse(libRaw);
              if (Array.isArray(parsed)) arr = parsed;
            } catch {}
          }
          const idx = arr.findIndex((e) => e.id === currentLibId);
          if (idx !== -1) {
            arr[idx] = { id: currentLibId, name: arr[idx].name, updatedAt: payload.savedAt!, data: payload } as LibraryEntry;
            localStorage.setItem(LIB_KEY, JSON.stringify(arr));
            setLibrary(arr);
          }
        }
      } catch {}
    }, 400);
    return () => clearTimeout(t);
  }, [role, company, jobDescription, tone, lengthPref, senderName, senderEmail, senderPhone, senderAddress, recipient, recipientTitle, recipientAddress, date, subject, salutation, paragraphs, closing, signatureName, content, fontSize]);

  // No hardcoded content - starts empty on new letters, uses user data from profile
  const fallbackBody = useMemo(() => {
    if (content.trim().length) return content;
    return "";
  }, [content]);
  
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
  const exportTxt = () => {
    try {
      const text = serializeLetter();
      if (!text.trim()) return;
      const fileName = `Cover_Letter_${(company||'Company').replace(/[^a-z0-9]+/gi,'_')}_${(role||'Role').replace(/[^a-z0-9]+/gi,'_')}.txt`;
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      requestAnimationFrame(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
      success('Download started', 'TXT file is being saved');
      setLastExport('txt');
      localStorage.setItem(LAST_EXPORT_KEY, 'txt');
    } catch (e) {
      console.error('TXT export failed', e);
      toastError('Export failed', 'Could not create TXT file');
    }
  };

  const exportPdf = async () => {
    if (exportBusy) return;
    setExportBusy('pdf');
    try {
      const serialized = serializeLetter();
      if (!serialized.trim()) throw new Error('Nothing to export');
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'pt', format: 'letter' });
      const marginX = 54; // 0.75 inch
      const marginY = 54;
      const lineHeight = 16;
      const maxWidth = doc.internal.pageSize.getWidth() - marginX * 2;
      doc.setFont('helvetica','normal');
      doc.setFontSize(12);
      let y = marginY;
      const lines = serialized.replace(/\r/g,'').split('\n');
      lines.forEach((line) => {
        if (y > doc.internal.pageSize.getHeight() - marginY) {
          doc.addPage();
          y = marginY;
        }
        if (!line.trim()) { y += lineHeight; return; }
        const wrapped = doc.splitTextToSize(line, maxWidth);
        wrapped.forEach((wLine: string) => {
          if (y > doc.internal.pageSize.getHeight() - marginY) { doc.addPage(); y = marginY; }
            doc.text(wLine, marginX, y);
            y += lineHeight;
        });
      });
      const fileName = `Cover_Letter_${(company||'Company').replace(/[^a-z0-9]+/gi,'_')}_${(role||'Role').replace(/[^a-z0-9]+/gi,'_')}.pdf`;
      doc.save(fileName);
      success('PDF exported', 'Your PDF is downloading');
      setLastExport('pdf');
      localStorage.setItem(LAST_EXPORT_KEY, 'pdf');
    } catch (e:any) {
      console.error('PDF export failed', e);
      toastError('PDF failed', e?.message || 'Could not generate PDF');
    } finally {
      setExportBusy(null);
    }
  };

  const exportDocx = async () => {
    if (exportBusy) return;
    setExportBusy('docx');
    try {
      const serialized = serializeLetter();
      if (!serialized.trim()) throw new Error('Nothing to export');
      const mod = await import('docx');
      const { Document, Packer, Paragraph } = mod as any;
      const paragraphs = serialized.split(/\n\n+/).map((block: string) => new Paragraph({ children: block.split('\n').map(line => mod ? new mod.TextRun(line) : line) }));
      const doc = new Document({ sections: [{ properties: {}, children: paragraphs }] });
      const blob = await Packer.toBlob(doc);
      const fileName = `Cover_Letter_${(company||'Company').replace(/[^a-z0-9]+/gi,'_')}_${(role||'Role').replace(/[^a-z0-9]+/gi,'_')}.docx`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = fileName; document.body.appendChild(a); a.click();
      requestAnimationFrame(() => { document.body.removeChild(a); URL.revokeObjectURL(url); });
      success('DOCX exported', 'Your DOCX is downloading');
      setLastExport('docx');
      localStorage.setItem(LAST_EXPORT_KEY, 'docx');
    } catch (e:any) {
      console.error('DOCX export failed', e);
      toastError('DOCX failed', e?.message || 'Could not generate DOCX');
    } finally {
      setExportBusy(null);
    }
  };

  const printLetter = () => {
    try {
      const node = previewRef.current;
      if (!node) return;
      const html = node.innerHTML;
      const win = window.open('', '_blank', 'noopener,noreferrer,width=900,height=1200');
      if (!win) return;
      win.document.write(`<!doctype html><html><head><title>Cover Letter</title>
        <meta charset=\"utf-8\" />
        <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
        <style>
          @page { margin: 22mm; }
          body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Inter, Helvetica, Arial, sans-serif; }
          .doc { max-width: 820px; margin: 0 auto; }
          p { orphans: 3; widows: 3; }
        </style>
      </head><body><div class="doc">${html}</div></body></html>`);
      win.document.close();
      win.focus();
      setTimeout(() => { try { win.print(); } catch {} }, 50);
      setTimeout(() => { try { win.close(); } catch {} }, 500);
      success('Print ready', 'Use system dialog to save as PDF');
    } catch (e) {
      console.error('Print failed', e);
      toastError('Print failed', 'Could not prepare print view');
    }
  };

  const copyPlain = async () => {
    try {
      await navigator.clipboard.writeText(serializeLetter());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      success('Copied', 'Letter copied to clipboard');
    } catch (e) {
      toastError('Copy failed', 'Clipboard not available');
    }
  };
  const saveToLibrary = (name?: string) => {
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
      const libRaw = localStorage.getItem(LIB_KEY);
      let arr: LibraryEntry[] = [];
      if (libRaw) {
        try { const parsed = JSON.parse(libRaw); if (Array.isArray(parsed)) arr = parsed; } catch {}
      }
      const id = currentLibId || crypto.randomUUID();
      const entryName = (name || libName || `Letter ${arr.length + 1}`).trim();
      const idx = arr.findIndex((e) => e.id === id);
      const entry: LibraryEntry = { id, name: entryName || `Letter ${arr.length + 1}`, updatedAt: payload.savedAt, data: payload };
      if (idx === -1) arr.push(entry); else arr[idx] = entry;
      localStorage.setItem(LIB_KEY, JSON.stringify(arr));
      setLibrary(arr);
      setCurrentLibId(id);
      localStorage.setItem(LIB_DEFAULT_KEY, id);
      setLibName(entry.name);
      success('Saved to Library', 'Cover letter saved for reuse');
    } catch (e) {
      console.error('saveToLibrary error', e);
      toastError('Save failed', 'Could not save letter');
    }
  };
  
  const aiPolish = async () => {
    if (aiLoading) return;
    
    // Check subscription tier
    if (subscriptionTier === 'Free') {
      toastError('Upgrade Required', 'AI cover letter features require a Pro or Ultimate subscription');
      return;
    }
    
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

  // Full AI write: replaces salutation/body/closing/signature using formal cover letter rules.
  const aiWriteFull = async () => {
    if (aiLoading) return;
    
    // Check subscription tier
    if (subscriptionTier === 'Free') {
      toastError('Upgrade Required', 'AI cover letter features require a Pro or Ultimate subscription');
      return;
    }
    
    setAiLoading(true);
    try {
      const payload = {
        role: role?.trim() || undefined,
        company: company?.trim() || undefined,
        recipient: recipient?.trim() || undefined,
        job_description: jobDescription?.trim() || undefined,
        tone: 'professional',
        length: lengthPref,
        mode: 'full',
      } as any;

      const { data, error } = await (supabase as any).functions.invoke('generate-cover-letter', {
        body: payload,
      });
      if (error) throw new Error(error?.message || 'Failed to generate');
      const text: string = (data?.text || '').trim();
      if (!text) throw new Error('No content returned. Try again later.');

      // Parse into salutation, paragraphs, closing, signature
      let newSal = 'Dear Hiring Manager,';
      let newClose = 'Sincerely,';
      let newSig = signatureName || senderName || '';
      let bodyTxt = text;

      const lines = text.split(/\n+/);
      if (lines.length > 2 && /^dear\b/i.test(lines[0].trim())) {
        newSal = lines[0].trim().replace(/\s*,$/, ',');
        bodyTxt = lines.slice(1).join('\n');
      }
      const closingIdx = lines.findIndex((l) => /^(sincerely|best regards|kind regards|respectfully|yours truly)/i.test(l.trim()));
      if (closingIdx !== -1) {
        newClose = lines[closingIdx].trim().replace(/\s*,$/, ',');
        const sigCandidate = (lines[closingIdx + 1] || '').trim();
        if (sigCandidate) newSig = sigCandidate;
        bodyTxt = lines.slice(0, closingIdx).join('\n');
      }
      const parts = bodyTxt
        .split(/\n\s*\n+/)
        .map((p) => p.trim())
        .filter(Boolean);

      // Apply structured fields
      setSalutation(newSal);
      setClosing(newClose);
      setSignatureName(newSig);
      if (parts.length) {
        setParagraphs(parts);
        setContent('');
      } else {
        setParagraphs([]);
        setContent(bodyTxt);
      }
      success('Cover letter drafted', 'A formal letter has been generated.');
    } catch (e: any) {
      console.error('AI write full error:', e);
      toastError('AI failed', e?.message || 'Please try again later.');
    } finally {
      setAiLoading(false);
    }
  };
  // Removed Quick Edit per request
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
    <div id="cover-page-root" className="relative flex min-h-[calc(100vh-4rem)] flex-col gap-6 px-4 sm:px-6 lg:px-8 py-6">
      {/* Ambient Background Glows */}
      <div className="fixed top-20 right-0 h-96 w-96 bg-[#1dff00]/5 rounded-full blur-3xl opacity-30 pointer-events-none -z-10" />
      <div className="fixed bottom-20 left-0 h-96 w-96 bg-[#1dff00]/5 rounded-full blur-3xl opacity-20 pointer-events-none -z-10" />
      
      {/* Header */}
      <div id="cover-header" data-tour="cover-header" className="flex items-center justify-between sticky top-0 z-10 bg-gradient-to-br from-[#0a0a0a]/98 to-[#0f0f0f]/98 backdrop-blur-xl border border-[#1dff00]/30 rounded-2xl shadow-[0_0_40px_rgba(29,255,0,0.15)] px-4 sm:px-6 py-5">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" className="h-11 w-11 p-0 rounded-xl border border-transparent hover:border-[#1dff00]/30 hover:bg-[#1dff00]/10 hover:text-[#1dff00] hover:scale-110 hover:shadow-[0_0_20px_rgba(29,255,0,0.1)] transition-all duration-200" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="h-10 w-px bg-gradient-to-b from-transparent via-[#1dff00]/30 to-transparent" />
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-to-r from-white via-white/95 to-[#1dff00] bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(29,255,0,0.3)]">
              Cover Letter Builder
            </h1>
            <p className="text-xs sm:text-sm text-gray-400 mt-1.5 flex items-center gap-2">
              <span className="inline-block w-2 h-2 bg-[#1dff00] rounded-full animate-pulse shadow-[0_0_8px_rgba(29,255,0,0.6)]" />
              Create professional, tailored cover letters with AI assistance
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 overflow-x-auto">
          <Button 
            variant="outline" 
            onClick={() => setInlineEdit((v)=>!v)} 
            className={`rounded-xl whitespace-nowrap h-11 px-4 transition-all duration-200 ${
              inlineEdit 
                ? 'bg-gradient-to-br from-[#1dff00]/20 to-[#1dff00]/10 border-2 border-[#1dff00] text-[#1dff00] shadow-[0_0_30px_rgba(29,255,0,0.3)] scale-105' 
                : 'border-[#1dff00]/30 hover:border-[#1dff00]/50 hover:bg-[#1dff00]/5 hover:scale-105 hover:shadow-[0_0_20px_rgba(29,255,0,0.15)]'
            }`}
          > 
            <Pencil className="w-4 h-4 mr-2"/> 
            {inlineEdit ? 'Live Edit: On' : 'Enable Live Edit'} 
          </Button>
          <Button 
            variant="outline" 
            disabled={aiLoading || subscriptionTier === 'Free'} 
            onClick={aiPolish} 
            className="rounded-xl whitespace-nowrap h-11 px-4 border-[#1dff00]/30 hover:border-[#1dff00]/50 hover:bg-gradient-to-br hover:from-[#1dff00]/10 hover:to-[#1dff00]/5 hover:scale-105 hover:shadow-[0_0_25px_rgba(29,255,0,0.2)] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all duration-200"
            title={subscriptionTier === 'Free' ? 'Pro/Ultimate subscription required' : 'Polish existing content with AI'}
          > 
            {subscriptionTier === 'Free' && <Lock className="w-3.5 h-3.5 mr-1.5 text-[#1dff00]/60" />}
            <Wand2 className={`w-4 h-4 mr-2 ${aiLoading ? 'animate-pulse text-[#1dff00]' : ''}`}/> 
            {aiLoading ? 'Polishing…' : 'AI Polish'}
            {subscriptionTier === 'Free' && <span className="ml-1.5 text-[10px] opacity-60 uppercase tracking-wide">Pro</span>}
          </Button>
          <Button 
            variant="outline" 
            disabled={aiLoading || subscriptionTier === 'Free'} 
            onClick={aiWriteFull} 
            className="rounded-xl whitespace-nowrap h-11 px-4 border-[#1dff00]/30 hover:border-[#1dff00]/50 hover:bg-gradient-to-br hover:from-[#1dff00]/10 hover:to-[#1dff00]/5 hover:scale-105 hover:shadow-[0_0_25px_rgba(29,255,0,0.2)] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all duration-200"
            title={subscriptionTier === 'Free' ? 'Pro/Ultimate subscription required' : 'Generate complete cover letter with AI'}
          > 
            {subscriptionTier === 'Free' && <Lock className="w-3.5 h-3.5 mr-1.5 text-[#1dff00]/60" />}
            <Wand2 className={`w-4 h-4 mr-2 ${aiLoading ? 'animate-pulse text-[#1dff00]' : ''}`}/> 
            {aiLoading ? 'Writing…' : 'AI Generate'}
            {subscriptionTier === 'Free' && <span className="ml-1.5 text-[10px] opacity-60 uppercase tracking-wide">Pro</span>}
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setExportOpen(true)} 
            className="rounded-xl whitespace-nowrap h-11 px-4 border-[#1dff00]/30 hover:border-[#1dff00]/50 hover:bg-gradient-to-br hover:from-[#1dff00]/10 hover:to-[#1dff00]/5 hover:scale-105 hover:shadow-[0_0_25px_rgba(29,255,0,0.2)] transition-all duration-200"
          > 
            <Download className="w-4 h-4 mr-2"/> 
            Export
          </Button>
        </div>
      </div>

      {exportOpen && (
        <div id="cover-actions" data-tour="cover-actions" className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/85 backdrop-blur-xl" onClick={() => setExportOpen(false)} />
          <div role="dialog" aria-modal="true" className="relative z-10 w-full max-w-lg rounded-2xl border border-[#1dff00]/30 bg-gradient-to-br from-[#0a0a0a]/98 to-[#0f0f0f]/98 shadow-[0_0_50px_rgba(29,255,0,0.2)] backdrop-blur-xl p-6 animate-in fade-in-0 zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-white via-white/95 to-[#1dff00] bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(29,255,0,0.3)]">Export Cover Letter</h2>
                <p className="text-xs text-gray-400 mt-2 flex items-center gap-2">
                  <span className="inline-block w-1.5 h-1.5 bg-[#1dff00] rounded-full" />
                  Choose your preferred format below
                </p>
              </div>
              <Button variant="ghost" size="sm" className="h-10 w-10 p-0 rounded-xl hover:bg-[#1dff00]/10 hover:text-[#1dff00] hover:scale-110 transition-all" onClick={() => setExportOpen(false)}>
                <X className="w-5 h-5"/>
              </Button>
            </div>
            <div className="grid gap-3.5">
              <Button 
                variant="outline" 
                disabled={!!exportBusy} 
                data-active={lastExport==='txt'} 
                className="justify-start rounded-xl h-14 border-[#1dff00]/30 hover:border-[#1dff00]/50 hover:bg-gradient-to-br hover:from-[#1dff00]/10 hover:to-[#1dff00]/5 hover:shadow-[0_0_25px_rgba(29,255,0,0.15)] data-[active=true]:border-[#1dff00] data-[active=true]:bg-gradient-to-br data-[active=true]:from-[#1dff00]/15 data-[active=true]:to-[#1dff00]/5 data-[active=true]:shadow-[0_0_30px_rgba(29,255,0,0.2)] transition-all group" 
                onClick={async () => { exportTxt(); setExportOpen(false); }}
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#1dff00]/10 border border-[#1dff00]/30 mr-3 group-hover:bg-[#1dff00]/20 group-hover:border-[#1dff00]/50 group-hover:scale-110 transition-all">
                  <FileText className="w-5 h-5 text-[#1dff00]"/> 
                </div>
                <div className="flex-1 text-left">
                  <span className="font-semibold text-white">Download .TXT</span>
                  <p className="text-xs text-gray-400 mt-0.5">Plain text format</p>
                </div>
                {lastExport==='txt' && <span className="ml-auto text-[10px] uppercase tracking-wider font-bold text-[#1dff00] px-3 py-1.5 bg-[#1dff00]/15 rounded-lg border border-[#1dff00]/30">Last</span>}
              </Button>
              <Button 
                variant="outline" 
                disabled={!!exportBusy} 
                data-active={lastExport==='pdf'} 
                className="justify-start rounded-xl h-14 border-[#1dff00]/30 hover:border-[#1dff00]/50 hover:bg-gradient-to-br hover:from-[#1dff00]/10 hover:to-[#1dff00]/5 hover:shadow-[0_0_25px_rgba(29,255,0,0.15)] data-[active=true]:border-[#1dff00] data-[active=true]:bg-gradient-to-br data-[active=true]:from-[#1dff00]/15 data-[active=true]:to-[#1dff00]/5 data-[active=true]:shadow-[0_0_30px_rgba(29,255,0,0.2)] transition-all group" 
                onClick={async () => { await exportPdf(); setExportOpen(false); }}
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#1dff00]/10 border border-[#1dff00]/30 mr-3 group-hover:bg-[#1dff00]/20 group-hover:border-[#1dff00]/50 group-hover:scale-110 transition-all">
                  <svg className="w-5 h-5 text-[#1dff00]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                </div>
                <div className="flex-1 text-left">
                  <span className="font-semibold text-white">Export PDF</span>
                  <p className="text-xs text-gray-400 mt-0.5">Professional document format</p>
                </div>
                {exportBusy==='pdf' && <span className="ml-auto text-[10px] text-[#1dff00] animate-pulse flex items-center gap-1.5"><span className="inline-block w-1.5 h-1.5 bg-[#1dff00] rounded-full animate-pulse" />Processing…</span>}
                {lastExport==='pdf' && exportBusy!=='pdf' && <span className="ml-auto text-[10px] uppercase tracking-wider font-bold text-[#1dff00] px-3 py-1.5 bg-[#1dff00]/15 rounded-lg border border-[#1dff00]/30">Last</span>}
              </Button>
              <Button 
                variant="outline" 
                disabled={!!exportBusy} 
                data-active={lastExport==='docx'} 
                className="justify-start rounded-xl h-14 border-[#1dff00]/30 hover:border-[#1dff00]/50 hover:bg-gradient-to-br hover:from-[#1dff00]/10 hover:to-[#1dff00]/5 hover:shadow-[0_0_25px_rgba(29,255,0,0.15)] data-[active=true]:border-[#1dff00] data-[active=true]:bg-gradient-to-br data-[active=true]:from-[#1dff00]/15 data-[active=true]:to-[#1dff00]/5 data-[active=true]:shadow-[0_0_30px_rgba(29,255,0,0.2)] transition-all group" 
                onClick={async () => { await exportDocx(); setExportOpen(false); }}
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#1dff00]/10 border border-[#1dff00]/30 mr-3 group-hover:bg-[#1dff00]/20 group-hover:border-[#1dff00]/50 group-hover:scale-110 transition-all">
                  <FileType className="w-5 h-5 text-[#1dff00]"/> 
                </div>
                <div className="flex-1 text-left">
                  <span className="font-semibold text-white">Export DOCX</span>
                  <p className="text-xs text-gray-400 mt-0.5">Microsoft Word format</p>
                </div>
                {exportBusy==='docx' && <span className="ml-auto text-[10px] text-[#1dff00] animate-pulse flex items-center gap-1.5"><span className="inline-block w-1.5 h-1.5 bg-[#1dff00] rounded-full animate-pulse" />Processing…</span>}
                {lastExport==='docx' && exportBusy!=='docx' && <span className="ml-auto text-[10px] uppercase tracking-wider font-bold text-[#1dff00] px-3 py-1.5 bg-[#1dff00]/15 rounded-lg border border-[#1dff00]/30">Last</span>}
              </Button>
              <div className="h-px bg-gradient-to-r from-transparent via-[#1dff00]/30 to-transparent my-2" />
              <Button 
                variant="outline" 
                disabled={!!exportBusy} 
                className="justify-start rounded-xl h-12 border-white/20 hover:border-white/30 hover:bg-white/5 hover:shadow-[0_0_20px_rgba(255,255,255,0.05)] transition-all group" 
                onClick={() => { printLetter(); setExportOpen(false); }}
              >
                <Printer className="w-5 h-5 mr-3 group-hover:scale-110 transition-transform"/> 
                <span className="font-medium">Print Preview</span>
              </Button>
              <Button 
                variant="outline" 
                disabled={!!exportBusy} 
                className="justify-start rounded-xl h-12 border-white/20 hover:border-white/30 hover:bg-white/5 hover:shadow-[0_0_20px_rgba(255,255,255,0.05)] transition-all group" 
                onClick={() => { copyPlain(); setExportOpen(false); }}
              >
                {copied ? <Check className="w-5 h-5 mr-3 text-green-400 group-hover:scale-110 transition-transform"/> : <Share2 className="w-5 h-5 mr-3 rotate-90 group-hover:scale-110 transition-transform"/>} 
                <span className="font-medium">{copied ? 'Copied!' : 'Copy Plain Text'}</span>
              </Button>
              <Button 
                variant="outline" 
                disabled={!!exportBusy} 
                className="justify-start rounded-xl h-12 border-white/20 hover:border-white/30 hover:bg-white/5 hover:shadow-[0_0_20px_rgba(255,255,255,0.05)] transition-all group" 
                onClick={() => { share(); setExportOpen(false); }}
              >
                <Share2 className="w-5 h-5 mr-3 group-hover:scale-110 transition-transform"/> 
                <span className="font-medium">Share (System)</span>
              </Button>
            </div>
            {exportBusy && (
              <div className="mt-4 pt-4 border-t border-[#1dff00]/20">
                <p className="text-xs text-[#1dff00] text-center flex items-center justify-center gap-2">
                  <span className="inline-block w-2 h-2 bg-[#1dff00] rounded-full animate-pulse" />
                  Exporting your cover letter...
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Workspace */}
      <div id="cover-main-layout" className="grid gap-6 grid-cols-1 xl:grid-cols-[460px_minmax(0,1fr)] max-w-[1800px] mx-auto w-full">
        {/* Left: Controls */}
        <Card id="cover-meta-panel" data-tour="cover-meta-panel" className="p-6 rounded-2xl bg-gradient-to-br from-[#0a0a0a]/98 to-[#0f0f0f]/98 border border-[#1dff00]/30 shadow-[0_0_40px_rgba(29,255,0,0.15)] backdrop-blur-xl hover:shadow-[0_0_50px_rgba(29,255,0,0.2)] transition-all">
          <div className="grid gap-6">
            {/* Saved Letters (Library) */}
            <div className="grid gap-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-white flex items-center gap-2.5">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#1dff00]/10 border border-[#1dff00]/30">
                    <svg className="w-4 h-4 text-[#1dff00]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                  </div>
                  Save Cover Letter
                </label>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="rounded-xl h-9 px-4 border-[#1dff00]/30 hover:border-[#1dff00]/50 hover:bg-[#1dff00]/5 hover:scale-105 transition-all" 
                  onClick={() => { setCurrentLibId(null); setLibName(""); }}
                >
                  New
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <input 
                  value={libName} 
                  onChange={(e)=>setLibName(e.target.value)} 
                  placeholder="Enter letter name" 
                  className="w-full rounded-xl border border-[#1dff00]/20 bg-gradient-to-br from-white/5 to-white/[0.02] px-4 py-3 text-sm outline-none focus:border-[#1dff00]/50 focus:ring-2 focus:ring-[#1dff00]/20 transition-all placeholder:text-gray-500 h-12" 
                />
                <div className="grid grid-cols-2 gap-3">
                  <Button 
                    variant="outline" 
                    onClick={() => saveToLibrary()} 
                    className="rounded-xl h-11 border-[#1dff00]/30 hover:border-[#1dff00]/50 hover:bg-gradient-to-br hover:from-[#1dff00]/10 hover:to-[#1dff00]/5 hover:shadow-[0_0_25px_rgba(29,255,0,0.15)] hover:scale-105 transition-all"
                  >
                    {currentLibId ? 'Update' : 'Save'}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => saveToLibrary(libName)} 
                    className="rounded-xl h-11 border-white/20 hover:border-white/30 hover:bg-white/5 hover:scale-105 transition-all"
                  >
                    Save As New
                  </Button>
                </div>
              </div>
              <p className="text-xs text-gray-400 bg-gradient-to-br from-[#1dff00]/10 to-[#1dff00]/5 rounded-xl p-3.5 border border-[#1dff00]/20">
                {library.length === 0 
                  ? '💡 No saved letters yet. Name and save your letter to access it from the cover letters page.' 
                  : `✓ ${library.length} letter${library.length === 1 ? '' : 's'} saved. View all from the cover letters page.`
                }
              </p>
            </div>
            {/* Sender */}
            <div className="grid gap-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-white flex items-center gap-2.5">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#1dff00]/10 border border-[#1dff00]/30">
                    <svg className="w-4 h-4 text-[#1dff00]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  Sender Information
                </label>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="rounded-xl h-9 px-3 text-xs border-[#1dff00]/30 hover:border-[#1dff00]/50 hover:bg-[#1dff00]/5 hover:scale-105 transition-all" 
                    onClick={loadProfile}
                  >
                    Use Profile
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="rounded-xl h-9 px-3 text-xs border-white/20 hover:border-white/30 hover:bg-white/5 hover:scale-105 transition-all" 
                    onClick={() => { setSenderName(""); setSenderEmail(""); setSenderPhone(""); setSenderAddress(""); }}
                  >
                    Clear
                  </Button>
                </div>
              </div>
              <input 
                value={senderName} 
                onChange={(e)=>setSenderName(e.target.value)} 
                placeholder="Your name" 
                className="w-full rounded-xl border border-[#1dff00]/20 bg-gradient-to-br from-white/5 to-white/[0.02] px-4 py-3 text-sm outline-none focus:border-[#1dff00]/50 focus:ring-2 focus:ring-[#1dff00]/20 transition-all placeholder:text-gray-500 h-12" 
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input 
                  value={senderEmail} 
                  onChange={(e)=>setSenderEmail(e.target.value)} 
                  placeholder="Email" 
                  className="w-full rounded-xl border border-[#1dff00]/20 bg-gradient-to-br from-white/5 to-white/[0.02] px-4 py-3 text-sm outline-none focus:border-[#1dff00]/50 focus:ring-2 focus:ring-[#1dff00]/20 transition-all placeholder:text-gray-500 h-12" 
                />
                <input 
                  value={senderPhone} 
                  onChange={(e)=>setSenderPhone(e.target.value)} 
                  placeholder="Phone" 
                  className="w-full rounded-xl border border-[#1dff00]/20 bg-gradient-to-br from-white/5 to-white/[0.02] px-4 py-3 text-sm outline-none focus:border-[#1dff00]/50 focus:ring-2 focus:ring-[#1dff00]/20 transition-all placeholder:text-gray-500 h-12" 
                />
              </div>
              <input 
                value={senderAddress} 
                onChange={(e)=>setSenderAddress(e.target.value)} 
                placeholder="Address" 
                className="w-full rounded-xl border border-[#1dff00]/20 bg-gradient-to-br from-white/5 to-white/[0.02] px-4 py-3 text-sm outline-none focus:border-[#1dff00]/50 focus:ring-2 focus:ring-[#1dff00]/20 transition-all placeholder:text-gray-500 h-12" 
              />
            </div>

            {/* Recipient */}
            <div className="grid gap-3">
              <label className="text-sm font-semibold text-white flex items-center gap-2.5">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#1dff00]/10 border border-[#1dff00]/30">
                  <svg className="w-4 h-4 text-[#1dff00]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                Recipient Information
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input 
                  value={recipient} 
                  onChange={(e)=>setRecipient(e.target.value)} 
                  placeholder="Recipient name" 
                  className="w-full rounded-xl border border-[#1dff00]/20 bg-gradient-to-br from-white/5 to-white/[0.02] px-4 py-3 text-sm outline-none focus:border-[#1dff00]/50 focus:ring-2 focus:ring-[#1dff00]/20 transition-all placeholder:text-gray-500 h-12" 
                />
                <input 
                  value={recipientTitle} 
                  onChange={(e)=>setRecipientTitle(e.target.value)} 
                  placeholder="Recipient title" 
                  className="w-full rounded-xl border border-[#1dff00]/20 bg-gradient-to-br from-white/5 to-white/[0.02] px-4 py-3 text-sm outline-none focus:border-[#1dff00]/50 focus:ring-2 focus:ring-[#1dff00]/20 transition-all placeholder:text-gray-500 h-12" 
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input 
                  value={company} 
                  onChange={(e)=>setCompany(e.target.value)} 
                  placeholder="Company" 
                  className="w-full rounded-xl border border-[#1dff00]/20 bg-gradient-to-br from-white/5 to-white/[0.02] px-4 py-3 text-sm outline-none focus:border-[#1dff00]/50 focus:ring-2 focus:ring-[#1dff00]/20 transition-all placeholder:text-gray-500 h-12" 
                />
                <input 
                  value={recipientAddress} 
                  onChange={(e)=>setRecipientAddress(e.target.value)} 
                  placeholder="Company address" 
                  className="w-full rounded-xl border border-[#1dff00]/20 bg-gradient-to-br from-white/5 to-white/[0.02] px-4 py-3 text-sm outline-none focus:border-[#1dff00]/50 focus:ring-2 focus:ring-[#1dff00]/20 transition-all placeholder:text-gray-500 h-12" 
                />
              </div>
            </div>

            {/* Header/meta */}
            <div className="grid gap-3">
              <label className="text-sm font-semibold text-white flex items-center gap-2.5">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#1dff00]/10 border border-[#1dff00]/30">
                  <svg className="w-4 h-4 text-[#1dff00]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                Letter Details
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="relative">
                  <input 
                    type="date" 
                    value={date} 
                    onChange={(e)=>setDate(e.target.value)} 
                    className="w-full rounded-xl border border-[#1dff00]/20 bg-gradient-to-br from-white/5 to-white/[0.02] px-4 py-3 text-sm outline-none focus:border-[#1dff00]/50 focus:ring-2 focus:ring-[#1dff00]/20 transition-all h-12" 
                  />
                </div>
                <input 
                  value={subject} 
                  onChange={(e)=>setSubject(e.target.value)} 
                  placeholder="Subject (optional)" 
                  className="w-full rounded-xl border border-[#1dff00]/20 bg-gradient-to-br from-white/5 to-white/[0.02] px-4 py-3 text-sm outline-none focus:border-[#1dff00]/50 focus:ring-2 focus:ring-[#1dff00]/20 transition-all placeholder:text-gray-500 h-12" 
                />
              </div>
              <input 
                value={salutation} 
                onChange={(e)=>setSalutation(e.target.value)} 
                placeholder="Salutation (e.g., Dear Hiring Manager,)" 
                className="w-full rounded-xl border border-[#1dff00]/20 bg-gradient-to-br from-white/5 to-white/[0.02] px-4 py-3 text-sm outline-none focus:border-[#1dff00]/50 focus:ring-2 focus:ring-[#1dff00]/20 transition-all placeholder:text-gray-500 h-12" 
              />
            </div>

            {/* Closing/signature */}
            <div className="grid gap-3">
              <label className="text-sm font-semibold text-white flex items-center gap-2.5">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#1dff00]/10 border border-[#1dff00]/30">
                  <svg className="w-4 h-4 text-[#1dff00]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                Closing & Signature
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input 
                  value={closing} 
                  onChange={(e)=>setClosing(e.target.value)} 
                  placeholder="Closing (e.g., Best regards,)" 
                  className="w-full rounded-xl border border-[#1dff00]/20 bg-gradient-to-br from-white/5 to-white/[0.02] px-4 py-3 text-sm outline-none focus:border-[#1dff00]/50 focus:ring-2 focus:ring-[#1dff00]/20 transition-all placeholder:text-gray-500 h-12" 
                />
                <input 
                  value={signatureName} 
                  onChange={(e)=>setSignatureName(e.target.value)} 
                  placeholder="Signature name" 
                  className="w-full rounded-xl border border-[#1dff00]/20 bg-gradient-to-br from-white/5 to-white/[0.02] px-4 py-3 text-sm outline-none focus:border-[#1dff00]/50 focus:ring-2 focus:ring-[#1dff00]/20 transition-all placeholder:text-gray-500 h-12" 
                />
              </div>
            </div>

            {/* AI Config */}
            <div className="grid gap-4 p-5 rounded-xl border border-[#1dff00]/20 bg-gradient-to-br from-[#1dff00]/5 to-transparent">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#1dff00] flex items-center gap-2">
                <Wand2 className="w-4 h-4" />
                AI Settings
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-gray-400 mb-1.5 block">Role</label>
                  <input value={role} onChange={(e)=>setRole(e.target.value)} className="w-full rounded-xl border border-[#1dff00]/20 bg-gradient-to-br from-white/5 to-white/[0.02] px-3 py-2.5 text-sm outline-none focus:border-[#1dff00]/50 focus:ring-2 focus:ring-[#1dff00]/20 transition-all h-11" placeholder="e.g., Software Engineer" />
                </div>
                <div>
                  <label className="text-[11px] text-gray-400 mb-1.5 block">Tone</label>
                  <select value={tone} onChange={(e)=>setTone(e.target.value as any)} className="w-full rounded-xl border border-[#1dff00]/20 bg-gradient-to-br from-white/5 to-white/[0.02] px-3 py-2.5 text-sm outline-none focus:border-[#1dff00]/50 focus:ring-2 focus:ring-[#1dff00]/20 transition-all h-11">
                    <option value="professional">Professional</option>
                    <option value="friendly">Friendly</option>
                    <option value="enthusiastic">Enthusiastic</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-gray-400 mb-1.5 block">Length</label>
                  <select value={lengthPref} onChange={(e)=>setLengthPref(e.target.value as any)} className="w-full rounded-xl border border-[#1dff00]/20 bg-gradient-to-br from-white/5 to-white/[0.02] px-3 py-2.5 text-sm outline-none focus:border-[#1dff00]/50 focus:ring-2 focus:ring-[#1dff00]/20 transition-all h-11">
                    <option value="short">Short</option>
                    <option value="medium">Medium</option>
                    <option value="long">Long</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[11px] text-gray-400 mb-1.5 block">Job Description (optional)</label>
                <textarea value={jobDescription} onChange={(e)=>setJobDescription(e.target.value)} rows={4} className="w-full rounded-xl border border-[#1dff00]/20 bg-gradient-to-br from-white/5 to-white/[0.02] px-4 py-3 text-sm outline-none focus:border-[#1dff00]/50 focus:ring-2 focus:ring-[#1dff00]/20 transition-all" placeholder="Paste job description here to tailor the letter..." />
              </div>
            </div>

            {/* Body controls */}
            <div className="grid gap-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-white">Body (raw)</label>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="rounded-xl h-9 px-3 border-[#1dff00]/30 hover:border-[#1dff00]/50 hover:bg-[#1dff00]/5 hover:scale-105 transition-all" onClick={splitContentIntoParagraphs}>Split into paragraphs</Button>
                  <span className="text-[11px] text-gray-400 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10">{content.length} chars</span>
                </div>
              </div>
              <textarea id="cover-letter-content" value={content} onChange={(e)=>setContent(e.target.value)} rows={8} className="w-full rounded-xl border border-[#1dff00]/20 bg-gradient-to-br from-white/5 to-white/[0.02] px-4 py-3 text-sm outline-none focus:border-[#1dff00]/50 focus:ring-2 focus:ring-[#1dff00]/20 transition-all" placeholder="Write or paste your cover letter here..." />
            </div>

            <div className="grid gap-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-white">Paragraphs (advanced)</label>
                <Button variant="outline" size="sm" className="rounded-xl h-9 px-3 border-[#1dff00]/30 hover:border-[#1dff00]/50 hover:bg-[#1dff00]/5 hover:scale-105 transition-all" onClick={addParagraph}><Plus className="w-4 h-4 mr-1.5"/>Add paragraph</Button>
              </div>
              <div className="grid gap-3">
                {paragraphs.map((p, idx) => (
                  <div key={idx} className="rounded-xl border border-[#1dff00]/20 bg-gradient-to-br from-white/5 to-white/[0.02] overflow-hidden hover:border-[#1dff00]/30 transition-all">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-[#1dff00]/20 bg-black/20">
                      <span className="text-[11px] font-medium text-gray-300">Paragraph {idx + 1}</span>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-[#1dff00]/10 hover:text-[#1dff00] disabled:opacity-30 transition-all" onClick={() => moveParagraphUp(idx)} disabled={idx === 0}><ArrowUp className="w-4 h-4"/></Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-[#1dff00]/10 hover:text-[#1dff00] disabled:opacity-30 transition-all" onClick={() => moveParagraphDown(idx)} disabled={idx === paragraphs.length - 1}><ArrowDown className="w-4 h-4"/></Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-400 hover:bg-red-500/10 hover:text-red-500 transition-all" onClick={() => removeParagraph(idx)}><Trash2 className="w-4 h-4"/></Button>
                      </div>
                    </div>
                    <textarea value={p} onChange={(e)=>updateParagraph(idx, e.target.value)} rows={4} className="w-full bg-transparent px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#1dff00]/20" placeholder="Write paragraph..." />
                  </div>
                ))}
                {!paragraphs.length && (
                  <p className="text-xs text-gray-400 text-center py-6 px-4 rounded-xl border border-dashed border-white/10 bg-white/[0.02]">No paragraphs added yet. Use AI, paste into the raw body, or click "Add paragraph".</p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl border border-white/10 bg-white/[0.02]">
              <Button variant="outline" size="sm" className="h-10 w-10 p-0 rounded-xl hover:bg-white/5 hover:scale-110 transition-all" onClick={zoomOut}>
                <Minus className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" className="h-10 w-10 p-0 rounded-xl hover:bg-white/5 hover:scale-110 transition-all" onClick={zoomIn}>
                <Plus className="w-4 h-4" />
              </Button>
              <span className="text-xs text-gray-400 px-3 py-1.5 rounded-lg bg-white/5">Font: {fontSize}px</span>
              <div className="ml-auto flex items-center gap-2">
                <Button variant="outline" size="sm" className="rounded-xl h-9 px-4 border-red-500/40 text-red-400 hover:bg-red-500/10 hover:border-red-500/60 transition-all" onClick={clearDraft}>Clear</Button>
                {savedAt && <span className="text-[11px] text-gray-400 flex items-center gap-1.5"><span className="inline-block w-1.5 h-1.5 bg-[#1dff00] rounded-full" />Saved {new Date(savedAt).toLocaleTimeString()}</span>}
              </div>
            </div>
          </div>
        </Card>

        {/* Right: Preview */}
        <Card id="cover-editor" data-tour="cover-editor" className="p-4 sm:p-6 md:p-8 overflow-hidden rounded-2xl bg-gradient-to-br from-[#0a0a0a]/98 to-[#0f0f0f]/98 border border-[#1dff00]/30 shadow-[0_0_40px_rgba(29,255,0,0.15)] backdrop-blur-xl">
          <div ref={previewRef} className="mx-auto w-full max-w-[800px] rounded-xl border border-white/10 bg-white text-black shadow-[0_0_50px_rgba(0,0,0,0.3)] hover:shadow-[0_0_60px_rgba(0,0,0,0.4)] transition-all">
            <div className="p-8 sm:p-10 md:p-12" style={{ fontSize: `${fontSize}px`, lineHeight: 1.6 }}>
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

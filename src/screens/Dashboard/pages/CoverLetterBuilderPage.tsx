import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Download,
  Wand2,
  Share2,
  Printer,
  FileText,
  Pencil,
  Plus,
  Minus,
  Trash2,
  ArrowUp,
  ArrowDown,
  X,
  Lock,
  FileType,
  Edit2,
  Check,
  Loader2,
  Briefcase,
  ChevronDown,
  PenLine,
  Eye,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
// Fix Supabase import
import { createClient } from "@/lib/supabaseClient";
// Fix Toast import (use local shadcn/ui toast instead of sonner)
import { useToast } from "@/components/ui/toast";
// Fix Store import
import { useArtboardStore } from "@/store/artboard";
// Export libraries are loaded only when needed to keep the default bundle lighter.
import { polishContent } from "@/services/ai/polishContent";
import { generateCoverLetterViaEdge } from "@/services/ai/generateCoverLetter";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { useSubscriptionTier } from "@/hooks/useSubscriptionTier";
import { hasSubscriptionAccess } from "@/lib/subscriptionAccess";
import { useJobsQueue } from "@/hooks/useJobsQueue";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const supabase = createClient();

// Local implementation of saveAs to avoid missing 'file-saver' types/dependency
const saveAs = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const CoverLetterBuilderPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { success, error: toastErrorFn } = useToast();
  const toastError = (title: string, desc: string) => toastErrorFn(title, desc);
  const toastSuccess = (title: string, desc: string) => success(title, desc);

  // Global State
  const coverLetter = useArtboardStore((state) => state.coverLetter);
  const setCoverLetter = useArtboardStore((state) => state.setCoverLetter);
  const setCoverLetterField = useArtboardStore(
    (state) => state.setCoverLetterField,
  );
  const setNested = useArtboardStore((state) => state.setCoverLetterNested);
  const setCoverLetterTitle = useArtboardStore(
    (state) => state.setCoverLetterTitle,
  );
  const setCoverLetterId = useArtboardStore((state) => state.setCoverLetterId);
  const resetCoverLetter = useArtboardStore((state) => state.resetCoverLetter);

  // Destructure for easier access
  const {
    id,
    role,
    company,
    jobDescription,
    tone,
    lengthPref,
    sender,
    recipient,
    content,
    typography,
  } = coverLetter;

  // Helper setters
  const setRole = (val: string) => setCoverLetterField("role", val);
  const setCompany = (val: string) => setCoverLetterField("company", val);
  const setJobDescription = (val: string) =>
    setCoverLetterField("jobDescription", val);
  const setTone = (val: any) => setCoverLetterField("tone", val);
  const setLengthPref = (val: any) => setCoverLetterField("lengthPref", val);

  const setSenderName = (val: string) => setNested("sender", "name", val);
  const setSenderEmail = (val: string) => setNested("sender", "email", val);
  const setSenderPhone = (val: string) => setNested("sender", "phone", val);
  const setSenderAddress = (val: string) => setNested("sender", "address", val);

  const setRecipientName = (val: string) => setNested("recipient", "name", val);
  const setRecipientTitle = (val: string) =>
    setNested("recipient", "title", val);

  const setRecipientAddress = (val: string) =>
    setNested("recipient", "address", val);

  const setDate = (val: string) => setNested("content", "date", val);
  const setSubject = (val: string) => setNested("content", "subject", val);
  const setSalutation = (val: string) =>
    setNested("content", "salutation", val);
  const setParagraphs = (val: string[]) =>
    setNested("content", "paragraphs", val);
  const setClosing = (val: string) => setNested("content", "closing", val);
  const setSignatureName = (val: string) =>
    setNested("content", "signature", val);
  const setContentString = (val: string) =>
    setNested("content", "rawBody", val);

  const setFontSize = (val: number) => setNested("typography", "fontSize", val);

  // Local UI State
  const [libName, setLibName] = useState("");
  const [library, setLibrary] = useState<any[]>([]);
  const [currentLibId, setCurrentLibId] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  // Remove unused savedAt if not used, or use it
  // const [savedAt, setSavedAt] = useState<string | null>(null);
  const { subscriptionTier, loadingTier } = useSubscriptionTier();
  const hasCoverLetterAiAccess = hasSubscriptionAccess(
    subscriptionTier,
    "Basics",
  );
  const [exportOpen, setExportOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState<string | null>(null);
  // Remove unused lastExport
  // const [lastExport, setLastExport] = useState<string | null>(null);
  // Remove unused copied
  // const [copied, setCopied] = useState(false);
  const [inlineEdit, setInlineEdit] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [mobileView, setMobileView] = useState<"editor" | "preview">("editor");
  const [isMobile, setIsMobile] = useState(false);

  // Responsive Check
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1280); // xl is 1280px
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  type QueuedJobPick = {
    id: string;
    title: string;
    company: string;
    description: string;
  };

  const { data: queueJobsRaw = [], isLoading: jobsQueueLoading } =
    useJobsQueue<QueuedJobPick>({
      scope: null,
      mapJob: (row: Record<string, unknown>) => ({
        id: String(row.id ?? ""),
        title: String(row.title ?? "Untitled role"),
        company: String(row.company ?? ""),
        description: typeof row.description === "string" ? row.description : "",
      }),
    });

  const jobsWithDescription = useMemo(
    () => queueJobsRaw.filter((j) => j.description.trim().length > 0),
    [queueJobsRaw],
  );

  const applyJobDescriptionFromQueue = (job: QueuedJobPick) => {
    setJobDescription(job.description);
    toastSuccess(
      "Job description loaded",
      [job.title, job.company].filter(Boolean).join(" - "),
    );
  };
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const routeId = location.pathname.split("/")[4] || null;
  const activeId = currentLibId || routeId || id;

  const normalizeCoverLetterPayload = (record: any) => {
    const payload = record?.data;
    if (payload && typeof payload === "object" && !Array.isArray(payload) && Object.keys(payload).length > 2) {
      return payload as Record<string, unknown>;
    }
    if (record) {
      const contentStr = record.content || "";
      const paragraphs = typeof contentStr === "string" && contentStr.trim()
        ? contentStr.split(/\n\s*\n+/).map((p: any) => p.trim()).filter(Boolean)
        : [];
      return {
        id: record.id || "",
        title: record.name || "Untitled Cover Letter",
        slug: record.slug || "untitled-cover-letter",
        tags: record.tags || [],
        role: record.role || "",
        company: record.company || "",
        jobDescription: record.job_description || "",
        tone: record.tone || "professional",
        lengthPref: record.length_pref || "medium",
        sender: {
          name: record.sender_name || "",
          email: record.sender_email || "",
          phone: record.sender_phone || "",
          address: record.sender_address || "",
        },
        recipient: {
          name: record.recipient || "",
          title: record.recipient_title || "",
          company: record.company || "",
          address: record.recipient_address || "",
        },
        content: {
          date: record.date || new Date(record.created_at || Date.now()).toISOString().slice(0, 10),
          subject: record.subject || (record.role ? `Application for ${record.role}` : ""),
          salutation: record.salutation || "Dear Hiring Manager,",
          paragraphs: paragraphs,
          closing: record.closing || "Best regards,",
          signature: record.signature_name || "",
          rawBody: contentStr,
        },
        typography: {
          fontSize: record.font_size || 16,
        }
      } as Record<string, unknown>;
    }
    return null;
  };

  // Derived
  const finalBody = content.paragraphs.length
    ? content.paragraphs.join("\n\n")
    : content.rawBody;
  const coverLetterPayload = {
    ...coverLetter,
    id: activeId || coverLetter.id || "",
    title: coverLetter.title || "Untitled Cover Letter",
  };

  const applyLetterRecord = (record: any) => {
    const payload = normalizeCoverLetterPayload(record);
    if (!payload) return;
    const resolvedTitle =
      record?.name || payload.title || "Untitled Cover Letter";
    setCoverLetterId(record.id);
    setCoverLetterTitle(resolvedTitle);
    setCurrentLibId(record.id);
    setLibName(resolvedTitle);
    setCoverLetter({ ...payload, id: record.id, title: resolvedTitle });
  };

  // --- Effects ---

  // Load Initial Data
  useEffect(() => {
    const loadData = async () => {
      if (!routeId) {
        resetCoverLetter();
        setCurrentLibId(null);
        setLibName("");
        setCoverLetterId("");
        return;
      }

      try {
        const { data, error } = await supabase
          .from("cover_letters")
          .select("*")
          .eq("id", routeId)
          .single();

        if (error) throw error;
        if (data) {
          applyLetterRecord(data);
        }
      } catch (error) {
        console.error("Error loading cover letter:", error);
        toastError("Load failed", "Could not load cover letter");
        navigate("/dashboard/cover-letter");
      }
    };
    loadData();
  }, [navigate, resetCoverLetter, routeId, setCoverLetterId]);

  useEffect(() => {
    const loadLibrary = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from("cover_letters")
          .select("*")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false });

        if (error) throw error;
        const nextLibrary = data || [];
        setLibrary(nextLibrary);

        if (activeId) {
          const activeLetter = nextLibrary.find(
            (entry: any) => entry.id === activeId,
          );
          if (activeLetter) {
            setCurrentLibId(activeLetter.id);
            setLibName(activeLetter.name || activeLetter?.data?.title || "");
          }
        }
      } catch (error) {
        console.error("Error loading cover letter library:", error);
      }
    };
    loadLibrary();
  }, [activeId]);

  // Save Function
  const handleSave = async () => {
    if (!activeId) {
      await saveToLibrary();
      return;
    }

    setIsSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Please sign in to save your cover letter.");

      const savedAt = new Date().toISOString();
      const savedName = coverLetter.title || libName || "Untitled Cover Letter";
      const { error } = await supabase
        .from("cover_letters")
        .update({
          name: savedName,
          slug: coverLetter.slug,
          tags: coverLetter.tags,
          data: coverLetterPayload,
          updated_at: savedAt,
        })
        .eq("id", activeId);

      if (error) throw error;
      setCurrentLibId(activeId);
      setLibName(savedName);
      setLastSaved(new Date(savedAt));
      setLibrary((prev) =>
        prev.map((entry) =>
          entry.id === activeId
            ? {
                ...entry,
                name: savedName,
                slug: coverLetter.slug,
                tags: coverLetter.tags,
                data: coverLetterPayload,
                updated_at: savedAt,
              }
            : entry,
        ),
      );
      toastSuccess("Saved", "Your cover letter changes have been saved.");
    } catch (error: any) {
      console.error("Save failed:", error);
      toastError("Save failed", error?.message || "Could not save changes");
    } finally {
      setIsSaving(false);
    }
  };

  // Auto-save
  useEffect(() => {
    if (!activeId) return;

    const timeout = setTimeout(() => {
      handleSave();
    }, 2000);

    return () => clearTimeout(timeout);
  }, [coverLetter, activeId]); // Deep dependency might trigger too often, strictly relying on debounce

  // Helper: Serialize for export/copy
  const serializeLetter = () => {
    const parts = [];
    // Sender
    if (sender.name) parts.push(sender.name);
    if (sender.email) parts.push(sender.email);
    if (sender.phone) parts.push(sender.phone);
    if (sender.address) parts.push(sender.address);
    if (parts.length) parts.push("");

    // Date
    if (content.date) {
      parts.push(new Date(content.date).toLocaleDateString());
      parts.push("");
    }

    // Recipient
    if (recipient.name) parts.push(recipient.name);
    if (recipient.title) parts.push(recipient.title);
    // Uses global company for recipient company usually
    if (company) parts.push(company);
    if (recipient.address) parts.push(recipient.address);
    if (parts.length > 0 && parts[parts.length - 1] !== "") parts.push("");

    // Subject
    if (content.subject) {
      parts.push(`Subject: ${content.subject}`);
      parts.push("");
    }

    // Salutation
    if (content.salutation) {
      parts.push(content.salutation);
      parts.push("");
    }

    // Body
    parts.push(finalBody);
    parts.push("");

    // Closing
    if (content.closing) parts.push(content.closing);
    if (content.signature) parts.push(content.signature);

    return parts.join("\n");
  };

  // --- Actions ---

  const saveToLibrary = async (nameOverride?: string) => {
    setIsSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toastError("Not signed in", "Please sign in to save.");
        return;
      }

      const nameToUse =
        nameOverride ||
        libName ||
        coverLetter.title ||
        `Cover Letter - ${company || "Untitled"}`;
      const savedAt = new Date().toISOString();
      const stateToSave = {
        ...coverLetterPayload,
        id: activeId || coverLetter.id || "",
        title: nameToUse,
      };

      if (currentLibId && !nameOverride) {
        const { data, error } = await supabase
          .from("cover_letters")
          .update({
            name: nameToUse,
            slug: coverLetter.slug,
            tags: coverLetter.tags,
            data: stateToSave,
            updated_at: savedAt,
          })
          .eq("id", currentLibId)
          .select()
          .single();

        if (error) throw error;
        setCoverLetterId(currentLibId);
        setCurrentLibId(currentLibId);
        setLibName(nameToUse);
        setLastSaved(new Date(savedAt));
        setLibrary((prev) =>
          prev.map((entry) =>
            entry.id === currentLibId
              ? {
                  ...entry,
                  ...(data || {}),
                  name: nameToUse,
                  slug: coverLetter.slug,
                  tags: coverLetter.tags,
                  data: stateToSave,
                  updated_at: savedAt,
                }
              : entry,
          ),
        );
        toastSuccess("Updated", "Cover letter saved.");
      } else {
        const { data, error } = await supabase
          .from("cover_letters")
          .insert({
            user_id: user.id,
            name: nameToUse,
            slug: coverLetter.slug,
            tags: coverLetter.tags,
            data: stateToSave,
          })
          .select()
          .single();

        if (error) throw error;
        if (data) {
          setCoverLetterId(data.id);
          setCurrentLibId(data.id);
          setLibName(nameToUse);
          setLibrary((prev) => [
            data,
            ...prev.filter((entry) => entry.id !== data.id),
          ]);
          setLastSaved(new Date(savedAt));
          toastSuccess("Saved", "New cover letter created.");
          navigate("/dashboard/cover-letter/edit/" + data.id, {
            replace: true,
          });
        }
      }
    } catch (e: any) {
      console.error(e);
      toastError(
        "Save failed",
        e?.message || "Could not save your cover letter.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const loadProfile = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toastError("Not signed in", "Please sign in.");
        return;
      }
      const { data, error } = await supabase
        .from("profiles")
        .select("first_name,last_name,job_title,location,phone")
        .eq("id", user.id)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        const name = [data.first_name, data.last_name]
          .filter(Boolean)
          .join(" ");
        if (name) {
          setSenderName(name);
          if (!content.signature) setSignatureName(name);
        }
        if (data.phone) setSenderPhone(data.phone);
        if (user.email) setSenderEmail(user.email);
        if (data.location) setSenderAddress(data.location);
        if (data.job_title) setRole(data.job_title);
        toastSuccess("Profile loaded", "Filled details from your profile");
      } else {
        toastError("No profile found", "Please complete your profile first.");
      }
    } catch (e: any) {
      console.error(e);
      toastError("Profile load failed", e?.message);
    }
  };

  const buildAiResumeContext = () => {
    const parts = [
      sender.name ? `Name: ${sender.name}` : "",
      sender.email ? `Email: ${sender.email}` : "",
      sender.phone ? `Phone: ${sender.phone}` : "",
      sender.address ? `Location: ${sender.address}` : "",
      role ? `Target Role: ${role}` : "",
      company ? `Target Company: ${company}` : "",
      finalBody ? `Draft Content:\n${finalBody}` : "",
    ].filter(Boolean);
    return parts.join("\n").trim();
  };

  const aiPolish = async () => {
    if (!hasCoverLetterAiAccess) {
      toastError(
        "Upgrade required",
        "Cover letter AI is available on Basics and above.",
      );
      return;
    }
    if (!finalBody.trim())
      return toastError("Empty content", "Write something first.");
    setAiLoading(true);
    try {
      const suggestions = await polishContent(
        finalBody,
        `Rewrite this cover letter in a ${tone} tone. Keep it concise, polished, and ready to send.`,
      );
      const polished =
        suggestions.find((item) => item.isRecommended)?.content ||
        suggestions[0]?.content ||
        "";
      if (!polished) throw new Error("No AI suggestion was returned.");
      setParagraphs([]);
      setContentString(polished.trim());
      toastSuccess("Polished!", "Your cover letter has been refined.");
    } catch (e: any) {
      console.error(e);
      toastError("AI failed", e?.message || "AI is temporarily unavailable.");
    } finally {
      setAiLoading(false);
    }
  };

  const aiWriteFull = async () => {
    if (!hasCoverLetterAiAccess) {
      toastError(
        "Upgrade required",
        "Cover letter AI is available on Basics and above.",
      );
      return;
    }
    if (!role || !company)
      return toastError("Missing info", "Role and company are required.");
    if (!jobDescription.trim())
      return toastError(
        "Missing job description",
        "Paste the job description so AI can tailor the letter.",
      );

    const resumeText = buildAiResumeContext();
    if (!resumeText) {
      toastError(
        "Missing context",
        "Add your details or draft content first so AI has enough context.",
      );
      return;
    }

    setAiLoading(true);
    try {
      const generated = await generateCoverLetterViaEdge({
        jobDescription,
        resumeText,
        instructions: `Target role: ${role}\nCompany: ${company}\nTone: ${tone}\nPreferred length: ${lengthPref}\nReturn a complete ready-to-send cover letter in plain text.`,
      });
      if (!generated.trim()) throw new Error("No cover letter was generated.");
      setParagraphs([]);
      setContentString(generated.trim());
      if (!content.subject) {
        setSubject(`Application for ${role}`);
      }
      toastSuccess("Generated!", "A tailored draft has been created.");
    } catch (e: any) {
      console.error(e);
      toastError("AI failed", e?.message || "AI is temporarily unavailable.");
    } finally {
      setAiLoading(false);
    }
  };

  // --- Exports ---
  const exportTxt = () => {
    const blob = new Blob([serializeLetter()], {
      type: "text/plain;charset=utf-8",
    });
    saveAs(blob, `Cover_Letter_${company.replace(/\s+/g, "_")}.txt`);
    // setLastExport('txt');
  };

  const exportPdf = async () => {
    setExportBusy("pdf");
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const margin = 72;
      const top = 72;
      const width = 595 - margin * 2;

      doc.setFontSize(typography.fontSize);
      doc.setFont("times", "normal");

      const text = serializeLetter();
      const lines = doc.splitTextToSize(text, width);
      doc.text(lines, margin, top);

      doc.save(`Cover_Letter_${company}.pdf`);
      // setLastExport('pdf');
    } catch (e) {
      console.error(e);
      toastError("Export failed", "PDF generation error");
    } finally {
      setExportBusy(null);
    }
  };

  const exportDocx = async () => {
    setExportBusy("docx");
    try {
      const { Document, Packer, Paragraph, TextRun } = await import("docx");
      const doc = new Document({
        sections: [
          {
            properties: {},
            children: serializeLetter()
              .split("\n")
              .map(
                (line) =>
                  new Paragraph({
                    children: [new TextRun(line)],
                    spacing: { after: 120 },
                  }),
              ),
          },
        ],
      });
      const blob = await Packer.toBlob(doc);
      saveAs(blob, `Cover_Letter_${company}.docx`);
      // setLastExport('docx');
    } catch (e) {
      console.error(e);
      toastError("Export failed", "DOCX generation error");
    } finally {
      setExportBusy(null);
    }
  };

  const printLetter = () => {
    const win = window.open("", "", "width=800,height=900");
    if (!win) return;
    win.document.write(
      `<html><head><title>Print Cover Letter</title><style>body{font-family:serif;white-space:pre-wrap;margin:40px;font-size:${typography.fontSize}px;}</style></head><body>${serializeLetter()}</body></html>`,
    );
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  const copyPlain = async () => {
    try {
      await navigator.clipboard.writeText(serializeLetter());
      // setCopied(true);
      // setTimeout(() => setCopied(false), 2000);
      toastSuccess("Copied", "Ready to paste.");
    } catch {
      toastError("Copy failed", "Access denied.");
    }
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Cover Letter - ${company}`,
          text: serializeLetter(),
        });
      } catch (e) {
        console.error(e);
      }
    } else {
      copyPlain();
    }
  };

  const clearDraft = () => {
    setConfirmClearOpen(true);
  };

  const handleClearDraftConfirm = () => {
    setRole("");
    setCompany("");
    setJobDescription("");
    setNested("sender", "name", "");
    setNested("sender", "email", "");
    setNested("sender", "phone", "");
    setNested("sender", "address", "");
    setNested("recipient", "name", "");
    setNested("recipient", "title", "");
    setNested("recipient", "address", "");
    setNested("content", "subject", "");
    setNested("content", "rawBody", "");
    setNested("content", "paragraphs", []);
    setNested("content", "closing", "Best regards,");
    setNested("content", "signature", "");
    setNested("content", "date", new Date().toISOString().slice(0, 10));
    setNested("content", "salutation", "Dear Hiring Manager,");
    setConfirmClearOpen(false);
    toastSuccess("Cleared", "Draft cleared.");
  };

  // --- Formatting Helpers ---
  const addParagraph = () => setParagraphs([...content.paragraphs, ""]);
  const updateParagraph = (idx: number, val: string) => {
    const next = [...content.paragraphs];
    next[idx] = val;
    setParagraphs(next);
  };
  const removeParagraph = (idx: number) =>
    setParagraphs(content.paragraphs.filter((_, i) => i !== idx));
  const moveParagraphUp = (idx: number) => {
    if (idx <= 0) return;
    const next = [...content.paragraphs];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setParagraphs(next);
  };
  const moveParagraphDown = (idx: number) => {
    if (idx >= content.paragraphs.length - 1) return;
    const next = [...content.paragraphs];
    [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
    setParagraphs(next);
  };
  const splitContentString = () => {
    const parts = content.rawBody
      .split(/\n\s*\n+/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length) {
      setParagraphs(parts);
      setContentString("");
      toastSuccess("Split", "Content split into paragraphs.");
    }
  };
  const zoomIn = () => setFontSize(Math.min(typography.fontSize + 1, 24));
  const zoomOut = () => setFontSize(Math.max(typography.fontSize - 1, 10));

  // --- Render ---
  return (
    <div
      id='cover-page-root'
      className={`product-page-shell relative flex flex-col ${
        isMobile
          ? "gap-4 px-3 py-4"
          : "min-h-[calc(100vh-4rem)] gap-6 px-4 py-6 sm:px-6 lg:px-8"
      }`}
    >
      {/* Ambient Background Glows */}
      <div className='fixed top-20 right-0 h-96 w-96 bg-brand/5 rounded-full blur-3xl opacity-30 pointer-events-none -z-10' />
      <div className='fixed bottom-20 left-0 h-96 w-96 bg-brand/5 rounded-full blur-3xl opacity-20 pointer-events-none -z-10' />

      {/* Header */}
      <div
        id='cover-header'
        className='product-section-card sticky top-0 z-10 group relative flex flex-col justify-between gap-4 overflow-hidden rounded-2xl px-4 py-5 shadow-lg sm:px-6 xl:flex-row xl:items-center'
      >
        {/* Animated gradient overlay */}
        <div className='absolute inset-0 bg-gradient-to-r from-brand/0 via-brand/5 to-brand/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none' />

        <div className='relative flex items-center gap-3 sm:gap-4 w-full xl:w-auto'>
          <Button
            variant='ghost'
            size='sm'
            className='h-10 w-10 sm:h-12 sm:w-12 p-0 rounded-xl border border-brand/20 hover:border-brand/50 hover:bg-gradient-to-br hover:from-brand/15 hover:to-brand/5 hover:text-brand hover:scale-110 hover:shadow-[0_0_25px_rgba(29,255,0,0.2)] transition-all duration-200 group/btn shrink-0'
            onClick={() => navigate("/dashboard/cover-letter")}
          >
            <ArrowLeft className='w-4 h-4 sm:w-5 sm:h-5 group-hover/btn:scale-110 transition-transform' />
          </Button>
          <div className='h-12 w-px bg-gradient-to-b from-transparent via-brand/40 to-transparent shadow-[0_0_10px_rgba(29,255,0,0.3)]' />
          <div>
            {/* Dynamic Title Input */}
            <div className='flex items-center gap-2 group/title'>
              <input
                value={coverLetter.title || "Untitled Cover Letter"}
                onChange={(e) => setCoverLetterTitle(e.target.value)}
                className='product-page-title min-w-[300px] border-none bg-transparent text-3xl font-black tracking-tight outline-none focus:ring-0 sm:text-4xl placeholder:text-muted-foreground'
                placeholder='Untitled Cover Letter'
              />
              <Edit2 className='w-5 h-5 product-helper-text opacity-0 group-hover/title:opacity-100 transition-opacity' />
            </div>
            <div className='flex items-center gap-3 mt-1.5'>
              <p className='text-xs sm:text-sm product-helper-text flex items-center gap-2.5'>
                <span className='flex items-center justify-center w-5 h-5 rounded-lg bg-brand/20 border border-brand/40'>
                  <span className='inline-block w-2 h-2 bg-brand rounded-full animate-pulse shadow-[0_0_8px_rgba(29,255,0,0.8)]' />
                </span>
                AI Assistant Ready
              </p>
              {lastSaved && (
                <span className='text-xs text-brand/70 flex items-center gap-1'>
                  <Check className='w-3 h-3' />
                  Saved {lastSaved.toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className='relative flex flex-wrap xl:flex-nowrap items-center gap-2.5 overflow-x-auto w-full xl:w-auto pb-2 xl:pb-0'>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className='rounded-xl h-11 border-brand/30 bg-brand/10 text-brand hover:bg-brand/20 gap-2 shrink-0'
          >
            {isSaving ? (
              <Loader2 className='w-4 h-4 animate-spin' />
            ) : (
              <Check className='w-4 h-4' />
            )}
            {isSaving ? "Saving..." : "Save"}
          </Button>
          <Button
            variant='outline'
            onClick={() => setInlineEdit(!inlineEdit)}
            className={`rounded-xl shrink-0 whitespace-nowrap h-11 px-4 font-semibold transition-all duration-300 group/btn ${inlineEdit ? "bg-brand/10 border-brand text-brand" : "border-brand/30 hover:border-brand/60 hover:text-brand hover:bg-brand/5"}`}
          >
            <Pencil className='w-4 h-4 mr-2' />
            {inlineEdit ? "Live Edit: On" : "Enable Live Edit"}
          </Button>
          <Button
            variant='outline'
            onClick={aiPolish}
            disabled={aiLoading || loadingTier}
            className='product-outline-button h-11 rounded-xl transition-all hover:border-brand/60 hover:bg-brand/15'
          >
            <Wand2
              className={`w-4 h-4 mr-2 ${aiLoading ? "animate-spin" : ""}`}
            />
            {aiLoading ? "Polishing" : "AI Polish"}
            {!hasCoverLetterAiAccess && (
              <Lock className='ml-2 w-3 h-3 opacity-50' />
            )}
          </Button>
          <Button
            variant='outline'
            onClick={aiWriteFull}
            disabled={aiLoading || loadingTier}
            className='product-outline-button h-11 rounded-xl transition-all hover:border-brand/60 hover:bg-brand/15'
          >
            <Wand2
              className={`w-4 h-4 mr-2 ${aiLoading ? "animate-spin" : ""}`}
            />
            {aiLoading ? "Writing" : "AI Generate"}
            {!hasCoverLetterAiAccess && (
              <Lock className='ml-2 w-3 h-3 opacity-50' />
            )}
          </Button>
          <Button
            variant='outline'
            onClick={() => setExportOpen(true)}
            className='product-outline-button h-11 rounded-xl transition-all hover:border-brand/60 hover:bg-brand/15'
          >
            <Download className='w-4 h-4 mr-2' />
            Export
          </Button>
        </div>
      </div>

      {isMobile && (
        <div className='-mt-3 px-4 pb-1 flex justify-center'>
          <div className='relative flex p-1 bg-foreground/5 rounded-full border border-foreground/10 backdrop-blur-md w-full max-w-[340px]'>
            <button
              onClick={() => setMobileView("editor")}
              className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-full transition-all duration-300 ${
                mobileView === "editor"
                  ? "text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {mobileView === "editor" && (
                <motion.div
                  layoutId="activeCoverLetterBuilderTab"
                  className="absolute inset-0 bg-brand rounded-full -z-10 shadow-[0_2px_10px_rgba(29,255,0,0.25)]"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <PenLine size={13} />
              <span>Editor</span>
            </button>
            <button
              onClick={() => setMobileView("preview")}
              className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-full transition-all duration-300 ${
                mobileView === "preview"
                  ? "text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {mobileView === "preview" && (
                <motion.div
                  layoutId="activeCoverLetterBuilderTab"
                  className="absolute inset-0 bg-brand rounded-full -z-10 shadow-[0_2px_10px_rgba(29,255,0,0.25)]"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <Eye size={13} />
              <span>Preview</span>
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmClearOpen}
        onCancel={() => setConfirmClearOpen(false)}
        onConfirm={handleClearDraftConfirm}
        title="Clear Cover Letter Draft"
        message="Clear all current fields and start fresh? This will remove the current unsaved content from the editor."
        confirmText="Clear Draft"
        cancelText="Cancel"
      />

      {!loadingTier && !hasCoverLetterAiAccess && (
        <UpgradePrompt
          compact
          requiredTier='Basics'
          showPricing={false}
          title='Cover Letter AI'
          description='Unlock AI polish and full tailored generation while keeping manual editing and exports on Free.'
        />
      )}

      {/* Main Layout */}
      <div
        id='cover-main-layout'
        className='grid gap-6 grid-cols-1 xl:grid-cols-[460px_minmax(0,1fr)] max-w-[1800px] mx-auto w-full'
      >
        {/* CONFIG PANEL (LEFT) */}
        <Card className={`product-section-card p-6 rounded-2xl ${isMobile && mobileView !== "editor" ? "hidden" : "flex flex-col"}`}>
          <div className='grid gap-6'>
            {/* Library */}
            <div className='grid gap-3'>
              <div className='flex items-center justify-between'>
                <label className='text-sm font-semibold text-foreground'>
                  Save Cover Letter
                </label>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => {
                    resetCoverLetter();
                    setCurrentLibId(null);
                    setLibName("");
                    setCoverLetterId("");
                    navigate("/dashboard/cover-letter/create");
                  }}
                  className='h-8'
                >
                  New
                </Button>
              </div>
              <input
                value={libName}
                onChange={(e) => setLibName(e.target.value)}
                placeholder='Letter Name'
                className='w-full product-input-surface rounded-xl px-3 py-2 text-sm outline-none'
              />
              <div className='grid grid-cols-2 gap-3'>
                <Button
                  onClick={() => saveToLibrary()}
                  variant='outline'
                  className='border-brand/30'
                >
                  {currentLibId ? "Update" : "Save"}
                </Button>
                <Button
                  onClick={() => saveToLibrary(libName)}
                  variant='outline'
                >
                  Save As New
                </Button>
              </div>
              {library.length > 0 && (
                <select
                  className='w-full product-input-surface rounded-xl px-3 py-2 text-sm'
                  onChange={(e) => {
                    const lib = library.find((l) => l.id === e.target.value);
                    const payload = normalizeCoverLetterPayload(lib);
                    if (lib && payload) {
                      applyLetterRecord(lib);
                      navigate("/dashboard/cover-letter/edit/" + lib.id, {
                        replace: true,
                      });
                      toastSuccess("Loaded", `Loaded ${lib.name}`);
                    }
                  }}
                  value={currentLibId || ""}
                >
                  <option value=''>Select saved letter...</option>
                  {library.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Sender */}
            <div className='grid gap-3'>
              <div className='flex justify-between items-center'>
                <label className='text-sm font-semibold text-foreground'>
                  Sender Info
                </label>
                <div className='flex gap-2'>
                  <Button
                    size='sm'
                    variant='outline'
                    onClick={loadProfile}
                    className='h-7 text-xs'
                  >
                    Use Profile
                  </Button>
                  <Button
                    size='sm'
                    variant='outline'
                    onClick={() => {
                      setSenderName("");
                      setSenderEmail("");
                      setSenderPhone("");
                      setSenderAddress("");
                    }}
                    className='h-7 text-xs'
                  >
                    Clear
                  </Button>
                </div>
              </div>
              <input
                value={sender.name}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder='Name'
                className='w-full product-input-surface rounded-xl px-3 py-2 text-sm outline-none'
              />
              <div className='grid grid-cols-2 gap-3'>
                <input
                  value={sender.email}
                  onChange={(e) => setSenderEmail(e.target.value)}
                  placeholder='Email'
                  className='w-full product-input-surface rounded-xl px-3 py-2 text-sm outline-none'
                />
                <input
                  value={sender.phone}
                  onChange={(e) => setSenderPhone(e.target.value)}
                  placeholder='Phone'
                  className='w-full product-input-surface rounded-xl px-3 py-2 text-sm outline-none'
                />
              </div>
              <input
                value={sender.address}
                onChange={(e) => setSenderAddress(e.target.value)}
                placeholder='Address'
                className='w-full product-input-surface rounded-xl px-3 py-2 text-sm outline-none'
              />
            </div>

            {/* Recipient */}
            <div className='grid gap-3'>
              <label className='text-sm font-semibold text-foreground'>
                Recipient Info
              </label>
              <div className='grid grid-cols-2 gap-3'>
                <input
                  value={recipient.name}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder='Name'
                  className='w-full product-input-surface rounded-xl px-3 py-2 text-sm outline-none'
                />
                <input
                  value={recipient.title}
                  onChange={(e) => setRecipientTitle(e.target.value)}
                  placeholder='Title'
                  className='w-full product-input-surface rounded-xl px-3 py-2 text-sm outline-none'
                />
              </div>
              <div className='grid grid-cols-2 gap-3'>
                <input
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder='Company'
                  className='w-full product-input-surface rounded-xl px-3 py-2 text-sm outline-none'
                />
                <input
                  value={recipient.address}
                  onChange={(e) => setRecipientAddress(e.target.value)}
                  placeholder='Address'
                  className='w-full product-input-surface rounded-xl px-3 py-2 text-sm outline-none'
                />
              </div>
            </div>

            {/* Letter Details */}
            <div className='grid gap-3'>
              <label className='text-sm font-semibold text-foreground'>
                Details
              </label>
              <div className='grid grid-cols-2 gap-3'>
                <input
                  type='date'
                  value={content.date}
                  onChange={(e) => setDate(e.target.value)}
                  className='w-full product-input-surface rounded-xl px-3 py-2 text-sm outline-none'
                />
                <input
                  value={content.subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder='Subject'
                  className='w-full product-input-surface rounded-xl px-3 py-2 text-sm outline-none'
                />
              </div>
              <input
                value={content.salutation}
                onChange={(e) => setSalutation(e.target.value)}
                placeholder='Salutation'
                className='w-full product-input-surface rounded-xl px-3 py-2 text-sm outline-none'
              />
              <div className='grid grid-cols-2 gap-3'>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className='w-full product-input-surface rounded-xl px-3 py-2 text-sm outline-none'
                >
                  <option value='professional'>Professional</option>
                  <option value='friendly'>Friendly</option>
                  <option value='enthusiastic'>Enthusiastic</option>
                </select>
                <select
                  value={lengthPref}
                  onChange={(e) => setLengthPref(e.target.value)}
                  className='w-full product-input-surface rounded-xl px-3 py-2 text-sm outline-none'
                >
                  <option value='short'>Short</option>
                  <option value='medium'>Medium</option>
                  <option value='long'>Long</option>
                </select>
              </div>
            </div>

            {/* Body / Content */}
            <div className='grid gap-3'>
              <div className='flex justify-between items-center'>
                <label className='text-sm font-semibold text-foreground'>
                  Body
                </label>
                <Button
                  size='sm'
                  variant='ghost'
                  onClick={splitContentString}
                  className='h-6 text-xs text-brand'
                >
                  Split to Paragraphs
                </Button>
              </div>
              {/* Raw Body Editor */}
              <textarea
                value={content.rawBody}
                onChange={(e) => setContentString(e.target.value)}
                rows={6}
                className='w-full product-input-surface rounded-xl px-3 py-2 text-sm outline-none'
                placeholder='Raw content...'
              />

              {/* Paragraphs Editor */}
              <div className='space-y-2'>
                <div className='flex justify-between items-center'>
                  <span className='text-xs product-helper-text'>
                    Paragraphs ({content.paragraphs.length})
                  </span>
                  <Button
                    size='sm'
                    variant='ghost'
                    onClick={addParagraph}
                    className='h-6 text-xs'
                  >
                    <Plus className='w-3 h-3' />
                  </Button>
                </div>
                {content.paragraphs.map((p, idx) => (
                  <div key={idx} className='relative group'>
                    <textarea
                      value={p}
                      onChange={(e) => updateParagraph(idx, e.target.value)}
                      rows={3}
                      className='w-full product-input-surface rounded-lg px-3 py-2 text-sm outline-none'
                    />
                    <div className='absolute top-1 right-1 opacity-0 group-hover:opacity-100 flex gap-1 bg-muted/50 rounded'>
                      <button
                        onClick={() => moveParagraphUp(idx)}
                        className='p-1 hover:text-brand'
                      >
                        <ArrowUp className='w-3 h-3' />
                      </button>
                      <button
                        onClick={() => moveParagraphDown(idx)}
                        className='p-1 hover:text-brand'
                      >
                        <ArrowDown className='w-3 h-3' />
                      </button>
                      <button
                        onClick={() => removeParagraph(idx)}
                        className='p-1 hover:text-brand'
                      >
                        <Trash2 className='w-3 h-3' />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className='mt-2 grid gap-2'>
                <div className='flex flex-wrap items-center justify-between gap-2'>
                  <span className='text-xs product-helper-text'>
                    Job posting (for AI generation)
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type='button'
                        variant='outline'
                        size='sm'
                        disabled={jobsQueueLoading}
                        className='h-8 gap-1.5 border-brand/50 text-foreground hover:bg-brand/10 hover:text-foreground'
                      >
                        <Briefcase className='h-3.5 w-3.5' />
                        Insert from job queue
                        <ChevronDown className='h-3.5 w-3.5 opacity-70' />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align='end'
                      className='max-h-64 w-[min(100vw-2rem,22rem)] overflow-y-auto'
                    >
                      <DropdownMenuLabel className='text-xs font-normal text-foreground/60'>
                        Tracked jobs with a description
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {jobsQueueLoading ? (
                        <DropdownMenuItem disabled className='text-xs'>
                          Loading jobs…
                        </DropdownMenuItem>
                      ) : jobsWithDescription.length === 0 ? (
                        <DropdownMenuItem disabled className='text-xs'>
                          No jobs with descriptions in your queue
                        </DropdownMenuItem>
                      ) : (
                        jobsWithDescription.map((job) => (
                          <DropdownMenuItem
                            key={job.id}
                            className='flex cursor-pointer flex-col items-start gap-0.5 py-2'
                            onSelect={() => applyJobDescriptionFromQueue(job)}
                          >
                            <span className='w-full truncate font-medium text-foreground'>
                              {job.title}
                            </span>
                            {job.company ? (
                              <span className='w-full truncate text-xs text-foreground/55'>
                                {job.company}
                              </span>
                            ) : null}
                          </DropdownMenuItem>
                        ))
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <textarea
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  rows={4}
                  placeholder='Paste Job Description for AI context...'
                  className='w-full resize-y rounded-2xl border border-brand/55 bg-background/80 px-3 py-2.5 text-sm text-foreground outline-none ring-0 placeholder:text-foreground/40 focus:border-brand focus:ring-1 focus:ring-brand/40'
                />
              </div>
            </div>

            {/* Closing */}
            <div className='grid grid-cols-2 gap-3'>
              <input
                value={content.closing}
                onChange={(e) => setClosing(e.target.value)}
                placeholder='Closing'
                className='w-full product-input-surface rounded-xl px-3 py-2 text-sm outline-none'
              />
              <input
                value={content.signature}
                onChange={(e) => setSignatureName(e.target.value)}
                placeholder='Signature'
                className='w-full product-input-surface rounded-xl px-3 py-2 text-sm outline-none'
              />
            </div>
          </div>
        </Card>

        {/* PREVIEW PANEL (RIGHT) */}
        <Card className={`p-4 sm:p-8 bg-white min-h-[800px] text-black shadow-2xl overflow-y-auto ${isMobile && mobileView !== "preview" ? "hidden" : "flex flex-col"}`}>
          <div
            className='max-w-[800px] mx-auto space-y-6'
            style={{
              fontSize: `${typography.fontSize}px`,
              fontFamily: "Times New Roman, serif",
            }}
          >
            {/* Header Section */}
            <div className='text-right space-y-1'>
              <h2 className='font-bold text-lg'>
                {sender.name || "Your Name"}
              </h2>
              {[sender.address, sender.phone, sender.email]
                .filter(Boolean)
                .map((line, i) => (
                  <p key={i} className='text-gray-600'>
                    {line}
                  </p>
                ))}
            </div>

            <div className='pt-4 border-b border-gray-200' />

            <p>{new Date(content.date || Date.now()).toLocaleDateString()}</p>

            <div className='space-y-1'>
              <p className='font-bold'>{recipient.name || "Recipient Name"}</p>
              {[recipient.title, company, recipient.address]
                .filter(Boolean)
                .map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
            </div>

            {content.subject && (
              <p className='font-bold underline mt-4'>
                Subject: {content.subject}
              </p>
            )}

            <p className='mt-4'>
              {content.salutation || "Dear Hiring Manager,"}
            </p>

            {/* Content Body */}
            <div className='space-y-4 leading-relaxed whitespace-pre-wrap'>
              {(content.paragraphs.length
                ? content.paragraphs
                : content.rawBody.split(/\n\n+/)
              ).map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>

            <div className='mt-8 space-y-4'>
              <p>{content.closing || "Sincerely,"}</p>
              <div className='h-12'>
                {content.signature && (
                  <p className='font-script text-xl'>{content.signature}</p>
                )}
              </div>
              <p className='font-bold'>{content.signature || sender.name}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Config Toolbar */}
      <div className={`product-section-card fixed ${isMobile ? "bottom-20" : "bottom-6"} left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-2xl p-2 shadow-xl ${isMobile && mobileView === "editor" ? "hidden" : ""}`}>
        <Button
          size='icon'
          variant='ghost'
          onClick={zoomOut}
          className='hover:text-brand'
        >
          <Minus className='w-4 h-4' />
        </Button>
        <span className='text-xs font-mono w-12 text-center'>
          {typography.fontSize}px
        </span>
        <Button
          size='icon'
          variant='ghost'
          onClick={zoomIn}
          className='hover:text-brand'
        >
          <Plus className='w-4 h-4' />
        </Button>
        <div className='w-px h-4 bg-foreground/20 mx-2' />
        <Button
          size='sm'
          variant='ghost'
          onClick={clearDraft}
          className='text-brand hover:text-brand hover:bg-brand/10'
        >
          Clear
        </Button>
      </div>

      {/* Export Modal */}
      {exportOpen &&
        createPortal(
          <div className='fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm'>
            <div className='product-section-card relative w-full max-w-md rounded-2xl p-6 shadow-2xl'>
              <button
                onClick={() => setExportOpen(false)}
                className='absolute top-4 right-4 product-helper-text hover:text-foreground'
              >
                <X className='w-5 h-5' />
              </button>
              <h2 className='text-xl font-bold text-foreground mb-2'>
                Export Cover Letter
              </h2>
              <p className='text-sm product-helper-text mb-6'>
                Choose a format to download your letter.
              </p>

              <div className='space-y-3'>
                <Button
                  onClick={exportPdf}
                  disabled={!!exportBusy}
                  className='w-full justify-start h-12 border-brand/30 hover:bg-brand/10'
                  variant='outline'
                >
                  <FileText className='w-5 h-5 mr-3 text-brand' /> PDF Document
                  {exportBusy === "pdf" && (
                    <span className='ml-auto animate-pulse'>Processing...</span>
                  )}
                </Button>
                <Button
                  onClick={exportDocx}
                  disabled={!!exportBusy}
                  className='w-full justify-start h-12 border-brand/30 hover:bg-brand/10'
                  variant='outline'
                >
                  <FileType className='w-5 h-5 mr-3 text-blue-400' /> Word
                  (DOCX)
                  {exportBusy === "docx" && (
                    <span className='ml-auto animate-pulse'>Processing...</span>
                  )}
                </Button>
                <Button
                  onClick={exportTxt}
                  className='w-full justify-start h-12 border-brand/30 hover:bg-brand/10'
                  variant='outline'
                >
                  <FileText className='w-5 h-5 mr-3 product-helper-text' />{" "}
                  Plain Text
                </Button>
              </div>

              <div className='mt-6 pt-4 border-t border-foreground/10 flex gap-3'>
                <Button
                  onClick={printLetter}
                  className='flex-1'
                  variant='ghost'
                >
                  <Printer className='w-4 h-4 mr-2' /> Print
                </Button>
                <Button onClick={copyPlain} className='flex-1' variant='ghost'>
                  <Share2 className='w-4 h-4 mr-2' /> Copy
                </Button>
                <Button onClick={share} className='flex-1' variant='ghost'>
                  <Share2 className='w-4 h-4 mr-2' /> Share
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Grid,
  List,
  Calendar,
  Edit2,
  Trash2,
  Mail,
  History,
  MessageSquare,
  FileText,
} from "lucide-react";
import { useArtboardStore } from "../../../store/artboard";
import { Button } from "../../../components/ui/button";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabaseClient";
import { CoverLetterCreationModal } from "../components/CoverLetterCreationModal";
import { CoverLetterPreviewCard } from "../components/CoverLetterPreviewCard";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";

const supabase = createClient();

export const CoverLetterHomePage = () => {
  const navigate = useNavigate();
  const { error: toastError } = useToast();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [letters, setLetters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [letterToDelete, setLetterToDelete] = useState<any | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const setCoverLetter = useArtboardStore((state) => state.setCoverLetter);

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

  useEffect(() => {
    const fetchLetters = async () => {
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

        if (data) setLetters(data);
        if (error) console.error(error);
      } catch (error) {
        console.error("Error fetching cover letters:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchLetters();
  }, []);

  const handleCreateNew = () => {
    setIsCreateModalOpen(true);
  };
  const handleEdit = (letter: any) => {
    const payload = normalizeCoverLetterPayload(letter);
    if (payload) {
      setCoverLetter({
        ...payload,
        id: letter.id,
        title: letter.name || payload.title,
      });
      if (letter.name) {
        useArtboardStore.getState().setCoverLetterTitle(letter.name);
      }
      useArtboardStore.getState().setCoverLetterId(letter.id);
    }
    navigate("/dashboard/cover-letter/edit/" + letter.id);
  };

  const handleDeleteConfirm = async () => {
    if (!letterToDelete) return;

    try {
      const { error } = await supabase
        .from("cover_letters")
        .delete()
        .eq("id", letterToDelete.id);

      if (error) throw error;
      setLetters((prev) => prev.filter((l) => l.id !== letterToDelete.id));
      setLetterToDelete(null);
    } catch (error) {
      console.error("Error deleting cover letter:", error);
      toastError(
        "Delete failed",
        error instanceof Error ? error.message : "Could not delete cover letter.",
      );
    }
  };

  return (
    <div className={`product-page-shell flex flex-col h-full bg-background text-foreground overflow-y-auto ${isMobile ? "p-4 pb-20" : "p-8"}`}>
      {/* Header */}
      <div className='flex items-center justify-between mb-8'>
        <div>
          <h1 className='product-page-title text-2xl font-bold'>
            Cover Letters
          </h1>
          <p className='product-page-subtitle text-sm mt-1'>
            Manage and create your tailored cover letters
          </p>
        </div>

        <div className='flex items-center gap-3'>
          {/* View Toggle */}
          <div className='product-control-surface'>
            <button
              onClick={() => setViewMode("grid")}
              className={
                viewMode === "grid"
                  ? "product-control-button-active"
                  : "product-control-button"
              }
            >
              <Grid className='w-4 h-4' />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={
                viewMode === "list"
                  ? "product-control-button-active"
                  : "product-control-button"
              }
            >
              <List className='w-4 h-4' />
            </button>
          </div>

          <Button
            onClick={handleCreateNew}
            className='bg-brand text-black hover:bg-brand/90 gap-2 font-semibold'
          >
            <Plus className='w-4 h-4' />
            Create New
          </Button>
        </div>
      </div>

      <CoverLetterCreationModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
      />

      {loading ? (
        <div className='grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6'>
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className='aspect-[3/4] rounded-xl bg-foreground/5 border border-foreground/5 overflow-hidden flex flex-col'
            >
              {/* Preview skeleton */}
              <div className='flex-1 bg-foreground/5 relative overflow-hidden'>
                <div
                  className='absolute inset-0 bg-gradient-to-r from-transparent via-foreground/40 to-transparent animate-[shimmer_1.5s_infinite] -translate-x-full'
                  style={{ animation: `shimmer 1.5s infinite ${i * 0.15}s` }}
                />
                {/* Fake letter lines */}
                <div className='p-6 space-y-3 pt-8'>
                  <div className='flex justify-end'>
                    <div className='space-y-1.5 text-right'>
                      <div className='h-3 bg-foreground/5 rounded-full w-24 ml-auto' />
                      <div className='h-2 bg-foreground/5 rounded-full w-32 ml-auto' />
                    </div>
                  </div>
                  <div className='h-px bg-foreground/5 w-full mt-3' />
                  <div className='h-2 bg-foreground/5 rounded-full w-1/3 mt-2' />
                  <div className='space-y-1.5 mt-3'>
                    <div className='h-2 bg-foreground/5 rounded-full w-2/5' />
                    <div className='h-2 bg-foreground/5 rounded-full w-1/3' />
                    <div className='h-2 bg-foreground/5 rounded-full w-1/4' />
                  </div>
                  <div className='h-2 bg-foreground/5 rounded-full w-2/3 mt-4' />
                  <div className='space-y-1.5 mt-2'>
                    <div className='h-2 bg-foreground/5 rounded-full w-full' />
                    <div className='h-2 bg-foreground/5 rounded-full w-5/6' />
                    <div className='h-2 bg-foreground/5 rounded-full w-4/6' />
                    <div className='h-2 bg-foreground/5 rounded-full w-full' />
                  </div>
                </div>
              </div>
              {/* Meta skeleton */}
              <div className='p-4 bg-background border-t border-foreground/5'>
                <div className='h-3 bg-foreground/5 rounded-full w-3/4 mb-2' />
                <div className='h-2 bg-foreground/5 rounded-full w-1/2' />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Grid View */}
          {viewMode === "grid" && (
            <div className='grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6'>
              {/* Create New Card */}
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleCreateNew}
                className=' aspect-[3/4] border rounded-2xl border-foreground/20 cursor-pointer flex flex-col items-center justify-center gap-4 transition-all group'
              >
                <div className='w-16 h-16 rounded-full bg-brand/10 flex items-center justify-center text-brand group-hover:scale-110 transition-transform'>
                  <Plus className='w-8 h-8' />
                </div>
                <span className='product-page-subtitle font-medium group-hover:text-foreground transition-colors'>
                  Create New Letter
                </span>
              </motion.div>

              {/* Letter Cards */}
              {letters.map((letter) => (
                <motion.div
                  key={letter.id}
                  whileHover={{ y: -5 }}
                  className='product-section-card aspect-[3/4] overflow-hidden group hover:shadow-xl transition-all relative flex flex-col p-0'
                >
                  {/* Preview Area (Top 2/3) */}
                  <div
                    onClick={() => handleEdit(letter)}
                    className='flex-1 bg-foreground relative cursor-pointer overflow-hidden'
                  >
                    {/* Mini Cover Letter Preview */}
                    <CoverLetterPreviewCard
                      data={normalizeCoverLetterPayload(letter)}
                      name={letter.name}
                    />

                    {/* Overlay */}
                    <div className='absolute inset-0 bg-background/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2'>
                      <Button size='sm' variant='secondary' className='gap-2'>
                        <Edit2 className='w-3 h-3' /> Edit
                      </Button>
                    </div>
                  </div>

                  {/* Meta Info (Bottom) */}
                  <div className='p-4 bg-background border-t border-foreground/5'>
                    <div className='flex items-start justify-between'>
                      <div className='min-w-0'>
                        <h3
                          className='font-semibold text-foreground truncate pr-2'
                          title={letter.name}
                        >
                          {letter.name || "Untitled"}
                        </h3>
                        <p className='product-helper-text text-xs mt-1 flex items-center gap-1'>
                          <Calendar className='w-3 h-3' />
                          {new Date(letter.updated_at).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        type='button'
                        onClick={(e) => {
                          e.stopPropagation();
                          setLetterToDelete(letter);
                        }}
                        className='product-helper-text hover:text-brand p-1 rounded hover:bg-brand/10 transition-colors'
                        title='Delete cover letter'
                        aria-label={`Delete ${letter.name || "cover letter"}`}
                      >
                        <Trash2 className='w-4 h-4' />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* List View */}
          {viewMode === "list" && (
            <div className='space-y-4'>
              <div className='grid grid-cols-12 gap-4 px-4 py-2 product-helper-text text-xs font-medium uppercase tracking-wider'>
                <div className='col-span-6'>Name</div>
                <div className='col-span-3'>Last Modified</div>
                <div className='col-span-3 text-right'>Actions</div>
              </div>

              <div
                onClick={handleCreateNew}
                className='product-section-card-muted grid grid-cols-12 gap-4 px-4 py-4 border-dashed hover:border-brand/60 cursor-pointer items-center group transition-all'
              >
                <div className='col-span-6 flex items-center gap-3'>
                  <div className='w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center text-brand'>
                    <Plus className='w-5 h-5' />
                  </div>
                  <span className='product-page-subtitle font-medium group-hover:text-foreground transition-colors'>
                    Create New Letter
                  </span>
                </div>
              </div>

              {letters.map((letter) => (
                <div
                  key={letter.id}
                  onClick={() => handleEdit(letter)}
                  className='product-section-card-muted grid grid-cols-12 gap-4 px-4 py-4 hover:border-brand/45 items-center transition-all group cursor-pointer'
                >
                  <div className='col-span-6 flex items-center gap-4'>
                    <div className='w-10 h-10 rounded-lg bg-foreground flex items-center justify-center'>
                      <Mail className='w-5 h-5 product-helper-text' />
                    </div>
                    <div className='min-w-0'>
                      <h3 className='font-semibold text-foreground truncate'>
                        {letter.name || "Untitled"}
                      </h3>
                      <p className='product-helper-text text-xs'>
                        Cover Letter
                      </p>
                    </div>
                  </div>
                  <div className='col-span-3 product-helper-text text-sm'>
                    {new Date(letter.updated_at).toLocaleDateString()}
                  </div>
                  <div className='col-span-3 flex items-center justify-end gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity'>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setLetterToDelete(letter);
                      }}
                      className='p-2 product-helper-text hover:text-brand hover:bg-brand/10 rounded-lg transition-colors'
                      title='Delete'
                    >
                      <Trash2 className='w-4 h-4' />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      <ConfirmDialog
        open={Boolean(letterToDelete)}
        onCancel={() => setLetterToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title='Delete Cover Letter'
        message={
          letterToDelete
            ? `Delete "${letterToDelete.name || "Untitled"}"? This action cannot be undone.`
            : "This action cannot be undone."
        }
        confirmText='Delete'
        cancelText='Cancel'
      />

    </div>
  );
};

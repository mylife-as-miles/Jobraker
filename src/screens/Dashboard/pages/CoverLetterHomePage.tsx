import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Upload,
  Grid,
  List,
  Calendar,
  Edit2,
  Trash2,
  Mail,
} from "lucide-react";
import { useArtboardStore } from "../../../store/artboard";
import { Button } from "../../../components/ui/button";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabaseClient";
import { CoverLetterCreationModal } from "../components/CoverLetterCreationModal";
import { CoverLetterPreviewCard } from "../components/CoverLetterPreviewCard";

const supabase = createClient();

export const CoverLetterHomePage = () => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [letters, setLetters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const setCoverLetter = useArtboardStore((state) => state.setCoverLetter);

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
    const payload = letter.data || letter.content;
    if (payload) {
      setCoverLetter({ ...payload, id: letter.id, title: letter.name || payload.title });
      if (letter.name) {
        useArtboardStore.getState().setCoverLetterTitle(letter.name);
      }
      useArtboardStore.getState().setCoverLetterId(letter.id);
    }
    navigate("/dashboard/cover-letter/edit/" + letter.id);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this cover letter?")) return;

    try {
      const { error } = await supabase
        .from("cover_letters")
        .delete()
        .eq("id", id);

      if (error) throw error;
      setLetters((prev) => prev.filter((l) => l.id !== id));
    } catch (error) {
      console.error("Error deleting cover letter:", error);
    }
  };

  return (
    <div className='product-page-shell flex flex-col h-full bg-background text-foreground p-8 overflow-y-auto'>
      {/* Header */}
      <div className='flex items-center justify-between mb-8'>
        <div>
          <h1 className='product-page-title text-2xl font-bold'>Cover Letters</h1>
          <p className='product-page-subtitle text-sm mt-1'>
            Manage and create your tailored cover letters
          </p>
        </div>

        <div className='flex items-center gap-3'>
          {/* View Toggle */}
          <div className='product-control-surface'>
            <button
              onClick={() => setViewMode("grid")}
              className={viewMode === "grid" ? "product-control-button-active" : "product-control-button"}
            >
              <Grid className='w-4 h-4' />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={viewMode === "list" ? "product-control-button-active" : "product-control-button"}
            >
              <List className='w-4 h-4' />
            </button>
          </div>

          <Button
            onClick={handleCreateNew}
            className='bg-[#ffd700] text-black hover:bg-[#ffd700]/90 gap-2 font-semibold'
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
              <div className='flex-1 bg-gradient-to-br from-foreground/5 to-foreground/5 relative overflow-hidden'>
                <div
                  className='absolute inset-0 bg-gradient-to-r from-transparent via-foreground/5 to-transparent'
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
                className='product-section-card-muted aspect-[3/4] border-dashed hover:border-[#ffd700]/60 cursor-pointer flex flex-col items-center justify-center gap-4 transition-all group'
              >
                <div className='w-16 h-16 rounded-full bg-[#ffd700]/10 flex items-center justify-center text-[#ffd700] group-hover:scale-110 transition-transform'>
                  <Plus className='w-8 h-8' />
                </div>
                <span className='product-page-subtitle font-medium group-hover:text-foreground transition-colors'>
                  Create New Letter
                </span>
              </motion.div>

              {/* Import Existing Card */}
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => { }} // Placeholder
                className='product-section-card-muted aspect-[3/4] border-dashed hover:border-[#ffd700]/60 cursor-pointer flex flex-col items-center justify-center gap-4 transition-all group'
              >
                <div className='w-16 h-16 rounded-full bg-foreground/5 flex items-center justify-center text-foreground group-hover:scale-110 transition-transform'>
                  <Upload className='w-8 h-8' />
                </div>
                <span className='product-page-subtitle font-medium group-hover:text-foreground transition-colors'>
                  Import Existing
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
                      data={letter.data || letter.content}
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
                        onClick={(e) => handleDelete(e, letter.id)}
                        className='product-helper-text hover:text-red-400 p-1 rounded hover:bg-[#ffd700]/10 transition-colors'
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
                className='product-section-card-muted grid grid-cols-12 gap-4 px-4 py-4 border-dashed hover:border-[#ffd700]/60 cursor-pointer items-center group transition-all'
              >
                <div className='col-span-6 flex items-center gap-3'>
                  <div className='w-10 h-10 rounded-lg bg-[#ffd700]/10 flex items-center justify-center text-[#ffd700]'>
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
                  className='product-section-card-muted grid grid-cols-12 gap-4 px-4 py-4 hover:border-[#ffd700]/45 items-center transition-all group cursor-pointer'
                >
                  <div className='col-span-6 flex items-center gap-4'>
                    <div className='w-10 h-10 rounded-lg bg-foreground flex items-center justify-center'>
                      <Mail className='w-5 h-5 product-helper-text' />
                    </div>
                    <div className='min-w-0'>
                      <h3 className='font-semibold text-foreground truncate'>
                        {letter.name || "Untitled"}
                      </h3>
                      <p className='product-helper-text text-xs'>Cover Letter</p>
                    </div>
                  </div>
                  <div className='col-span-3 product-helper-text text-sm'>
                    {new Date(letter.updated_at).toLocaleDateString()}
                  </div>
                  <div className='col-span-3 flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity'>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(e, letter.id);
                      }}
                      className='p-2 product-helper-text hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors'
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
    </div>
  );
};

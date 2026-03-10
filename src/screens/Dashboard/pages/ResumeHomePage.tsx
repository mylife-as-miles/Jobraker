import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Upload,
  FileText,
  MoreVertical,
  Grid,
  List,
  Calendar,
  Edit2,
  Trash2,
  Download,
} from "lucide-react";
import { useArtboardStore } from "../../../store/artboard";
import { Button } from "../../../components/ui/button";
import { motion } from "framer-motion";
import { ResumeCreationModal } from "../components/ResumeCreationModal";
import { ResumePreviewCard } from "../components/ResumePreviewCard";
import { createClient } from "@/lib/supabaseClient";
import { extractTextFromPdf } from "@/lib/pdf-loader";
import { parseResumeWithAI } from "@/services/ai/parseResumeProfile";
import { mapParsedDataToResume } from "@/lib/resume-mapper";
import { initialResumeState } from "@/store/artboard";
import { nanoid } from "nanoid";

const supabase = createClient();

export const ResumeHomePage = () => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [resumes, setResumes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const setResumeId = useArtboardStore((state) => state.setResumeId);
  const setResumeTitle = useArtboardStore((state) => state.setResumeTitle);

  useEffect(() => {
    const fetchResumes = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from("resumes")
          .select("*")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false });

        if (data) setResumes(data);
        if (error) console.error(error);
      } catch (error) {
        console.error("Error fetching resumes:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchResumes();
  }, []);

  const handleCreateNew = () => {
    setIsCreateModalOpen(true);
  };

  const handleEdit = (id: string, name: string) => {
    setResumeId(id);
    setResumeTitle(name);
    navigate(`/dashboard/resume/edit/${id}`);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      console.log("Extracting text from PDF...");
      const text = await extractTextFromPdf(file);

      console.log("Parsing with AI...");
      const parsedData = await parseResumeWithAI({ resumeText: text });

      console.log("Mapping to ResumeData...");
      const resumeData = mapParsedDataToResume(
        parsedData,
        initialResumeState.data,
      );

      // Generate slug
      const baseSlug = resumeData.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");
      const slug = `${baseSlug}-${nanoid(6)}`;

      console.log("Saving to Database...");
      const { data, error } = await supabase
        .from("resumes")
        .insert({
          user_id: (await supabase.auth.getUser()).data.user?.id,
          name: resumeData.title,
          slug: slug,
          tags: [], // Could auto-tag "Imported"
          data: resumeData,
        })
        .select()
        .single();

      if (error) throw error;

      console.log("Import successful, navigating...");
      navigate(`/dashboard/resume/edit/${data.id}`);
    } catch (error: any) {
      console.error("Import failed:", error);
      alert(`Import failed: ${error.message}`);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className='flex flex-col h-full bg-background text-foreground p-8 overflow-y-auto'>
      <input
        type='file'
        ref={fileInputRef}
        onChange={handleFileChange}
        accept='.pdf'
        className='hidden'
      />

      {/* Header */}
      <div className='flex items-center justify-between mb-8'>
        <div>
          <h1 className='text-2xl font-bold'>Resumes</h1>
          <p className='text-foreground/60 text-sm mt-1'>
            Manage and create your professional resumes
          </p>
        </div>

        <div className='flex items-center gap-3'>
          {/* View Toggle */}
          <div className='bg-foreground p-1 rounded-lg flex items-center border border-foreground'>
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 rounded-md transition-all ${viewMode === "grid" ? "bg-foreground/60 text-foreground shadow-sm" : "text-foreground/60 hover:text-foreground/60"}`}
            >
              <Grid className='w-4 h-4' />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 rounded-md transition-all ${viewMode === "list" ? "bg-foreground/60 text-foreground shadow-sm" : "text-foreground/60 hover:text-foreground/60"}`}
            >
              <List className='w-4 h-4' />
            </button>
          </div>

          <Button
            onClick={handleCreateNew}
            className='bg-[#1dff00] text-foreground hover:bg-[#1dff00]/90 gap-2 font-semibold'
          >
            <Plus className='w-4 h-4' />
            Create New
          </Button>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className='grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6'>
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className='aspect-[3/4] rounded-xl bg-foreground/40 border border-foreground/5 overflow-hidden flex flex-col'
            >
              {/* Preview skeleton */}
              <div className='flex-1 bg-gradient-to-br from-foreground/5 to-foreground/5 relative overflow-hidden'>
                <div
                  className='absolute inset-0 bg-gradient-to-r from-transparent via-foreground/40 to-transparent animate-[shimmer_1.5s_infinite] -translate-x-full'
                  style={{ animation: `shimmer 1.5s infinite ${i * 0.15}s` }}
                />
                {/* Fake resume lines */}
                <div className='p-6 space-y-3 pt-8'>
                  <div className='h-3 bg-foreground/5 rounded-full w-2/3 mx-auto' />
                  <div className='h-2 bg-foreground/40 rounded-full w-1/2 mx-auto' />
                  <div className='h-px bg-foreground/5 w-full mt-4' />
                  <div className='space-y-2 mt-4'>
                    <div className='h-2 bg-foreground/40 rounded-full w-1/3' />
                    <div className='h-2 bg-foreground/5 rounded-full w-full' />
                    <div className='h-2 bg-foreground/5 rounded-full w-5/6' />
                    <div className='h-2 bg-foreground/5 rounded-full w-4/6' />
                  </div>
                  <div className='space-y-2 mt-4'>
                    <div className='h-2 bg-foreground/40 rounded-full w-1/4' />
                    <div className='h-2 bg-foreground/5 rounded-full w-full' />
                    <div className='h-2 bg-foreground/5 rounded-full w-3/4' />
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
      )}

      {!loading && viewMode === "grid" && (
        <div className='grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6'>
          {/* Create New Card */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleCreateNew}
            className='aspect-[3/4] rounded-xl border border-dashed border-foreground/10 bg-foreground/5 hover:bg-foreground/5 hover:border-[#1dff00]/30 cursor-pointer flex flex-col items-center justify-center gap-4 transition-all group'
          >
            <div className='w-16 h-16 rounded-full bg-[#1dff00]/10 flex items-center justify-center text-[#1dff00] group-hover:scale-110 transition-transform'>
              <Plus className='w-8 h-8' />
            </div>
            <span className='font-medium text-foreground/60 group-hover:text-foreground transition-colors'>
              Create New Resume
            </span>
          </motion.div>

          {/* Import Existing Card */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleImportClick}
            className='aspect-[3/4] rounded-xl border border-dashed border-foreground/10 bg-foreground/5 hover:bg-foreground/5 hover:border-foreground/20 cursor-pointer flex flex-col items-center justify-center gap-4 transition-all group relative'
          >
            {isImporting ? (
              <div className='flex flex-col items-center gap-3'>
                <div className='w-8 h-8 border-2 border-[#1dff00] border-t-transparent rounded-full animate-spin' />
                <span className='text-xs text-foreground/60 animate-pulse'>
                  Analyzing PDF...
                </span>
              </div>
            ) : (
              <>
                <div className='w-16 h-16 rounded-full bg-foreground/5 flex items-center justify-center text-[#1dff00]  group-hover:scale-110 transition-transform'>
                  <Upload className='w-8 h-8' />
                </div>
                <span className='font-medium text-foreground/60 group-hover:text-foreground transition-colors'>
                  Import Existing
                </span>
              </>
            )}
          </motion.div>

          {/* Resume Cards */}
          {resumes.map((resume) => (
            <motion.div
              key={resume.id}
              whileHover={{ y: -5 }}
              className='aspect-[3/4] rounded-xl bg-foreground/10 border overflow-hidden group hover:shadow-xl transition-all relative flex flex-col'
            >
              {/* Preview Area (Top 2/3) */}
              <div
                onClick={() => handleEdit(resume.id, resume.name)}
                className='flex-1 bg-white relative cursor-pointer overflow-hidden'
              >
                {/* Mini Resume Preview */}
                <ResumePreviewCard data={resume.data} />

                {/* Overlay on hover */}
                <div className='absolute inset-0 bg-foreground/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2'>
                  <Button size='sm' variant='secondary' className='gap-2'>
                    <Edit2 className='w-3 h-3' /> Edit
                  </Button>
                </div>
              </div>

              {/* Meta Info (Bottom) */}
              <div className='p-4 border-t border-foreground/5'>
                <div className='flex items-start justify-between'>
                  <div>
                    <h3 className='font-semibold text-foreground truncate pr-2'>
                      {resume.name}
                    </h3>
                    <p className='text-xs text-foreground/60 mt-1 flex items-center gap-1'>
                      <Calendar className='w-3 h-3' />
                      Last edited{' '}
                      {new Date(resume.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                  {/* <button className='text-foreground/60 hover:text-foreground/60 p-1 rounded hover:bg-foreground/5'>
                    <MoreVertical className='w-4 h-4' />
                  </button> */}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* List View */}
      {!loading && viewMode === "list" && (
        <div className='space-y-4'>
          <div className='grid grid-cols-12 gap-4 px-4 py-2 text-xs font-medium text-foreground/60 uppercase tracking-wider'>
            <div className='col-span-6'>Name</div>
            <div className='col-span-3'>Last Modified</div>
            <div className='col-span-3 text-right'>Actions</div>
          </div>
          {resumes.map((resume) => (
            <div
              key={resume.id}
              className='grid grid-cols-12 gap-4 px-4 py-4 rounded-xl bg-foreground/40 border border-foreground/5 hover:bg-foreground/5 items-center transition-all group'
            >
              <div className='col-span-6 flex items-center gap-4'>
                <div className='w-10 h-10 rounded-lg bg-white flex items-center justify-center'>
                  <FileText className='w-5 h-5 text-foreground/60' />
                </div>
                <div>
                  <h3 className='font-semibold text-foreground'>{resume.name}</h3>
                  <p className='text-xs text-foreground/60'>A4 • PDF</p>
                </div>
              </div>
              <div className='col-span-3 text-sm text-foreground/60'>
                {new Date(resume.updated_at).toLocaleDateString()}
              </div>
              <div className='col-span-3 flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity'>
                <button
                  onClick={() => handleEdit(resume.id, resume.name)}
                  className='p-2 text-foreground/60 hover:text-foreground/60 hover:bg-foreground/5 rounded-lg'
                  title='Edit'
                >
                  <Edit2 className='w-4 h-4' />
                </button>
                <button
                  className='p-2 text-foreground/60 hover:text-foreground/60 hover:bg-foreground/5 rounded-lg'
                  title='Download'
                >
                  <Download className='w-4 h-4' />
                </button>
                <button
                  className='p-2 text-foreground/60 hover:text-red-400 hover:bg-red-500/10 rounded-lg'
                  title='Delete'
                >
                  <Trash2 className='w-4 h-4' />
                </button>
              </div>
            </div>
          ))}

          <div
            onClick={handleCreateNew}
            className='grid grid-cols-12 gap-4 px-4 py-4 rounded-xl border border-dashed border-foreground/10 bg-foreground/5 hover:bg-foreground/5 cursor-pointer items-center group transition-all'
          >
            <div className='col-span-6 flex items-center gap-3'>
              <div className='w-10 h-10 rounded-lg bg-[#1dff00]/10 flex items-center justify-center text-[#1dff00]'>
                <Plus className='w-5 h-5' />
              </div>
              <span className='font-medium text-gray-300 group-hover:text-foreground'>
                Create New Resume
              </span>
            </div>
          </div>
        </div>
      )}

      <ResumeCreationModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
      />
    </div>
  );
};

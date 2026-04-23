import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { createClient } from "../../lib/supabaseClient";
import { useArtboardStore } from "../../store/artboard";
import { Loader2, AlertCircle, Download } from "lucide-react";
import { Button } from "../../components/ui/button";
import { downloadResumePDF } from "../../utils/resume-download";
import { ResumeTemplateRenderer } from "../../templates/render-resume-template";

export const PublicResumePage = () => {
  const { id } = useParams();
  const supabase = createClient();
  const setResumeData = useArtboardStore((state) => state.setResumeData);
  const resumeData = useArtboardStore((state) => state.resume.data);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchResume = async () => {
      try {
        const { data, error } = await supabase
          .from("resumes")
          .select("*")
          .eq("id", id)
          .single();

        if (error) throw error;
        if (!data.public_share_enabled) {
          throw new Error("This resume is not public.");
        }

        setResumeData(data.data);

        await supabase.rpc("increment_resume_stat", {
          p_resume_id: id,
          p_stat_type: "views",
        });
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Failed to load resume");
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchResume();
  }, [id, supabase, setResumeData]);

  const handleDownload = async () => {
    await supabase.rpc("increment_resume_stat", {
      p_resume_id: id,
      p_stat_type: "downloads",
    });

    await downloadResumePDF(resumeData);
  };

  if (loading)
    return (
      <div className='flex items-center justify-center h-screen product-page-shell text-foreground'>
        <Loader2 className='animate-spin w-8 h-8' />
      </div>
    );
  if (error)
    return (
      <div className='flex flex-col items-center justify-center h-screen gap-4 product-page-shell text-foreground'>
        <AlertCircle className='w-10 h-10 text-brand' />
        <p className='text-lg'>{error}</p>
      </div>
    );

  return (
    <div className='product-page-shell min-h-screen flex flex-col'>
      <header className='sticky top-0 z-50 flex items-center justify-between border-b border-border/40 bg-background/95 px-8 backdrop-blur supports-[backdrop-filter]:bg-background/85 h-16'>
        <span className='product-page-title text-xl font-bold'>
          {resumeData.basics.name}
        </span>
        <Button
          onClick={handleDownload}
          className='bg-brand text-black hover:bg-brand'
        >
          <Download className='w-4 h-4 mr-2' />
          Download PDF
        </Button>
      </header>
      <div className='flex-1 flex justify-center overflow-y-auto p-8'>
        <div className='bg-white shadow-2xl min-h-[1123px] w-[794px] origin-top scale-100 sm:scale-100 md:scale-100'>
          <ResumeTemplateRenderer templateId={resumeData.metadata.template} />
        </div>
      </div>
    </div>
  );
};

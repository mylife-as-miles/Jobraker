import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { createClient } from "../../lib/supabaseClient";
import { useArtboardStore } from "../../store/artboard";
import { Loader2, AlertCircle, Download, Lock } from "lucide-react";
import { Button } from "../../components/ui/button";
import { downloadResumePDF } from "../../utils/resume-download";
import { ResumeTemplateRenderer } from "../../templates/render-resume-template";

export const PublicResumePage = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || null;

  const supabase = createClient();
  const setResumeData = useArtboardStore((state) => state.setResumeData);
  const resumeData = useArtboardStore((state) => state.resume.data);

  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [isPrivateDenied, setIsPrivateDenied] = useState(false);

  useEffect(() => {
    const fetchResume = async () => {
      try {
        let resumeRecord: any = null;

        // 1. Try get_shared_resume RPC (handles public and private token securely)
        const { data: rpcData, error: rpcError } = await supabase.rpc(
          "get_shared_resume",
          {
            p_resume_id: id,
            p_token: token,
          },
        );

        if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
          resumeRecord = rpcData[0];
        } else {
          // 2. Direct query fallback
          const { data, error } = await supabase
            .from("resumes")
            .select("*")
            .eq("id", id)
            .single();

          if (error) throw error;

          const isAuthorized =
            data.public_share_enabled === true ||
            (token && data.share_token && data.share_token === token);

          if (!isAuthorized) {
            setIsPrivateDenied(true);
            throw new Error("This resume is private.");
          }

          resumeRecord = data;
        }

        if (!resumeRecord?.data) {
          throw new Error("Resume content could not be loaded.");
        }

        setResumeData(resumeRecord.data);

        // 3. Track view
        try {
          await supabase.rpc("increment_resume_stat", {
            p_resume_id: id,
            p_stat_type: "views",
            p_token: token,
          });
        } catch (statErr) {
          console.warn("Could not increment view stat:", statErr);
        }
      } catch (err: any) {
        console.error("Error loading shared resume:", err);
        setError(err.message || "Failed to load resume");
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchResume();
  }, [id, token, supabase, setResumeData]);

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      // 1. Track download
      try {
        await supabase.rpc("increment_resume_stat", {
          p_resume_id: id,
          p_stat_type: "downloads",
          p_token: token,
        });
      } catch (statErr) {
        console.warn("Could not increment download stat:", statErr);
      }

      // 2. Trigger PDF download
      await downloadResumePDF(resumeData);
    } catch (err) {
      console.error("Download failed:", err);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className='flex items-center justify-center h-screen product-page-shell text-foreground'>
        <div className='flex flex-col items-center gap-3'>
          <Loader2 className='animate-spin w-8 h-8 text-brand' />
          <p className='text-sm text-muted-foreground'>Loading resume...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='flex flex-col items-center justify-center min-h-screen gap-4 product-page-shell text-foreground p-6 text-center'>
        {isPrivateDenied ? (
          <div className='max-w-md p-8 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl space-y-4 shadow-xl'>
            <div className='w-12 h-12 rounded-2xl bg-brand/10 flex items-center justify-center text-brand mx-auto'>
              <Lock className='w-6 h-6' />
            </div>
            <h1 className='text-xl font-bold'>Private Resume</h1>
            <p className='text-sm text-muted-foreground leading-relaxed'>
              This resume is currently set to private. If you were provided a private share link, please make sure you opened the full URL including the access token.
            </p>
          </div>
        ) : (
          <div className='max-w-md p-8 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl space-y-4 shadow-xl'>
            <AlertCircle className='w-12 h-12 text-destructive mx-auto' />
            <h1 className='text-xl font-bold'>Unable to Load Resume</h1>
            <p className='text-sm text-muted-foreground'>{error}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className='product-page-shell min-h-screen flex flex-col'>
      <header className='sticky top-0 z-50 flex items-center justify-between border-b border-border/40 bg-background/95 px-6 md:px-8 backdrop-blur supports-[backdrop-filter]:bg-background/85 h-16'>
        <span className='product-page-title text-lg md:text-xl font-bold truncate max-w-[280px] md:max-w-md'>
          {resumeData.basics.name}
        </span>
        <Button
          onClick={handleDownload}
          disabled={downloading}
          className='bg-brand text-black hover:bg-brand/90 font-semibold'
        >
          {downloading ? (
            <Loader2 className='w-4 h-4 mr-2 animate-spin' />
          ) : (
            <Download className='w-4 h-4 mr-2' />
          )}
          {downloading ? "Preparing PDF..." : "Download PDF"}
        </Button>
      </header>
      <div className='flex-1 flex justify-center overflow-y-auto p-4 md:p-8'>
        <div className='bg-white shadow-2xl min-h-[1123px] w-[794px] origin-top scale-100 sm:scale-100 md:scale-100'>
          <ResumeTemplateRenderer templateId={resumeData.metadata.template} />
        </div>
      </div>
    </div>
  );
};

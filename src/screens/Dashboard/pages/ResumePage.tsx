import { useRef, useState } from "react";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import { Download, Eye, Plus, Star, Copy, Trash2, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useResumes, type ResumeRecord } from "../../../hooks/useResumes";
import ConfirmDialog from "../../../components/ui/confirm-dialog";

export const ResumePage = (): JSX.Element => {
  const { resumes, loading, error, upload, createEmpty, toggleFavorite, remove, duplicate, view, download, rename } = useResumes();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>("");
  const [toDelete, setToDelete] = useState<ResumeRecord | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Active":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "Draft":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "Archived":
        return "bg-gray-500/20 text-gray-400 border-gray-500/30";
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-border/50 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h1 className="text-xl sm:text-2xl font-semibold">Resumes</h1>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              multiple
              onChange={async (e) => {
                const files = Array.from(e.target.files || []);
                if (files.length) await upload(files);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <UploadIcon className="mr-2 h-4 w-4" /> Upload
            </Button>
            <Button onClick={() => void createEmpty({})}>
              <Plus className="mr-2 h-4 w-4" /> New Resume
            </Button>
          </div>
        </div>
      </div>

      {/* Confirm Delete */}
      <ConfirmDialog
        open={!!toDelete}
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          if (toDelete) await remove(toDelete);
          setToDelete(null);
        }}
        title="Delete resume?"
        message={<span>“{toDelete?.name}” will be permanently deleted.</span>}
        confirmText="Delete"
      />

      {/* Grid */}
      <div className="p-4 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-6">
          {/* Upload card */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: 0.05 }}>
            <Card
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={async (e) => {
                e.preventDefault();
                setIsDragOver(false);
                const files = Array.from(e.dataTransfer.files || []);
                if (files.length) await upload(files);
              }}
              className={`border-dashed cursor-pointer transition ${isDragOver ? "border-primary bg-primary/5" : ""}`}
            >
              <CardContent className="p-6 h-full flex items-center justify-center text-center">
                <div>
                  <Plus className="mx-auto h-10 w-10 text-primary mb-3" />
                  <div className="font-medium">Upload Resume</div>
                  <div className="text-xs text-muted-foreground mt-1">Drag & drop or click to browse</div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Existing resumes */}
          {loading && (
            <div className="col-span-full flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
            </div>
          )}

          {!loading && resumes.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              No resumes yet. Create or upload to get started.
            </div>
          )}

          {resumes.map((resume) => (
            <motion.div key={resume.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
              <Card className="group h-full">
                <CardContent className="p-4 flex flex-col h-full">
                  {/* Thumbnail */}
                  <div className="relative mb-3">
                    <div className="w-full aspect-[8/11] rounded-md bg-muted/50 border" />
                    <button
                      className={`absolute top-2 right-2 inline-flex items-center justify-center rounded-full p-1.5 border transition ${resume.is_favorite ? "text-yellow-400 border-yellow-400/40 bg-yellow-400/10" : "text-muted-foreground hover:text-foreground"}`}
                      onClick={() => toggleFavorite(resume.id, !resume.is_favorite)}
                      aria-label="Toggle favorite"
                    >
                      <Star className={`h-4 w-4 ${resume.is_favorite ? "fill-current" : ""}`} />
                    </button>
                    <div className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] border ${getStatusColor(resume.status)}`}>
                      {resume.status}
                    </div>
                  </div>

                  {/* Title + meta */}
                  <div className="flex-1">
                    {renameId === resume.id ? (
                      <input
                        className="w-full bg-transparent border-b outline-none text-sm font-medium"
                        value={renameValue}
                        autoFocus
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => {
                          if (renameValue && renameValue !== resume.name) rename(resume.id, renameValue);
                          setRenameId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                          if (e.key === "Escape") setRenameId(null);
                        }}
                      />
                    ) : (
                      <div
                        className="text-sm font-medium truncate cursor-text"
                        title="Click to rename"
                        onClick={() => { setRenameId(resume.id); setRenameValue(resume.name); }}
                      >
                        {resume.name}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {resume.template || "Custom"} • Updated {new Date(resume.updated_at).toLocaleString()}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    <Button variant="outline" size="sm" onClick={() => view(resume)} aria-label="View">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => download(resume)} aria-label="Download">
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => duplicate(resume)} aria-label="Duplicate">
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" className="hover:text-red-500" onClick={() => setToDelete(resume)} aria-label="Delete">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {error && (
          <div className="mt-4 text-sm text-red-500">{error}</div>
        )}
      </div>
    </div>
  );
};

const UploadIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" x2="12" y1="3" y2="15" />
  </svg>
);
import { useRef, useState } from "react";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import { Download, Edit, Eye, Plus, Upload, Star, MoreVertical, Copy, Trash2, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useResumes, type ResumeRecord } from "../../../hooks/useResumes";
import Modal from "../../../components/ui/modal";
import ConfirmDialog from "../../../components/ui/confirm-dialog";

export const ResumePage = (): JSX.Element => {
  const { resumes, loading, error, upload, createEmpty, toggleFavorite, remove, duplicate, view, download, rename, update, replaceFile } = useResumes();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>("");
  const [toDelete, setToDelete] = useState<ResumeRecord | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ResumeRecord | null>(null);
  const editorFileInput = useRef<HTMLInputElement | null>(null);

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
    <div className="min-h-screen bg-black">
      <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8 lg:mb-10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-6">
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-2">Resume Builder</h1>
              <p className="text-[#888888] text-sm sm:text-base lg:text-lg max-w-2xl leading-relaxed">
                Upload your resume to get a tailored resume that increases your chances of getting hired
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <Button
                className="bg-[#1dff00] text-black hover:bg-[#1dff00]/90 hover:scale-105 transition-all duration-300 text-sm sm:text-base"
                onClick={() => createEmpty({})}
                disabled={loading}
                aria-label="Create new resume"
                title="Create new resume"
              >
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                New Resume
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                multiple
                onChange={async (e) => {
                  const files = e.target.files;
                  if (!files || files.length === 0) return;
                  await upload(Array.from(files));
                  // reset
                  e.currentTarget.value = "";
                }}
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="border-[#1dff00]/30 text-[#1dff00] hover:bg-[#1dff00]/10 hover:border-[#1dff00]/50 hover:scale-105 transition-all duration-300 text-sm sm:text-base"
                disabled={loading}
                aria-label="Import resumes"
                title="Import resumes"
              >
                <Upload className="w-4 h-4 mr-2" />
                Import
              </Button>
            </div>
          </div>
        </div>
        {/* Confirm Delete (global) */}
        <ConfirmDialog
          open={!!toDelete}
          onCancel={() => setToDelete(null)}
          onConfirm={async () => { if (toDelete) { await remove(toDelete); setToDelete(null); } }}
          title="Delete resume?"
          message={<span>“{toDelete?.name}” will be permanently deleted.</span>}
          confirmText="Delete"
        />

        {/* Editor Drawer (global) */}
        <Modal open={editorOpen} onClose={() => setEditorOpen(false)} title={editing ? `Edit: ${editing.name}` : "Edit Resume"} side="right">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-[#aaa]">Status</div>
              <select
                className="bg-transparent border border-[#1dff00]/30 rounded px-2 py-1 text-sm text-white"
                value={editing?.status || "Draft"}
                onChange={(e) => editing && update(editing.id, { status: e.target.value as any })}
              >
                <option value="Active">Active</option>
                <option value="Draft">Draft</option>
                <option value="Archived">Archived</option>
              </select>
            </div>
            <div className="space-y-2">
              <div className="text-sm text-[#aaa]">Template</div>
              <input
                className="w-full bg-transparent border border-[#1dff00]/30 rounded px-3 py-2 text-sm text-white"
                value={editing?.template || ""}
                onChange={(e) => editing && update(editing.id, { template: e.target.value })}
                placeholder="Template name"
              />
            </div>
            <div className="space-y-2">
              <div className="text-sm text-[#aaa]">Replace file</div>
              <input ref={editorFileInput} type="file" className="hidden" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f && editing) await replaceFile(editing.id, f);
                if (editorFileInput.current) editorFileInput.current.value = "";
              }} />
              <Button onClick={() => editorFileInput.current?.click()} className="text-xs">Upload new file</Button>
            </div>
            <div className="space-y-2">
              <div className="text-sm text-[#aaa]">Applications count</div>
              <input
                type="number"
                min={0}
                className="w-full bg-transparent border border-[#1dff00]/30 rounded px-3 py-2 text-sm text-white"
                value={editing?.applications ?? 0}
                onChange={(e) => editing && update(editing.id, { applications: Number(e.target.value) })}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setEditorOpen(false)}>Close</Button>
            </div>
          </div>
        </Modal>

        {/* Resume Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
          {loading && resumes.length === 0 && (
            <div className="col-span-full flex items-center justify-center py-16 text-[#888888]">
              <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Loading resumes...
            </div>
          )}
          {!loading && resumes.length === 0 && (
            <div className="col-span-full text-center text-[#888888] py-16">
              No resumes yet. Create or import to get started.
            </div>
          )}
          {/* Existing Resumes */}
          {resumes.map((resume: ResumeRecord, index) => (
            <motion.div
              key={resume.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              whileHover={{ scale: 1.02 }}
              className="transition-transform duration-300"
            >
              <Card className="bg-gradient-to-br from-[#0a0a0a] via-[#111111] to-[#0a0a0a] border border-[#1dff00]/20 backdrop-blur-[25px] hover:shadow-xl hover:border-[#1dff00]/50 hover:shadow-[#1dff00]/20 transition-all duration-300 group h-full">
                <CardContent className="p-4 sm:p-5 lg:p-6 h-full flex flex-col">
                  {/* Resume Thumbnail */}
                  <div className="relative mb-4 sm:mb-5">
                    <div className="w-full h-40 sm:h-48 lg:h-56 bg-[#222222] rounded-lg border border-[#1dff00]/20 flex items-center justify-center group-hover:border-[#1dff00]/50 transition-all duration-300">
                      {/* Gray placeholder matching screenshot */}
                      <div className="w-full h-full bg-gradient-to-br from-[#222222] to-[#333333] rounded-lg flex items-center justify-center">
                        <div className="text-[#888888] text-xs sm:text-sm font-medium">{resume.file_ext?.toUpperCase() || "Resume"} Preview</div>
                      </div>
                    </div>
                    
                    {/* Favorite Star */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`absolute top-2 right-2 p-1 rounded-full transition-all duration-300 ${
                        resume.is_favorite 
                          ? "text-yellow-400 bg-yellow-400/20 hover:bg-yellow-400/30" 
                          : "text-[#666666] hover:text-yellow-400 hover:bg-yellow-400/20"
                      }`}
                      onClick={() => toggleFavorite(resume.id, !resume.is_favorite)}
                      aria-label={resume.is_favorite ? "Unfavorite" : "Favorite"}
                    >
                      <Star className={`w-3 h-3 sm:w-4 sm:h-4 ${resume.is_favorite ? "fill-current" : ""}`} />
                    </Button>

                    {/* Status Badge */}
                    <div className={`absolute top-2 left-2 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(resume.status)}`}>
                      {resume.status}
                    </div>
                    
                    {/* Overlay Actions */}
                    <div className="absolute inset-0 bg-black/60 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center space-x-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-[#1dff00] hover:bg-[#1dff00]/20 hover:scale-110 transition-all duration-300"
                        onClick={() => view(resume)}
                        aria-label="View"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-[#1dff00] hover:bg-[#1dff00]/20 hover:scale-110 transition-all duration-300"
                        onClick={() => {
                          // Placeholder for editor route/modal
                          alert("Edit coming soon");
                        }}
                        aria-label="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-[#1dff00] hover:bg-[#1dff00]/20 hover:scale-110 transition-all duration-300"
                        onClick={() => download(resume)}
                        aria-label="Download"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-[#1dff00] hover:bg-[#1dff00]/20 hover:scale-110 transition-all duration-300"
                        aria-label="More"
                        onClick={() => duplicate(resume)}
                        title="Duplicate"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Resume Info */}
                  <div className="space-y-3 sm:space-y-4 flex-grow">
                    <div>
                      {renameId === resume.id ? (
                        <input
                          className="w-full bg-transparent text-white font-semibold text-sm sm:text-base lg:text-lg mb-1 border-b border-[#1dff00]/40 focus:border-[#1dff00] outline-none"
                          value={renameValue}
                          autoFocus
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={() => {
                            if (renameValue && renameValue !== resume.name) rename(resume.id, renameValue);
                            setRenameId(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              (e.target as HTMLInputElement).blur();
                            } else if (e.key === "Escape") {
                              setRenameId(null);
                            }
                          }}
                        />
                      ) : (
                        <h3
                          className="text-white font-semibold text-sm sm:text-base lg:text-lg mb-1 truncate cursor-text"
                          onClick={() => {
                            setRenameId(resume.id);
                            setRenameValue(resume.name);
                          }}
                          title="Click to rename"
                        >
                          {resume.name}
                        </h3>
                      )}
                      <p className="text-[#888888] text-xs sm:text-sm">{resume.template || "Custom"}</p>
                    </div>
                    
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <span className="text-[#666666]">Updated {new Date(resume.updated_at).toLocaleString()}</span>
                      <span className="text-white font-medium">{resume.applications} apps</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 mt-4 pt-4 border-t border-[#1dff00]/20">
                    <Button
                      size="sm"
                      className="flex-1 bg-[#1dff00] text-black hover:bg-[#1dff00]/90 hover:scale-105 transition-all duration-300 text-xs sm:text-sm"
                      onClick={() => { setEditing(resume); setEditorOpen(true); }}
                    >
                      <Edit className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-[#1dff00]/30 text-[#1dff00] hover:bg-[#1dff00]/10 hover:border-[#1dff00]/50 hover:scale-105 transition-all duration-300"
                      onClick={() => duplicate(resume)}
                      aria-label="Duplicate"
                    >
                      <Copy className="w-3 h-3 sm:w-4 sm:h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-[#1dff00]/30 text-[#1dff00] hover:bg-[#1dff00]/10 hover:border-red-500/50 hover:text-red-400 hover:scale-105 transition-all duration-300"
                      onClick={() => setToDelete(resume)}
                      aria-label="Delete"
                    >
                      <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}

          {/* Upload Resume Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            whileHover={{ scale: 1.02 }}
            className="transition-transform duration-300"
          >
            <Card onClick={() => fileInputRef.current?.click()} className="bg-transparent border-2 border-dashed border-[#1dff00] hover:bg-[#1dff00]/10 hover:border-[#1dff00]/80 hover:shadow-lg hover:shadow-[#1dff00]/20 transition-all duration-300 group cursor-pointer h-full min-h-[300px] sm:min-h-[350px] lg:min-h-[400px]">
              <CardContent className="p-4 sm:p-5 lg:p-6 h-full flex flex-col">
                {/* Upload Area */}
                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 sm:space-y-6">
                  <motion.div 
                    className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 bg-[#1dff00] rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300"
                    whileHover={{ rotate: 180 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Plus className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 text-black" />
                  </motion.div>
                  <div>
                    <h3 className="text-[#1dff00] font-semibold text-base sm:text-lg lg:text-xl mb-2">Upload Resume</h3>
                    <p className="text-[#888888] text-xs sm:text-sm lg:text-base max-w-xs">
                      Drag and drop your resume here or click to browse
                    </p>
                  </div>
                  <div className="text-xs sm:text-sm text-[#666666]">
                    Supports PDF, DOC, DOCX
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Create New Resume Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            whileHover={{ scale: 1.02 }}
            className="transition-transform duration-300"
          >
            <Card onClick={() => createEmpty({})} className="bg-gradient-to-br from-[#0a0a0a] via-[#111111] to-[#0a0a0a] border border-[#1dff00]/20 backdrop-blur-[25px] hover:shadow-xl hover:border-[#1dff00]/50 hover:shadow-[#1dff00]/20 transition-all duration-300 group cursor-pointer h-full min-h-[300px] sm:min-h-[350px] lg:min-h-[400px]">
              <CardContent className="p-4 sm:p-5 lg:p-6 h-full flex flex-col">
                {/* Create Area */}
                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 sm:space-y-6">
                  <motion.div 
                    className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 bg-gradient-to-r from-[#1dff00]/20 to-[#0a8246]/20 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300"
                    whileHover={{ rotate: 360 }}
                    transition={{ duration: 0.5 }}
                  >
                    <Edit className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 text-[#1dff00]" />
                  </motion.div>
                  <div>
                    <h3 className="text-white font-semibold text-base sm:text-lg lg:text-xl mb-2">Create New Resume</h3>
                    <p className="text-[#888888] text-xs sm:text-sm lg:text-base max-w-xs">
                      Start from scratch with our professional templates
                    </p>
                  </div>
                  <Button
                    className="bg-[#1dff00] text-black hover:bg-[#1dff00]/90 hover:scale-105 transition-all duration-300 text-xs sm:text-sm"
                  >
                    Get Started
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Templates Section */}
        <div className="mt-12 sm:mt-16 lg:mt-20">
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-6 sm:mb-8">Popular Templates</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 sm:gap-6">
            {["Modern", "Classic", "Creative", "Minimal", "Professional", "Executive"].map((template, index) => (
              <motion.div
                key={template}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                whileHover={{ scale: 1.05 }}
                className="transition-transform duration-300"
              >
                <Card className="bg-gradient-to-br from-[#0a0a0a] via-[#111111] to-[#0a0a0a] border border-[#1dff00]/20 backdrop-blur-[25px] hover:shadow-lg hover:border-[#1dff00]/50 hover:shadow-[#1dff00]/20 transition-all duration-300 group cursor-pointer">
                  <CardContent className="p-3 sm:p-4">
                    <div className="aspect-[3/4] bg-[#222222] rounded-lg mb-3 flex items-center justify-center group-hover:bg-[#333333] transition-colors duration-300">
                      <span className="text-[#666666] text-xs sm:text-sm">{template}</span>
                    </div>
                    <h4 className="text-[#1dff00] font-medium text-xs sm:text-sm text-center">{template}</h4>
                    <h4 className="text-white font-medium text-xs sm:text-sm text-center">{template}</h4>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
        {error && (
          <div className="mt-6 text-red-400 text-sm">{error}</div>
        )}
      </div>
    </div>
  );
};
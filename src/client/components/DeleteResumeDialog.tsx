import React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DeleteResumeDialogProps {
  open: boolean;
  resumeName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const DeleteResumeDialog: React.FC<DeleteResumeDialogProps> = ({
  open,
  resumeName,
  onConfirm,
  onCancel,
  isLoading = false,
}) => {
  React.useEffect(() => {
    if (!open) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isLoading) {
        onCancel();
      }
    };

    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [open, onCancel, isLoading]);

  if (!open) return null;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          onClick={isLoading ? undefined : onCancel}
        />

        {/* Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", duration: 0.3, bounce: 0.2 }}
          className="relative z-10 w-full max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Glowing border effect */}
          <div className="absolute -inset-0.5 bg-gradient-to-r from-red-500/40 via-orange-500/40 to-red-500/40 rounded-2xl blur-xl opacity-75 animate-pulse" />
          
          <div className="relative bg-gradient-to-br from-[#0a0a0a] via-[#111111] to-[#0a0a0a] border border-red-500/30 rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-red-500/20 bg-gradient-to-r from-red-500/5 to-transparent">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Delete Resume</h3>
                  <p className="text-sm text-white/60 mt-0.5">This action cannot be undone</p>
                </div>
              </div>
              {!isLoading && (
                <button
                  onClick={onCancel}
                  className="w-8 h-8 rounded-lg hover:bg-white/5 flex items-center justify-center transition-colors text-white/60 hover:text-white"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <p className="text-white/80 leading-relaxed">
                Are you sure you want to delete <span className="font-semibold text-white">"{resumeName}"</span>?
              </p>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-red-500/5 border border-red-500/20">
                <Trash2 className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                <div className="space-y-1 text-sm text-white/70">
                  <p className="font-medium text-white/90">This will permanently:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>Delete the resume from your account</li>
                    <li>Remove all associated files and data</li>
                    <li>Remove it from any linked applications</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-white/5 bg-gradient-to-r from-transparent to-red-500/5">
              <Button
                variant="outline"
                onClick={onCancel}
                disabled={isLoading}
                className="border-white/10 text-white/70 hover:text-white hover:bg-white/5 hover:border-white/20"
              >
                Cancel
              </Button>
              <Button
                onClick={onConfirm}
                disabled={isLoading}
                className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white border-0 shadow-lg shadow-red-500/20 hover:shadow-red-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Deleting...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Trash2 className="w-4 h-4" />
                    Delete Resume
                  </span>
                )}
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
};


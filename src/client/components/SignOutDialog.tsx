import React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SignOutDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const SignOutDialog: React.FC<SignOutDialogProps> = ({
  open,
  onConfirm,
  onCancel,
  isLoading = false,
}) => {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onCancel]);

  if (!open) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={onCancel}
        />

        {/* Dialog Content */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: "spring", duration: 0.5 }}
          className="relative max-w-md w-full mx-auto overflow-hidden rounded-2xl"
        >
          {/* Pulsing border glow */}
          <div className="absolute -inset-1 bg-gradient-to-r from-orange-500/40 via-red-500/40 to-orange-500/40 rounded-2xl blur-2xl animate-pulse" />

          <div className="relative bg-gradient-to-br from-[#0a0a0a]/95 via-[#1a0a0a]/95 to-[#0a0a0a]/95 backdrop-blur-xl border border-orange-500/30 rounded-2xl shadow-2xl">
            {/* Close Button */}
            <button
              onClick={onCancel}
              className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors z-10"
              aria-label="Close dialog"
              disabled={isLoading}
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="p-6 text-center border-b border-orange-500/20">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/30 flex items-center justify-center">
                <LogOut className="w-8 h-8 text-orange-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Sign Out</h3>
              <p className="text-white/70 text-sm">
                Are you sure you want to sign out of your account?
              </p>
            </div>

            {/* Body */}
            <div className="p-6 text-white/60 text-sm space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                <AlertCircle className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-white/90 mb-1">You will be logged out from:</p>
                  <ul className="list-disc list-inside space-y-1 text-white/60">
                    <li>This device and browser session</li>
                    <li>All active sessions will be terminated</li>
                  </ul>
                </div>
              </div>
              <p className="text-white/50 text-xs">
                You can sign back in anytime using your credentials.
              </p>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-white/5 bg-gradient-to-r from-transparent to-orange-500/5">
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
                className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white border-0 shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Signing out...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </span>
                )}
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};


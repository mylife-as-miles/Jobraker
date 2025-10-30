import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../../lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  side?: "center" | "right"; // right behaves like a drawer
}

export const Modal: React.FC<ModalProps> = ({ open, onClose, title, children, footer, size = "md", side = "center" }) => {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) {
      document.addEventListener("keydown", onKey);
      // Prevent body scroll when modal is open
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  const sizes: Record<string, string> = {
    sm: "max-w-sm",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };

  return (
    <AnimatePresence mode="wait">
      {open && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md"
            onClick={onClose}
          />
          
          <div className="flex min-h-full items-center justify-center p-4">
            {side === "center" ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className={cn("relative z-10 w-full my-8", sizes[size])}
              >
                <div className="flex max-h-[calc(100vh-4rem)] flex-col rounded-2xl border border-[#1dff00]/30 bg-gradient-to-br from-[#0a0a0a] via-[#111111] to-[#0a0a0a] shadow-[0_0_40px_rgba(29,255,0,0.25)] backdrop-blur-xl">
                  {/* Animated glow effect */}
                  <div className="pointer-events-none absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-[#1dff00]/20 via-cyan-500/20 to-[#1dff00]/20 opacity-75 blur-sm animate-pulse" />
                  
                  <div className="relative flex flex-col max-h-[calc(100vh-4rem)]">
                    {title && (
                      <div className="flex-shrink-0 border-b border-[#1dff00]/20 px-6 py-4 bg-[#0a0a0a]/50">
                        <h3 className="text-white font-semibold text-lg">{title}</h3>
                      </div>
                    )}
                    <div className="flex-1 overflow-y-auto px-6 py-5 scrollbar-thin scrollbar-thumb-[#1dff00]/30 scrollbar-track-transparent">
                      {children}
                    </div>
                    {footer && (
                      <div className="flex-shrink-0 border-t border-[#1dff00]/20 px-6 py-4 bg-[#0a0a0a]/50">
                        {footer}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="fixed inset-y-0 right-0 z-10 w-full max-w-xl"
              >
                <div className="flex h-full flex-col border-l border-[#1dff00]/30 bg-gradient-to-br from-[#0a0a0a] via-[#111111] to-[#0a0a0a] shadow-[0_0_40px_rgba(29,255,0,0.25)]">
                  {title && (
                    <div className="flex-shrink-0 border-b border-[#1dff00]/20 px-6 py-4 bg-[#0a0a0a]/50 sticky top-0">
                      <h3 className="text-white font-semibold text-lg">{title}</h3>
                    </div>
                  )}
                  <div className="flex-1 overflow-y-auto px-6 py-5 scrollbar-thin scrollbar-thumb-[#1dff00]/30 scrollbar-track-transparent">
                    {children}
                  </div>
                  {footer && (
                    <div className="flex-shrink-0 border-t border-[#1dff00]/20 px-6 py-4 bg-[#0a0a0a]/50 sticky bottom-0">
                      {footer}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default Modal;

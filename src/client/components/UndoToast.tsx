import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, X, CheckCircle2 } from "lucide-react";
import { createPortal } from "react-dom";

interface UndoToastProps {
  id: string;
  title: string;
  description: string;
  onUndo: () => void;
  onDismiss: () => void;
  duration?: number; // in milliseconds
}

export const UndoToast: React.FC<UndoToastProps> = ({
  id,
  title,
  description,
  onUndo,
  onDismiss,
  duration = 6500,
}) => {
  const [progress, setProgress] = useState(100);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (isHovered) return;

    const interval = setInterval(() => {
      setProgress((prev) => {
        const decrement = (100 / duration) * 50; // Update every 50ms
        const next = prev - decrement;
        if (next <= 0) {
          clearInterval(interval);
          onDismiss();
          return 0;
        }
        return next;
      });
    }, 50);

    return () => clearInterval(interval);
  }, [isHovered, duration, onDismiss]);

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        transition={{ type: "spring", duration: 0.3 }}
        className="fixed top-4 right-4 z-[10001] w-full max-w-md pointer-events-auto"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="relative bg-gradient-to-br from-[#0a0a0a] via-[#111111] to-[#0a0a0a] border border-[#1dff00]/30 rounded-xl shadow-2xl overflow-hidden backdrop-blur-xl">
          {/* Glowing border effect */}
          <div className="absolute -inset-0.5 bg-gradient-to-r from-[#1dff00]/20 via-[#1dff00]/40 to-[#1dff00]/20 rounded-xl blur-lg opacity-50" />
          
          <div className="relative p-4">
            {/* Progress bar */}
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-white/5">
              <motion.div
                className="h-full bg-gradient-to-r from-[#1dff00] to-[#1dff00]/60"
                initial={{ width: "100%" }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.05, ease: "linear" }}
              />
            </div>

            <div className="flex items-start gap-3">
              {/* Icon */}
              <div className="w-10 h-10 rounded-lg bg-[#1dff00]/10 border border-[#1dff00]/30 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-5 h-5 text-[#1dff00]" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-white mb-1">{title}</h4>
                <p className="text-xs text-white/70 line-clamp-2">{description}</p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={onUndo}
                  className="px-3 py-1.5 rounded-lg bg-[#1dff00]/10 hover:bg-[#1dff00]/20 border border-[#1dff00]/30 text-[#1dff00] text-xs font-medium transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Undo
                </button>
                <button
                  onClick={onDismiss}
                  className="w-7 h-7 rounded-lg hover:bg-white/5 flex items-center justify-center transition-colors text-white/40 hover:text-white/70"
                  aria-label="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};

// Toast manager to handle multiple toasts
export class UndoToastManager {
  private toasts: Map<string, React.ReactNode> = new Map();
  private container: HTMLDivElement | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      this.container = document.createElement("div");
      this.container.id = "undo-toast-container";
      this.container.className = "fixed top-4 right-4 z-[10001] space-y-2 pointer-events-none";
      document.body.appendChild(this.container);
    }
  }

  show(toast: React.ReactNode, id: string) {
    this.toasts.set(id, toast);
    this.render();
  }

  dismiss(id: string) {
    this.toasts.delete(id);
    this.render();
  }

  private render() {
    if (!this.container) return;
    // This would be handled by React rendering
  }
}


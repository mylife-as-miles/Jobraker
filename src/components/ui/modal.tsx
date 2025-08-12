import React, { useEffect } from "react";
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
    }
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const sizes: Record<string, string> = {
    sm: "max-w-sm",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      {side === "center" ? (
        <div className="relative z-10 m-auto w-full px-4">
          <div className={cn(
            "mx-auto w-full rounded-lg border border-[#1dff00]/20 bg-gradient-to-br from-[#0a0a0a] via-[#111111] to-[#0a0a0a] shadow-[0_0_30px_rgba(29,255,0,0.2)]",
            sizes[size]
          )}>
            {title && (
              <div className="px-5 py-4 border-b border-[#1dff00]/20">
                <h3 className="text-white font-semibold">{title}</h3>
              </div>
            )}
            <div className="px-5 py-4">{children}</div>
            {footer && <div className="px-5 py-4 border-t border-[#1dff00]/20">{footer}</div>}
          </div>
        </div>
      ) : (
        <div className="relative z-10 ml-auto h-full w-full max-w-xl">
          <div className="h-full w-full border-l border-[#1dff00]/20 bg-gradient-to-br from-[#0a0a0a] via-[#111111] to-[#0a0a0a] shadow-[0_0_30px_rgba(29,255,0,0.2)]">
            {title && (
              <div className="px-5 py-4 border-b border-[#1dff00]/20 sticky top-0 bg-transparent">
                <h3 className="text-white font-semibold">{title}</h3>
              </div>
            )}
            <div className="px-5 py-4 h-[calc(100%-4rem)] overflow-auto">{children}</div>
            {footer && <div className="px-5 py-4 border-t border-[#1dff00]/20 sticky bottom-0 bg-transparent">{footer}</div>}
          </div>
        </div>
      )}
    </div>
  );
};

export default Modal;

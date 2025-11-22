import React, { useEffect } from "react";
import { createPortal } from "react-dom";
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
    if (!open) return;
    
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    
    // Prevent body scroll when modal is open
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const sizes: Record<string, string> = {
    sm: "max-w-sm",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] overflow-y-auto">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      {side === "center" ? (
        <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none">
          <div className={cn("relative z-10 w-full max-h-[90vh] overflow-y-auto pointer-events-auto", sizes[size])}>
            <div className="flex w-full flex-col rounded-lg border border-[#1dff00]/20 bg-gradient-to-br from-[#0a0a0a] via-[#111111] to-[#0a0a0a] shadow-[0_0_30px_rgba(29,255,0,0.2)]">
              {title && (
                <div className="border-b border-[#1dff00]/20 px-5 py-4">
                  <h3 className="text-white font-semibold">{title}</h3>
                </div>
              )}
              <div className="px-5 py-4">{children}</div>
              {footer && <div className="border-t border-[#1dff00]/20 px-5 py-4">{footer}</div>}
            </div>
          </div>
        </div>
      ) : (
        <div className="fixed inset-y-0 right-0 z-10 w-full max-w-xl">
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
    </div>,
    document.body
  );
};

export default Modal;
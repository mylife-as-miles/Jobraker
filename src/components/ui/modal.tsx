import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  side?: "center" | "right";
}

export const Modal: React.FC<ModalProps> = ({ open, onClose, title, children, footer, size = "md", side = "center" }) => {
  useEffect(() => {
    if (!open) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

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

  const closeButton = (
    <button
      type="button"
      aria-label={side === "right" ? "Close drawer" : "Close dialog"}
      className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      onClick={onClose}
    >
      <X className="h-4 w-4" />
    </button>
  );

  return createPortal(
    <div className="fixed inset-0 z-[9999] overflow-y-auto">
      <div className="fixed inset-0 bg-background/60 backdrop-blur-sm" onClick={onClose} />
      {side === "center" ? (
        <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none">
          <div className={cn("relative z-10 w-full pointer-events-auto", sizes[size])}>
            <div className="flex max-h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl">
              {title && (
                <div className="flex items-center justify-between border-b border-border px-5 py-4">
                  <h3 className="font-semibold text-foreground">{title}</h3>
                  {closeButton}
                </div>
              )}
              <div className="overflow-y-auto px-5 py-4">{children}</div>
              {footer && <div className="border-t border-border px-5 py-4">{footer}</div>}
            </div>
          </div>
        </div>
      ) : (
        <div className="fixed inset-y-0 right-0 z-10 w-full max-w-xl">
          <div className="flex h-[100dvh] w-full flex-col border-l border-border bg-card text-card-foreground shadow-2xl">
            {title && (
              <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-border bg-card/95 px-5 py-4 backdrop-blur">
                <h3 className="line-clamp-2 font-semibold text-foreground">{title}</h3>
                {closeButton}
              </div>
            )}
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
            {footer && <div className="border-t border-border bg-card/95 px-5 py-4 backdrop-blur">{footer}</div>}
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};

export default Modal;

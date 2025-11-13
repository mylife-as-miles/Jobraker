import { useState, useCallback } from "react";
import { UndoToast } from "@/client/components/UndoToast";

interface ToastState {
  id: string;
  title: string;
  description: string;
  onUndo: () => void;
}

export const useUndoToast = () => {
  const [toasts, setToasts] = useState<Map<string, ToastState>>(new Map());

  const showToast = useCallback((toast: ToastState) => {
    setToasts((prev) => {
      const next = new Map(prev);
      next.set(toast.id, toast);
      return next;
    });
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const ToastContainer = () => (
    <>
      {Array.from(toasts.entries()).map(([id, toast]) => (
        <UndoToast
          key={id}
          id={id}
          title={toast.title}
          description={toast.description}
          onUndo={() => {
            toast.onUndo();
            dismissToast(id);
          }}
          onDismiss={() => dismissToast(id)}
        />
      ))}
    </>
  );

  return { showToast, dismissToast, ToastContainer };
};


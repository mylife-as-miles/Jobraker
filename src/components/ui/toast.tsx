import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

type ToastVariant = "success" | "error" | "info" | "warning";

export interface ToastOptions {
  title?: string;
  description?: React.ReactNode;
  variant?: ToastVariant;
  duration?: number; // ms
}

interface ToastItem extends Required<
  Omit<ToastOptions, "description" | "title">
> {
  id: string;
  title: string;
  description?: React.ReactNode;
}

interface ToastContextValue {
  notify: (opts: ToastOptions) => void;
  success: (
    title: string,
    description?: React.ReactNode,
    duration?: number,
  ) => void;
  error: (
    title: string,
    description?: React.ReactNode,
    duration?: number,
  ) => void;
  info: (
    title: string,
    description?: React.ReactNode,
    duration?: number,
  ) => void;
  warning: (
    title: string,
    description?: React.ReactNode,
    duration?: number,
  ) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, number | ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer as number);
      timers.current.delete(id);
    }
  }, []);

  const notify = useCallback(
    (opts: ToastOptions) => {
      const id = Math.random().toString(36).slice(2);
      const item: ToastItem = {
        id,
        title: opts.title ?? "",
        description: opts.description,
        variant: opts.variant ?? "info",
        duration: Math.max(1500, Math.min(opts.duration ?? 3500, 15000)),
      };
      setToasts((prev) => [item, ...prev]);
      const t = setTimeout(() => remove(id), item.duration);
      timers.current.set(id, t);
    },
    [remove],
  );

  useEffect(
    () => () => {
      // cleanup timers
      timers.current.forEach((t) => clearTimeout(t as number));
      timers.current.clear();
    },
    [],
  );

  const api = useMemo<ToastContextValue>(
    () => ({
      notify,
      success: (title, description, duration) =>
        notify({ title, description, duration, variant: "success" }),
      error: (title, description, duration) =>
        notify({ title, description, duration, variant: "error" }),
      info: (title, description, duration) =>
        notify({ title, description, duration, variant: "info" }),
      warning: (title, description, duration) =>
        notify({ title, description, duration, variant: "warning" }),
    }),
    [notify],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <Toaster toasts={toasts} onClose={remove} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function Toaster({
  toasts,
  onClose,
}: {
  toasts: ToastItem[];
  onClose: (id: string) => void;
}) {
  return (
    <div className='fixed top-4 right-4 z-[1000] flex flex-col gap-2 w-[92vw] max-w-sm sm:max-w-md'>
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className={[
              "rounded-lg border bg-card/95 px-4 py-3 text-card-foreground shadow-lg backdrop-blur-md",
              variantBorderClass(t.variant),
            ].join(" ")}
          >
            <div className='flex items-start gap-3'>
              <div
                className={
                  "mt-0.5 w-2 h-2 rounded-full " + variantDotClass(t.variant)
                }
              />
              <div className='flex-1 min-w-0'>
                {t.title && (
                  <div className='text-sm font-semibold text-foreground truncate'>
                    {t.title}
                  </div>
                )}
                {t.description && (
                  <div className='text-xs text-muted-foreground mt-0.5 break-words'>
                    {t.description}
                  </div>
                )}
              </div>
              <button
                aria-label='Close'
                className='text-muted-foreground hover:text-foreground transition-colors'
                onClick={() => onClose(t.id)}
              >
                <X className='w-4 h-4' />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function variantBorderClass(v: ToastVariant) {
  switch (v) {
    case "success":
      return "border-brand/40";
    case "error":
      return "border-brand/40";
    case "warning":
      return "border-brand/40";
    default:
      return "border-border";
  }
}

function variantDotClass(v: ToastVariant) {
  switch (v) {
    case "success":
      return "bg-brand shadow-[0_0_12px_#1dff00]";
    case "error":
      return "bg-brand/100 shadow-[0_0_12px_#1dff00]";
    case "warning":
      return "bg-brand shadow-[0_0_12px_#1dff00]";
    default:
      return "bg-muted-foreground";
  }
}

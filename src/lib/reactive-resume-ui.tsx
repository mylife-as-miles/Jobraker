// Minimal UI kit used by the client code. Enhanced with basic styling & behavior
// to avoid layout issues (e.g., dropdowns rendering inline) while keeping deps light.
import React from "react";
import { createPortal } from "react-dom";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default"|"secondary"|"outline"|"ghost"|"destructive"|"error"|"link"; size?: "sm"|"md"|"lg"; asChild?: boolean };
export const Button: React.FC<ButtonProps> = ({ children, asChild, variant = "default", size = "md", className = "", ...props }) => {
  if (asChild) return <>{children}</>;
  const sizeCls = size === "sm" ? "h-8 px-3 text-sm" : size === "lg" ? "h-11 px-5 text-base" : "h-10 px-4 text-sm";
  const base = "inline-flex items-center justify-center gap-1 rounded-xl font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:pointer-events-none active:translate-y-px";
  const variants: Record<string, string> = {
    default: "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-95 shadow-sm",
    secondary: "bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] hover:bg-[hsl(var(--accent))]",
    outline: "border border-[hsl(var(--border))] bg-transparent text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))]",
    ghost: "bg-transparent hover:bg-[hsl(var(--accent))]",
    destructive: "bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))] hover:opacity-95",
    error: "bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))] hover:opacity-95",
    link: "h-auto px-0 text-[hsl(var(--primary))] hover:underline underline-offset-4",
  };
  return (
    <button {...props} className={[base, sizeCls, variants[variant], className].join(" ")}>{children}</button>
  );
};

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className = "", ...props }) => (
  <div
    {...props}
    className={[
      "rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/0.7)] text-[hsl(var(--card-foreground))] shadow-sm backdrop-blur-sm transition-all",
      className,
    ].join(" ")}
  >
    {children}
  </div>
);
export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, ...props }) => (
  <div {...props}>{children}</div>
);
export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ children, ...props }) => (
  <h3 {...props}>{children}</h3>
);
export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ children, ...props }) => (
  <p {...props}>{children}</p>
);
export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, ...props }) => (
  <div {...props}>{children}</div>
);

export const ScrollArea: React.FC<
  React.HTMLAttributes<HTMLDivElement> & { orientation?: "vertical" | "horizontal"; allowOverflow?: boolean }
> = ({ children, style, orientation, allowOverflow, className = "", ...rest }) => (
  <div {...rest} className={["scroll-area", className].join(" ")} style={{ overflow: allowOverflow ? "visible" : "auto", ...(style as any) }}>{children}</div>
);

export const Separator: React.FC<React.HTMLAttributes<HTMLDivElement>> = (props) => (
  <hr className={(props.className ?? "") + " my-2 border-gray-300/40"} />
);

export function KeyboardShortcut({ combo, children, className }: { combo?: string; children?: React.ReactNode; className?: string }) {
  return <kbd className={(className ?? "") + " rounded border px-2 py-0.5 text-xs opacity-70"}>{children ?? combo}</kbd>;
}

// Dialog primitives with portal + overlay and basic focus/escape/outside handling
type DialogCtxType = { open?: boolean; onOpenChange?: (v: boolean) => void };
const DialogCtx = React.createContext<DialogCtxType | null>(null);

export const Dialog: React.FC<{ open?: boolean; onOpenChange?: (v: boolean) => void } & React.HTMLAttributes<HTMLDivElement>> = ({ open, onOpenChange, children }) => {
  return <DialogCtx.Provider value={{ open, onOpenChange }}>{children}</DialogCtx.Provider>;
};

export const DialogContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className = "", style, ...props }) => {
  const ctx = React.useContext(DialogCtx);
  const isOpen = !!ctx?.open;
  const contentRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") ctx?.onOpenChange?.(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen]);

  if (!isOpen) return null;
  return createPortal(
    <div className="fixed inset-0 z-[99]">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => ctx?.onOpenChange?.(false)}
      />
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        className={[
          "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[100]",
          "w-[90vw] max-w-2xl max-h-[85vh] overflow-auto",
          "rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--popover))] text-[hsl(var(--popover-foreground))] shadow-xl",
          className,
        ].join(" ")}
        style={style as any}
        {...props}
      >
        {children}
      </div>
    </div>,
    document.body
  );
};
export const DialogDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ children }) => <p>{children}</p>;
export const DialogFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children }) => <div>{children}</div>;
export const DialogHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children }) => <div>{children}</div>;
export const DialogTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ children }) => <h3>{children}</h3>;
// Alias AlertDialog components to Dialog primitives for compatibility
export const AlertDialog = Dialog;
export const AlertDialogContent = DialogContent;
export const AlertDialogDescription = DialogDescription;
export const AlertDialogFooter = DialogFooter;
export const AlertDialogHeader = DialogHeader;
export const AlertDialogTitle = DialogTitle;
export const AlertDialogAction: React.FC<ButtonProps> = (props) => <Button {...props} />;
export const AlertDialogCancel: React.FC<ButtonProps> = (props) => <Button {...props} />;

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>((props, ref) => (
  <input ref={ref} {...props} className={(props.className ?? "") + " rounded border px-2 py-1"} />
));
Input.displayName = "Input";

export const Checkbox: React.FC<{ checked?: boolean; onCheckedChange?: (v: boolean) => void } & React.InputHTMLAttributes<HTMLInputElement>> = ({ checked, onCheckedChange, ...props }) => (
  <input
    type="checkbox"
    checked={!!checked}
    onChange={(e) => onCheckedChange?.(e.target.checked)}
    {...props}
  />
);

export const RichInput: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = (props) => (
  <textarea {...props} className={(props.className ?? "") + " rounded border px-2 py-1 min-h-[80px]"} />
);

export const Slider: React.FC<{ value?: number[]; min?: number; max?: number; step?: number; onValueChange?: (v: number[]) => void }> = ({ value = [0], min = 0, max = 100, step = 1, onValueChange }) => (
  <input
    type="range"
    min={min}
    max={max}
    step={step}
    value={value[0]}
    onChange={(e) => onValueChange?.([e.target.valueAsNumber])}
  />
);

export const Label: React.FC<React.LabelHTMLAttributes<HTMLLabelElement>> = ({ children, ...props }) => (
  <label {...props} className={(props.className ?? "") + " text-sm"}>{children}</label>
);

export const Switch: React.FC<{ id?: string; checked?: boolean; onCheckedChange?: (v: boolean) => void } & React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ checked, onCheckedChange, ...props }) => (
  <button
    role="switch"
    aria-checked={!!checked}
    onClick={() => onCheckedChange?.(!checked)}
    type="button"
    {...props}
  />
);

export const Select: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children }) => <div>{children}</div>;
export const SelectContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children }) => <div>{children}</div>;
export const SelectItem: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children }) => <div>{children}</div>;
export const SelectTrigger: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children }) => <div>{children}</div>;
export const SelectValue: React.FC<React.HTMLAttributes<HTMLSpanElement>> = ({ children }) => <span>{children}</span>;

export const AspectRatio: React.FC<{ ratio?: number } & React.HTMLAttributes<HTMLDivElement>> = ({ ratio = 1, children, style, ...props }) => (
  <div style={{ position: "relative", width: "100%", paddingTop: `${100 / ratio}%`, ...(style as any) }} {...props}>
    <div style={{ position: "absolute", inset: 0 }}>{children}</div>
  </div>
);

export const Tabs: React.FC<
  React.HTMLAttributes<HTMLDivElement> & { value?: string; defaultValue?: string; onValueChange?: (v: string) => void }
> = ({ children, value, defaultValue, onValueChange, ...rest }) => (
  // This is a no-op container in the stub; props are accepted for type-compat
  <div {...rest}>{children}</div>
);
export const TabsList: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children }) => <div>{children}</div>;
export const TabsTrigger: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ children, ...props }) => <button {...props}>{children}</button>;
export const TabsContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children }) => <div>{children}</div>;

export const TooltipProvider: React.FC<React.PropsWithChildren> = ({ children }) => <>{children}</>;
export const Tooltip: React.FC<{ content?: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>> = ({ children }) => <>{children}</>;
export const Portal: React.FC<React.PropsWithChildren> = ({ children }) => <>{children}</>;
export const Sheet: React.FC<React.HTMLAttributes<HTMLDivElement> & { open?: boolean; onOpenChange?: (o: boolean) => void }> = ({ children, ...props }) => <div {...props}>{children}</div>;
export const SheetContent: React.FC<React.HTMLAttributes<HTMLDivElement> & { side?: string; showClose?: boolean; onOpenAutoFocus?: (e: any) => void }> = ({ children, ...props }) => <div {...props}>{children}</div>;
export const SheetTrigger: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ children, ...props }) => <button {...props}>{children}</button>;
export const SheetClose: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ children, ...props }) => <button {...props}>{children}</button>;
export const SheetHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, ...props }) => <div {...props}>{children}</div>;
export const SheetTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ children, ...props }) => <h3 {...props}>{children}</h3>;
export const SheetDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ children, ...props }) => <p {...props}>{children}</p>;
export const VisuallyHidden: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children }) => <div style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(1px, 1px, 1px, 1px)" }}>{children}</div>;

// Loosely-typed form primitives to avoid TS issues in consuming code
export const Form: any = ({ children, ...props }: any) => <form {...props}>{children}</form>;
// Provide a typed render prop so callback param isn't implicitly any
export const FormField: React.FC<{ name?: string; control?: any; render?: (args: any) => React.ReactNode; children?: React.ReactNode }> = (props) => {
  // don't execute render at runtime in this stub; just render children
  return <div>{props.children}</div>;
};
export const FormItem: any = ({ children }: any) => <div>{children}</div>;
export const FormLabel: any = Label as any;
export const FormControl: any = ({ children }: any) => <div>{children}</div>;
export const FormDescription: any = ({ children }: any) => <p>{children}</p>;
export const FormMessage: any = ({ children }: any) => <p>{children}</p>;

export const Avatar: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children }) => <div>{children}</div>;
export const AvatarImage: React.FC<React.ImgHTMLAttributes<HTMLImageElement>> = (props) => <img {...props} />;
export const AvatarFallback: React.FC<React.HTMLAttributes<HTMLSpanElement>> = ({ children }) => <span>{children}</span>;
export const Badge: React.FC<React.HTMLAttributes<HTMLSpanElement>> = ({ children }) => <span>{children}</span>;
export const BadgeInput: React.FC<{ values?: string[]; onValuesChange?: (v: string[]) => void; placeholder?: string }> = ({ values = [], onValuesChange, placeholder }) => {
  const [input, setInput] = React.useState("");
  const removeAt = (i: number) => onValuesChange?.(values.filter((_, idx) => idx !== i));
  const add = () => {
    const v = input.trim();
    if (!v) return;
    onValuesChange?.([...values, v]);
    setInput("");
  };
  return (
    <div className="flex flex-wrap gap-1 border rounded p-1">
      {values.map((v, i) => (
        <span key={`${v}-${i}`} className="px-1 py-0.5 bg-secondary rounded">
          {v}
          <button className="ml-1" onClick={() => removeAt(i)} aria-label="Remove">
            ×
          </button>
        </span>
      ))}
      <input
        value={input}
        placeholder={placeholder}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
        }}
        className="flex-1 outline-none px-1"
      />
    </div>
  );
};
// Simple accordion primitives
export const Accordion: React.FC<React.HTMLAttributes<HTMLDivElement> & { type?: string; defaultValue?: string[] | string }> = ({ children, ...props }) => <div {...props}>{children}</div>;
export const AccordionItem: React.FC<React.HTMLAttributes<HTMLDivElement> & { value?: string }> = ({ children, ...props }) => (
  <div {...props}>{children}</div>
);
export const AccordionTrigger: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ children, ...props }) => (
  <button {...props}>{children}</button>
);
export const AccordionContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, ...props }) => (
  <div {...props}>{children}</div>
);

export const buttonVariants = (_opts?: any) => "btn";

// Toggle primitive
export const Toggle: React.FC<{ pressed?: boolean; onPressedChange?: (p: boolean) => void } & React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ pressed, onPressedChange, children, ...props }) => (
  <button
    aria-pressed={pressed}
    onClick={() => onPressedChange?.(!pressed)}
    {...props}
  >
    {children}
  </button>
);

// ToggleGroup primitives (single selection)
const ToggleGroupCtx = React.createContext<{ value?: string; onValueChange?: (v: string) => void } | null>(null);
export const ToggleGroup: React.FC<{
  type?: "single" | "multiple";
  value?: string;
  onValueChange?: (v: string) => void;
} & React.HTMLAttributes<HTMLDivElement>> = ({ children, value, onValueChange, ...props }) => (
  <ToggleGroupCtx.Provider value={{ value, onValueChange }}>
    <div {...props}>{children}</div>
  </ToggleGroupCtx.Provider>
);
export const ToggleGroupItem: React.FC<{
  value: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ value, children, ...props }) => {
  const ctx = React.useContext(ToggleGroupCtx);
  const pressed = ctx?.value === value;
  return (
    <button
      aria-pressed={pressed}
      data-state={pressed ? "on" : "off"}
      onClick={() => ctx?.onValueChange?.(value)}
      type="button"
      {...props}
    >
      {children}
    </button>
  );
};

// Command palette primitives
export const Command: React.FC<{ shouldFilter?: boolean } & React.HTMLAttributes<HTMLDivElement>> = ({ children, ...props }) => <div {...props}>{children}</div>;
export const CommandInput: React.FC<{ value?: string; onValueChange?: (v: string) => void; placeholder?: string }> = ({ value, onValueChange, placeholder }) => (
  <input value={value} onChange={(e) => onValueChange?.(e.target.value)} placeholder={placeholder} />
);
export const CommandList: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, ...props }) => <div {...props}>{children}</div>;
export const CommandEmpty: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, ...props }) => <div {...props}>{children}</div>;
export const CommandGroup: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, ...props }) => <div {...props}>{children}</div>;
export const CommandItem: React.FC<{ value?: string; disabled?: boolean; onSelect?: (v: string) => void } & React.LiHTMLAttributes<HTMLLIElement>> = ({ value = "", disabled, onSelect, children, ...props }) => (
  <li {...props} onClick={() => !disabled && onSelect?.(value)}>{children}</li>
);

// Popover primitives
export const Popover: React.FC<{ open?: boolean; onOpenChange?: (o: boolean) => void } & React.HTMLAttributes<HTMLDivElement>> = ({ children }) => <div>{children}</div>;
export const PopoverTrigger: React.FC<{ asChild?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ asChild, children, ...props }) => asChild ? <>{children}</> : <button {...props}>{children}</button>;
export const PopoverContent: React.FC<{ align?: string } & React.HTMLAttributes<HTMLDivElement>> = ({ children, ...props }) => <div {...props}>{children}</div>;

// Resizable panels primitives (no-op wrappers)
export const PanelGroup: React.FC<{ direction?: "horizontal" | "vertical" } & React.HTMLAttributes<HTMLDivElement>> = ({ children, ...props }) => <div {...props}>{children}</div>;
type DivWithoutOnResize = Omit<React.HTMLAttributes<HTMLDivElement>, "onResize">;
export const Panel: React.FC<{ minSize?: number; maxSize?: number; defaultSize?: number; onResize?: (size: number) => void } & DivWithoutOnResize> = ({ children, ...props }) => <div {...(props as any)}>{children}</div>;
export const PanelResizeHandle: React.FC<{ isDragging?: boolean; onDragging?: (dragging: boolean) => void } & React.HTMLAttributes<HTMLDivElement>> = ({ children, ...props }) => <div {...props}>{children}</div>;

// Toast primitives used by Toaster
export type ToastProps = React.HTMLAttributes<HTMLDivElement> & { open?: boolean; onOpenChange?: (open: boolean) => void };
export type ToastActionElement = React.ReactNode;

export const ToastProvider: React.FC<React.PropsWithChildren> = ({ children }) => <>{children}</>;
export const ToastViewport: React.FC<React.HTMLAttributes<HTMLDivElement>> = (props) => <div {...props} />;
export const Toast: React.FC<ToastProps> = ({ children, ...props }) => (
  <div {...props} className={(props.className ?? "") + " fixed bottom-4 right-4 rounded bg-black/80 text-white p-3"}>{children}</div>
);
export const ToastTitle: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children }) => <div className="font-semibold">{children}</div>;
export const ToastDescription: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children }) => <div className="text-sm opacity-80">{children}</div>;
export const ToastClose: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = (props) => <button {...props}>×</button>;

// Alert primitive
export const Alert: React.FC<{ variant?: string } & React.HTMLAttributes<HTMLDivElement>> = ({ children, ...props }) => (
  <div {...props} className={(props.className ?? "") + " rounded border p-3"}>{children}</div>
);
export const AlertTitle: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, ...props }) => (
  <div {...props} className={(props.className ?? "") + " font-semibold"}>{children}</div>
);
export const AlertDescription: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, ...props }) => (
  <div {...props} className={(props.className ?? "") + " text-sm opacity-80"}>{children}</div>
);

// Dropdown menu primitives
// Lightweight dropdown with internal open state and absolute positioning
type DMContext = { open: boolean; setOpen: (o: boolean) => void; triggerRef: React.RefObject<HTMLElement>; contentRef: React.RefObject<HTMLDivElement> };
const DropdownCtx = React.createContext<DMContext | null>(null);

export const DropdownMenu: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className = "", ...props }) => {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  // close on outside click
  React.useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      const trig = triggerRef.current;
      const content = contentRef.current;
      if (trig && trig.contains(t)) return;
      if (content && content.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <DropdownCtx.Provider value={{ open, setOpen, triggerRef, contentRef }}>
      <div className={["relative inline-block", className].join(" ")} {...props}>{children}</div>
    </DropdownCtx.Provider>
  );
};

export const DropdownMenuTrigger: React.FC<{ asChild?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ asChild, children, className = "", ...props }) => {
  const ctx = React.useContext(DropdownCtx);
  if (asChild) {
    return <span ref={ctx?.triggerRef as any} onClick={() => ctx?.setOpen(!ctx.open)} className={className} {...(props as any)}>{children}</span>;
  }
  return (
    <button
      ref={ctx?.triggerRef as any}
      onClick={() => ctx?.setOpen(!ctx.open)}
      className={["rounded-xl", className].join(" ")}
      {...props}
    >
      {children}
    </button>
  );
};

export const DropdownMenuContent: React.FC<{
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  sideOffset?: number;
  alignOffset?: number;
  avoidCollisions?: boolean;
  collisionPadding?: number;
} & React.HTMLAttributes<HTMLDivElement>> = ({ children, className = "", style, side = "bottom", align = "end", sideOffset = 6, alignOffset = 0, avoidCollisions = true, collisionPadding = 8, ...props }) => {
  const ctx = React.useContext(DropdownCtx);
  const [coords, setCoords] = React.useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
  const contentRef = ctx?.contentRef || React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (!ctx?.open) return;
    const update = () => {
      const el = ctx.triggerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const margin = collisionPadding;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let width = contentRef.current?.offsetWidth || Math.max(160, r.width);
      width = Math.min(width, vw - margin * 2);

      // Base placement
      let top = r.bottom + sideOffset; // default bottom
      let left = r.right - width; // default end alignment
      if (side === "top") top = r.top - sideOffset - (contentRef.current?.offsetHeight || 0);
      if (side === "left") {
        left = r.left - width - sideOffset;
        top = r.top;
      } else if (side === "right") {
        left = r.right + sideOffset;
        top = r.top;
      }
      // Alignments
      if (side === "top" || side === "bottom") {
        if (align === "start") left = r.left;
        if (align === "center") left = r.left + r.width / 2 - width / 2;
        if (align === "end") left = r.right - width;
        left += alignOffset;
      } else {
        const ch = contentRef.current?.offsetHeight || 0;
        if (align === "start") top = r.top;
        if (align === "center") top = r.top + r.height / 2 - ch / 2;
        if (align === "end") top = r.bottom - ch;
      }

      // Collision handling
      if (avoidCollisions) {
        // Flip vertically if needed
        const ch = contentRef.current?.offsetHeight || 200;
        if (side === "bottom" && r.bottom + ch + sideOffset + margin > vh) {
          top = Math.max(margin, r.top - sideOffset - ch);
        } else if (side === "top" && r.top - ch - sideOffset - margin < 0) {
          top = Math.min(vh - margin - ch, r.bottom + sideOffset);
        }
        // Clamp horizontally
        if (left < margin) left = margin;
        if (left + width > vw - margin) left = vw - margin - width;
      }

      // Max height after placement
      const maxHeight = Math.min(320, vh - margin - Math.max(margin, top));
      const absTop = top + window.scrollY;
      const absLeft = left + window.scrollX;
      setCoords({ top: absTop, left: absLeft, width, maxHeight: Math.max(120, maxHeight) });
    };
    update();
    const on = () => update();
    window.addEventListener('resize', on);
    window.addEventListener('scroll', on, true);
    const ro = new ResizeObserver(() => update());
    if (contentRef.current) ro.observe(contentRef.current);
    return () => {
      window.removeEventListener('resize', on);
      window.removeEventListener('scroll', on, true);
      ro.disconnect();
    };
  }, [ctx?.open, ctx?.triggerRef]);
  if (!ctx || !ctx.open) return null;
  return (
    createPortal(
      <div
        role="menu"
        ref={contentRef}
        className={[
          "fixed z-[120] min-w-[10rem] max-w-[calc(100vw-16px)] overflow-auto rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--popover))] text-[hsl(var(--popover-foreground))] shadow-lg",
          className,
        ].join(" ")}
        style={{ top: coords?.top, left: coords?.left, width: coords?.width, maxHeight: coords?.maxHeight, ...(style as any) }}
        {...props}
      >
        {children}
      </div>,
      document.body
    )
  );
};
export const DropdownMenuItem: React.FC<React.HTMLAttributes<HTMLDivElement> & { onClick?: () => void } > = ({ children, onClick, className = "", ...props }) => {
  const ctx = React.useContext(DropdownCtx);
  const handleClick = () => {
    onClick?.();
    // Close after action
    ctx?.setOpen(false);
  };
  return (
    <div
      {...props}
      onClick={handleClick}
      className={["cursor-pointer select-none px-3 py-1.5 text-sm hover:bg-[hsl(var(--accent))] focus:bg-[hsl(var(--accent))] rounded", className].join(" ")}
    >
      {children}
    </div>
  );
};
export const DropdownMenuSeparator: React.FC<React.HTMLAttributes<HTMLHRElement>> = (props) => <hr {...props} className={["my-1 border-t", props.className ?? ""].join(" ")} />;
export const DropdownMenuCheckboxItem: React.FC<{ checked?: boolean; onCheckedChange?: (v: boolean) => void } & React.HTMLAttributes<HTMLDivElement>> = ({ children, checked, onCheckedChange, ...props }) => (
  <div
    role="menuitemcheckbox"
    aria-checked={!!checked}
    onClick={() => onCheckedChange?.(!checked)}
    {...props}
  >
    {children}
  </div>
);
export const DropdownMenuGroup: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, ...props }) => <div {...props}>{children}</div>;
export const DropdownMenuRadioGroup: React.FC<{ value?: string; onValueChange?: (v: string) => void } & React.HTMLAttributes<HTMLDivElement>> = ({ children, ...props }) => <div {...props}>{children}</div>;
export const DropdownMenuRadioItem: React.FC<{ value?: string } & React.HTMLAttributes<HTMLDivElement>> = ({ children, ...props }) => <div {...props}>{children}</div>;
export const DropdownMenuSub: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, ...props }) => <div {...props}>{children}</div>;
export const DropdownMenuSubTrigger: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ children, ...props }) => <button {...props}>{children}</button>;
export const DropdownMenuSubContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, ...props }) => <div {...props}>{children}</div>;

// Context menu primitives
export const ContextMenu: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, ...props }) => <div {...props}>{children}</div>;
export const ContextMenuTrigger: React.FC<{ asChild?: boolean } & React.HTMLAttributes<HTMLDivElement>> = ({ asChild, children, ...props }) => asChild ? <>{children}</> : <div {...props}>{children}</div>;
export const ContextMenuContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, ...props }) => <div {...props}>{children}</div>;
export const ContextMenuItem: React.FC<React.HTMLAttributes<HTMLDivElement> & { onClick?: () => void } > = ({ children, onClick, ...props }) => <div {...props} onClick={onClick}>{children}</div>;
export const ContextMenuSeparator: React.FC<React.HTMLAttributes<HTMLHRElement>> = (props) => <hr {...props} />;

// Simple Combobox primitive
export const Combobox: React.FC<{
  value?: string;
  options?: { label: string; value: string }[];
  onValueChange?: (v: string) => void;
}> = ({ value, options = [], onValueChange }) => (
  <select value={value} onChange={(e) => onValueChange?.(e.target.value)} className="w-full rounded border px-2 py-1">
    {options.map((opt) => (
      <option key={opt.value} value={opt.value}>
        {opt.label}
      </option>
    ))}
  </select>
);

export default {} as any;

// Minimal mock UI kit to satisfy imports from @reactive-resume/ui used by client code.
// Replace with your own design system components as needed.
import React from "react";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string; asChild?: boolean };
export const Button: React.FC<ButtonProps> = ({ children, asChild, ...props }) => {
  if (asChild) return <>{children}</>;
  return (
    <button {...props} className={(props.className ?? "") + " inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded border"}>
      {children}
    </button>
  );
};

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, ...props }) => (
  <div {...props} className={(props.className ?? "") + " rounded border p-3 bg-white/5"}>{children}</div>
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
> = ({ children, style, orientation, allowOverflow, ...rest }) => {
  // ignore orientation/allowOverflow in this stub
  return (
    <div {...rest} style={{ overflow: "auto", ...(style as any) }}>{children}</div>
  );
};

export const Separator: React.FC<React.HTMLAttributes<HTMLDivElement>> = (props) => (
  <hr className={(props.className ?? "") + " my-2 border-gray-300/40"} />
);

export function KeyboardShortcut({ combo, children, className }: { combo?: string; children?: React.ReactNode; className?: string }) {
  return <kbd className={(className ?? "") + " rounded border px-2 py-0.5 text-xs opacity-70"}>{children ?? combo}</kbd>;
}

// Dialog/toast/select inputs simplified stubs; extend as needed by pages you enable
export const Dialog: React.FC<{ open?: boolean; onOpenChange?: (v: boolean) => void } & React.HTMLAttributes<HTMLDivElement>> = ({ children }) => <div>{children}</div>;
export const DialogContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children }) => <div>{children}</div>;
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
export const DropdownMenu: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, ...props }) => <div {...props}>{children}</div>;
export const DropdownMenuTrigger: React.FC<{ asChild?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ asChild, children, ...props }) => asChild ? <>{children}</> : <button {...props}>{children}</button>;
export const DropdownMenuContent: React.FC<{ side?: string; align?: string } & React.HTMLAttributes<HTMLDivElement>> = ({ children, ...props }) => <div {...props}>{children}</div>;
export const DropdownMenuItem: React.FC<React.HTMLAttributes<HTMLDivElement> & { onClick?: () => void } > = ({ children, onClick, ...props }) => <div {...props} onClick={onClick}>{children}</div>;
export const DropdownMenuSeparator: React.FC<React.HTMLAttributes<HTMLHRElement>> = (props) => <hr {...props} />;
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

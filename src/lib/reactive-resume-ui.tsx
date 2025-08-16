// Minimal mock UI kit to satisfy imports from @reactive-resume/ui used by client code.
// Replace with your own design system components as needed.
import React from "react";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string };
export const Button: React.FC<ButtonProps> = ({ children, ...props }) => (
  <button {...props} className={(props.className ?? "") + " inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded border"}>
    {children}
  </button>
);

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, ...props }) => (
  <div {...props} className={(props.className ?? "") + " rounded border p-3 bg-white/5"}>{children}</div>
);

export const ScrollArea: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, ...props }) => (
  <div {...props} style={{ overflow: "auto", ...(props as any).style }}>{children}</div>
);

export const Separator: React.FC<React.HTMLAttributes<HTMLDivElement>> = (props) => (
  <hr className={(props.className ?? "") + " my-2 border-gray-300/40"} />
);

export function KeyboardShortcut({ combo }: { combo: string }) {
  return <kbd className="rounded border px-2 py-0.5 text-xs opacity-70">{combo}</kbd>;
}

// Dialog/toast/select inputs simplified stubs; extend as needed by pages you enable
export const Dialog: React.FC<{ open?: boolean; onOpenChange?: (v: boolean) => void } & React.HTMLAttributes<HTMLDivElement>> = ({ children }) => <div>{children}</div>;
export const DialogContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children }) => <div>{children}</div>;
export const DialogDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ children }) => <p>{children}</p>;
export const DialogFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children }) => <div>{children}</div>;
export const DialogHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children }) => <div>{children}</div>;
export const DialogTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ children }) => <h3>{children}</h3>;

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>((props, ref) => (
  <input ref={ref} {...props} className={(props.className ?? "") + " rounded border px-2 py-1"} />
));
Input.displayName = "Input";

export const Label: React.FC<React.LabelHTMLAttributes<HTMLLabelElement>> = ({ children, ...props }) => (
  <label {...props} className={(props.className ?? "") + " text-sm"}>{children}</label>
);

export const Select: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children }) => <div>{children}</div>;
export const SelectContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children }) => <div>{children}</div>;
export const SelectItem: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children }) => <div>{children}</div>;
export const SelectTrigger: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children }) => <div>{children}</div>;
export const SelectValue: React.FC<React.HTMLAttributes<HTMLSpanElement>> = ({ children }) => <span>{children}</span>;

export const Tabs: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children }) => <div>{children}</div>;
export const TabsList: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children }) => <div>{children}</div>;
export const TabsTrigger: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ children, ...props }) => <button {...props}>{children}</button>;
export const TabsContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children }) => <div>{children}</div>;

export const TooltipProvider: React.FC<React.PropsWithChildren> = ({ children }) => <>{children}</>;
export const Sheet: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children }) => <div>{children}</div>;
export const SheetContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children }) => <div>{children}</div>;
export const SheetTrigger: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ children, ...props }) => <button {...props}>{children}</button>;
export const SheetClose: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ children, ...props }) => <button {...props}>{children}</button>;

export const Form: React.FC<React.FormHTMLAttributes<HTMLFormElement>> = ({ children, ...props }) => <form {...props}>{children}</form>;
export const FormField: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children }) => <div>{children}</div>;
export const FormItem: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children }) => <div>{children}</div>;
export const FormLabel = Label;
export const FormControl: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children }) => <div>{children}</div>;
export const FormDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ children }) => <p>{children}</p>;
export const FormMessage: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ children }) => <p>{children}</p>;

export const Avatar: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children }) => <div>{children}</div>;
export const AvatarImage: React.FC<React.ImgHTMLAttributes<HTMLImageElement>> = (props) => <img {...props} />;
export const AvatarFallback: React.FC<React.HTMLAttributes<HTMLSpanElement>> = ({ children }) => <span>{children}</span>;
export const Badge: React.FC<React.HTMLAttributes<HTMLSpanElement>> = ({ children }) => <span>{children}</span>;

export const buttonVariants = () => "btn";

// Toast primitives used by Toaster
export const ToastProvider: React.FC<React.PropsWithChildren> = ({ children }) => <>{children}</>;
export const ToastViewport: React.FC<React.HTMLAttributes<HTMLDivElement>> = (props) => <div {...props} />;
export const Toast: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, ...props }) => (
  <div {...props} className={(props.className ?? "") + " fixed bottom-4 right-4 rounded bg-black/80 text-white p-3"}>{children}</div>
);
export const ToastTitle: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children }) => <div className="font-semibold">{children}</div>;
export const ToastDescription: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children }) => <div className="text-sm opacity-80">{children}</div>;
export const ToastClose: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = (props) => <button {...props}>×</button>;

export default {} as any;

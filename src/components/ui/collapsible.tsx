import * as React from 'react';
import { cn } from '@/lib/utils';

export interface CollapsibleProps extends React.HTMLAttributes<HTMLDivElement> {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

const CollapsibleContext = React.createContext<{
  open: boolean;
  toggle: () => void;
}>({ open: false, toggle: () => {} });

export const Collapsible: React.FC<CollapsibleProps> = ({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  children,
  className,
  ...props
}) => {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;

  const toggle = React.useCallback(() => {
    const next = !isOpen;
    if (!isControlled) {
      setInternalOpen(next);
    }
    onOpenChange?.(next);
  }, [isControlled, isOpen, onOpenChange]);

  return (
    <CollapsibleContext.Provider value={{ open: isOpen, toggle }}>
      <div
        data-state={isOpen ? "open" : "closed"}
        aria-expanded={isOpen}
        className={cn("spring-card-wrapper transition-all", className)}
        {...props}
      >
        {children}
      </div>
    </CollapsibleContext.Provider>
  );
};

export const CollapsibleTrigger: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }
> = ({ children, className, onClick, ...rest }) => {
  const { toggle, open } = React.useContext(CollapsibleContext);

  return (
    <button
      type="button"
      data-state={open ? "open" : "closed"}
      aria-expanded={open}
      onClick={(e) => {
        toggle();
        onClick?.(e);
      }}
      className={cn("cursor-pointer select-none", className)}
      {...rest}
    >
      {children}
    </button>
  );
};

export const CollapsibleContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className,
  style,
  ...rest
}) => {
  const { open } = React.useContext(CollapsibleContext);

  return (
    <div
      data-state={open ? "open" : "closed"}
      className={cn(
        "spring-grid-expandable w-full overflow-hidden transition-all duration-500",
        open && "expanded",
        className
      )}
      style={{
        display: "grid",
        gridTemplateRows: open ? "1fr" : "0fr",
        transition: "grid-template-rows 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
        ...style,
      }}
      {...rest}
    >
      <div
        className="spring-grid-inner min-h-0 overflow-hidden"
        style={{
          opacity: open ? 1 : 0,
          transition: "opacity 0.35s ease 0.15s",
        }}
      >
        {children}
      </div>
    </div>
  );
};

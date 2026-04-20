import * as React from "react";

type SelectContextValue = {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  value?: string;
  onValueChange?: (value: string) => void;
};

const SelectContext = React.createContext<SelectContextValue | null>(null);

function useSelectContext() {
  const context = React.useContext(SelectContext);
  if (!context) {
    throw new Error("Select components must be used within Select.Root");
  }
  return context;
}

export const Root = ({ children, value, onValueChange, ...props }: any) => {
  const [open, setOpen] = React.useState(false);

  return (
    <SelectContext.Provider value={{ open, setOpen, value, onValueChange }}>
      <div {...props}>{children}</div>
    </SelectContext.Provider>
  );
};
Root.displayName = "SelectRoot";

export const Trigger = React.forwardRef<HTMLButtonElement, any>(
  ({ children, onClick, ...props }, ref) => {
    const { open, setOpen } = useSelectContext();

    return (
      <button
        ref={ref}
        type="button"
        aria-expanded={open}
        data-state={open ? "open" : "closed"}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) {
            setOpen((prev) => !prev);
          }
        }}
        {...props}
      >
        {children}
      </button>
    );
  },
);
Trigger.displayName = "SelectTrigger";

export const Value = ({ placeholder, children }: any) => {
  const { value } = useSelectContext();
  if (children) return <span>{children}</span>;
  return <span>{value ?? placeholder}</span>;
};

export const Icon = ({ children }: any) => <span>{children}</span>;

export const Portal = ({ children }: any) => <>{children}</>;

export const Content = React.forwardRef<HTMLDivElement, any>(
  ({ children, ...props }, ref) => {
    const { open } = useSelectContext();
    if (!open) return null;
    return (
      <div ref={ref} data-state="open" {...props}>
        {children}
      </div>
    );
  },
);
Content.displayName = "SelectContent";

export const Viewport = ({ children, ...props }: any) => <div {...props}>{children}</div>;

export const Item = React.forwardRef<HTMLDivElement, any>(
  ({ children, value, onClick, ...props }, ref) => {
    const { value: selectedValue, onValueChange, setOpen } = useSelectContext();
    const selected = selectedValue === value;

    return (
      <div
        ref={ref}
        role="option"
        aria-selected={selected}
        data-state={selected ? "checked" : "unchecked"}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented && value !== undefined) {
            onValueChange?.(value);
            setOpen(false);
          }
        }}
        {...props}
      >
        {children}
      </div>
    );
  },
);
Item.displayName = "SelectItem";

export const ItemText = ({ children }: any) => <span>{children}</span>;

export const ItemIndicator = ({ children }: any) => <span>{children}</span>;

export const Group = ({ children, ...props }: any) => <div {...props}>{children}</div>;

export const Label = ({ children, ...props }: any) => <span {...props}>{children}</span>;

export const Separator = (props: any) => <hr {...props} />;

export const ScrollUpButton = ({ children, ...props }: any) => <button type="button" {...props}>{children}</button>;

export const ScrollDownButton = ({ children, ...props }: any) => <button type="button" {...props}>{children}</button>;

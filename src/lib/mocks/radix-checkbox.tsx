import * as React from "react";

type CheckboxProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    checked?: boolean | "indeterminate";
    onCheckedChange?: (checked: boolean) => void;
};

export const Root = React.forwardRef<HTMLButtonElement, CheckboxProps>(
    ({ checked, onCheckedChange, className, children, ...props }, ref) => (
        <button
            ref={ref}
            role="checkbox"
            aria-checked={checked === "indeterminate" ? "mixed" : checked}
            data-state={checked ? "checked" : "unchecked"}
            className={className}
            onClick={() => onCheckedChange?.(!checked)}
            {...props}
        >
            {children}
        </button>
    )
);
Root.displayName = "Checkbox";

export const Indicator = ({ children }: { children?: React.ReactNode }) => <span>{children}</span>;

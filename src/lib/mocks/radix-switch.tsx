import * as React from "react";

type SwitchProps = React.InputHTMLAttributes<HTMLInputElement> & {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
};

const Root = React.forwardRef<HTMLButtonElement, SwitchProps>(
    ({ checked, onCheckedChange, className, ...props }, ref) => {
        return (
            <button
                ref={ref}
                role="switch"
                aria-checked={checked}
                data-state={checked ? "checked" : "unchecked"}
                className={className}
                onClick={() => onCheckedChange?.(!checked)}
                {...(props as any)}
            />
        );
    }
);
Root.displayName = "Switch";

const Thumb = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
    ({ className, ...props }, ref) => <span ref={ref} className={className} {...props} />
);
Thumb.displayName = "SwitchThumb";

export { Root, Thumb };

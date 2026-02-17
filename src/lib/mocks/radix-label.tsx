import * as React from "react";

export const Root = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
    ({ children, ...props }, ref) => (
        <label ref={ref} {...props}>
            {children}
        </label>
    )
);
Root.displayName = "Label";

export const Label = Root;

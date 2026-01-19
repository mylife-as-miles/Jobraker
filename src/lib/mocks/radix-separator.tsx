import * as React from "react";

export const Root = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div ref={ref} role="separator" className={className} {...props} />
    )
);
Root.displayName = "Separator";

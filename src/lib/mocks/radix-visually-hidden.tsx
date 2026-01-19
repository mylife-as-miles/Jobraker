import * as React from "react";

export const Root = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
    ({ children, ...props }, ref) => (
        <span
            ref={ref}
            style={{
                position: "absolute",
                border: 0,
                width: 1,
                height: 1,
                padding: 0,
                margin: -1,
                overflow: "hidden",
                clip: "rect(0, 0, 0, 0)",
                whiteSpace: "nowrap",
                wordWrap: "normal",
            }}
            {...props}
        >
            {children}
        </span>
    )
);
Root.displayName = "VisuallyHidden";

export default Root;

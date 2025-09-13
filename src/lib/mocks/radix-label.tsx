import React from "react";
export const Root = React.forwardRef<HTMLLabelElement, React.ComponentPropsWithoutRef<'label'>>(
  ({ children, ...props }, ref) => (
    <label ref={ref} {...props}>
      {children}
    </label>
  ),
);
Root.displayName = "RadixLabelRoot";

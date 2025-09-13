import React from "react";

export const Root = React.forwardRef<HTMLButtonElement, any>(({ children, ...props }, ref) => (
  <button ref={ref} type="button" role="switch" {...props}>
    {children}
  </button>
));
export const Thumb: React.FC<React.PropsWithChildren<any>> = ({ children }) => <>{children}</>;
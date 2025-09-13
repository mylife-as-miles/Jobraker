import React from "react";

export const Root = React.forwardRef<HTMLInputElement, any>(({ children, ...props }, ref) => (
  <input ref={ref} type="checkbox" {...props} />
));
export const Indicator: React.FC<React.PropsWithChildren<any>> = ({ children }) => <>{children}</>;
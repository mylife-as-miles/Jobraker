import React from "react";

export const Root = React.forwardRef<HTMLDivElement, any>(({ ...props }, ref) => (
  <div ref={ref} {...props} />
));
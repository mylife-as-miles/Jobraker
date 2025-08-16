import React from "react";

export const VISUALLY_HIDDEN_STYLES: React.CSSProperties = {
  border: 0,
  clip: "rect(0 0 0 0)",
  height: 1,
  margin: -1,
  overflow: "hidden",
  padding: 0,
  position: "absolute",
  width: 1,
  whiteSpace: "nowrap",
};

export const VisuallyHidden: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, ...props }) => (
  <div {...props} style={VISUALLY_HIDDEN_STYLES}>
    {children}
  </div>
);

export default VisuallyHidden;

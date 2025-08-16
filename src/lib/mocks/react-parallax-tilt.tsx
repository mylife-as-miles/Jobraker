import React from "react";

export type ReactParallaxTiltProps = React.HTMLAttributes<HTMLDivElement> & {
  tiltMaxAngleX?: number;
  tiltMaxAngleY?: number;
  glareEnable?: boolean;
  glareMaxOpacity?: number;
  scale?: number;
};

const Tilt: React.FC<ReactParallaxTiltProps> = ({ children, ...props }) => (
  <div {...props}>{children}</div>
);

export default Tilt;

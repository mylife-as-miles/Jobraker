import React from "react";
import { TextMorph as TorphTextMorph } from "torph/react";

export interface TextMorphProps extends React.HTMLAttributes<HTMLElement> {
  children: string;
  as?: React.ElementType;
  className?: string;
  spring?: {
    stiffness?: number;
    damping?: number;
  };
}

export const TextMorph: React.FC<TextMorphProps> = ({
  children,
  as: Component = "span",
  className,
  ...props
}) => {
  return (
    <Component className={className}>
      <TorphTextMorph {...props}>{children}</TorphTextMorph>
    </Component>
  );
};

export { TorphTextMorph };
export default TextMorph;

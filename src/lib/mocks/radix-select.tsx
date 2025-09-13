import React from "react";

export const Root: React.FC<React.PropsWithChildren<any>> = ({ children, ...props }) => (
  <div {...props}>{children}</div>
);
export const Group: React.FC<React.PropsWithChildren<any>> = ({ children }) => <div>{children}</div>;
export const Value: React.FC<React.PropsWithChildren<any>> = ({ children }) => <span>{children}</span>;
export const Trigger = React.forwardRef<HTMLButtonElement, any>(({ children, ...props }, ref) => (
  <button ref={ref} type="button" {...props}>
    {children}
  </button>
));
export const Icon: React.FC<React.PropsWithChildren<any>> = ({ children }) => <span>{children}</span>;
export const Portal: React.FC<React.PropsWithChildren<any>> = ({ children }) => <>{children}</>;
export const Content = React.forwardRef<HTMLDivElement, any>(({ children, ...props }, ref) => (
  <div ref={ref} {...props}>
    {children}
  </div>
));
export const Viewport: React.FC<React.PropsWithChildren<any>> = ({ children, ...props }) => (
  <div {...props}>{children}</div>
);
export const ScrollUpButton = React.forwardRef<HTMLButtonElement, any>((props, ref) => (
  <button ref={ref} type="button" {...props} />
));
export const ScrollDownButton = ScrollUpButton;
export const Label = React.forwardRef<HTMLDivElement, any>(({ children, ...props }, ref) => (
  <div ref={ref} {...props}>
    {children}
  </div>
));
export const Item = React.forwardRef<HTMLDivElement, any>(({ children, ...props }, ref) => (
  <div ref={ref} {...props}>
    {children}
  </div>
));
export const ItemIndicator: React.FC<React.PropsWithChildren<any>> = ({ children }) => <>{children}</>;
export const ItemText: React.FC<React.PropsWithChildren<any>> = ({ children }) => <>{children}</>;
export const Separator = React.forwardRef<HTMLHRElement, any>((props, ref) => (
  <hr ref={ref} {...props} />
));
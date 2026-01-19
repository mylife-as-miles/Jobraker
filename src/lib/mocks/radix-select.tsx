import * as React from "react";

export const Root = React.forwardRef<HTMLButtonElement, any>(({ children, ...props }, ref) => (
    <button ref={ref} {...props}>{children}</button>
));
Root.displayName = "SelectRoot";

export const Trigger = React.forwardRef<HTMLButtonElement, any>(({ children, ...props }, ref) => (
    <button ref={ref} {...props}>{children}</button>
));
Trigger.displayName = "SelectTrigger";

export const Value = ({ placeholder, children }: any) => <span>{children || placeholder}</span>;
export const Icon = ({ children }: any) => <span>{children}</span>;
export const Portal = ({ children }: any) => <>{children}</>;
export const Content = React.forwardRef<HTMLDivElement, any>(({ children, ...props }, ref) => (
    <div ref={ref} {...props}>{children}</div>
));
Content.displayName = "SelectContent";

export const Viewport = ({ children }: any) => <div>{children}</div>;
export const Item = React.forwardRef<HTMLDivElement, any>(({ children, ...props }, ref) => (
    <div ref={ref} {...props}>{children}</div>
));
Item.displayName = "SelectItem";

export const ItemText = ({ children }: any) => <span>{children}</span>;
export const ItemIndicator = ({ children }: any) => <span>{children}</span>;
export const Group = ({ children }: any) => <div>{children}</div>;
export const Label = ({ children }: any) => <span>{children}</span>;
export const Separator = () => <hr />;
export const ScrollUpButton = ({ children }: any) => <button>{children}</button>;
export const ScrollDownButton = ({ children }: any) => <button>{children}</button>;

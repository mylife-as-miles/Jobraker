// import * as React from "react";

export const HexColorPicker = ({ color, onChange }: { color?: string; onChange?: (c: string) => void }) => (
    <input type="color" value={color} onChange={(e) => onChange?.(e.target.value)} />
);

export const HexColorInput = ({ color, onChange, ...props }: any) => (
    <input type="text" value={color} onChange={(e) => onChange?.(e.target.value)} {...props} />
);

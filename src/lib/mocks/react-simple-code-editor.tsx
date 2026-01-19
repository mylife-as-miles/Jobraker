import * as React from "react";

type EditorProps = {
    value: string;
    onValueChange: (value: string) => void;
    highlight: (code: string) => string;
    padding?: number;
    style?: React.CSSProperties;
    className?: string;
};

const Editor = ({ value, onValueChange, padding = 10, style, className }: EditorProps) => (
    <textarea
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        style={{ padding, fontFamily: "monospace", ...style }}
        className={className}
    />
);

export default Editor;

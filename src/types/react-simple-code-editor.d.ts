declare module "react-simple-code-editor" {
  import * as React from "react";
  export interface EditorProps {
    value: string;
    onValueChange: (value: string) => void;
    highlight: (code: string) => string | React.ReactNode;
    padding?: number;
    tabSize?: number;
    className?: string;
    textareaId?: string;
    textareaClassName?: string;
    preClassName?: string;
    style?: React.CSSProperties;
  }
  const CodeEditor: React.FC<EditorProps>;
  export default CodeEditor;
}
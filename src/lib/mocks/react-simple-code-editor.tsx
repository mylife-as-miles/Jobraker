import React from 'react';

const CodeEditor: React.FC<{
  value: string;
  onValueChange: (v: string) => void;
  className?: string;
  tabSize?: number;
  highlight?: (code: string) => string;
}> = ({ value, onValueChange, className }) => (
  <textarea className={className} value={value} onChange={(e) => onValueChange(e.target.value)} rows={8} style={{ width: '100%', fontFamily: 'monospace' }} />
);

export default CodeEditor;

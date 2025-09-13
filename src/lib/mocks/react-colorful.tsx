import React from 'react';

export const HexColorPicker: React.FC<{ color: string; onChange: (c: string) => void }> = ({ color, onChange }) => (
  <input type="color" value={color} onChange={(e) => onChange(e.target.value)} style={{ width: 200, height: 40 }} />
);

export default { HexColorPicker };

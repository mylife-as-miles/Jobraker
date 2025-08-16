import React from "react";

export const QRCodeSVG: React.FC<{ value: string; size?: number; className?: string } & React.SVGProps<SVGSVGElement>> = ({ value, size = 128, className, ...props }) => {
  // Minimal placeholder: render a square with the value as title for accessibility.
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`QR code for ${value}`}
      className={className}
      {...props}
    >
      <title>{`QR code for ${value}`}</title>
      <rect width={size} height={size} fill="#eee" stroke="#333" />
      {/* Decorative mini squares to hint a QR code */}
      <rect x={size * 0.08} y={size * 0.08} width={size * 0.24} height={size * 0.24} fill="#333" />
      <rect x={size * 0.68} y={size * 0.08} width={size * 0.24} height={size * 0.24} fill="#333" />
      <rect x={size * 0.08} y={size * 0.68} width={size * 0.24} height={size * 0.24} fill="#333" />
    </svg>
  );
};

export default QRCodeSVG;

// import * as React from "react";

export const QRCodeSVG = ({ value, size = 128 }: { value: string; size?: number }) => (
    <svg width={size} height={size}>
        <rect width="100%" height="100%" fill="white" />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" fontSize="10">
            QR: {value.slice(0, 20)}
        </text>
    </svg>
);

export default QRCodeSVG;

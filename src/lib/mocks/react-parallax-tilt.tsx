import * as React from "react";

const Tilt = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div {...props}>{children}</div>
);

export default Tilt;

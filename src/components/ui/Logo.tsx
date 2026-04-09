import React from "react"
import { cn } from "../../lib/utils"

interface LogoProps {
    className?: string
    iconOnly?: boolean
    width?: string | number
    height?: string | number
}

export const Logo: React.FC<LogoProps> = ({
    className,
    iconOnly = false,
    height = 32
}) => {
    return (
        <div className={cn("flex items-center select-none", className)}>
            <img
                src={iconOnly ? "/favicon.png" : "/logo.png"}
                alt="Jobraker"
                style={{ height: typeof height === 'number' ? `${height}px` : height, width: "auto" }}
                className="block object-contain"
            />
        </div>
    )
}

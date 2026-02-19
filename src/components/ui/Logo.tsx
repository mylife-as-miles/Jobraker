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
    width = "auto",
    height = 32
}) => {
    return (
        <div className={cn("flex items-center select-none", className)}>
            <svg
                width={width}
                height={height}
                viewBox={iconOnly ? "35 0 100 80" : "0 0 420 80"}
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="h-full w-auto"
            >
                <defs>
                    <linearGradient id="logo-glow-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#1dff00" />
                        <stop offset="100%" stopColor="#80ff72" />
                    </linearGradient>
                </defs>

                <g fill="#1dff00">
                    {!iconOnly && (
                        <>
                            {/* J */}
                            <path d="M10 20H40V50C40 65 30 70 15 70H5V60H15C25 60 30 55 30 50V30H10V20Z" />
                        </>
                    )}

                    {/* O - Stylized Icon centerpiece */}
                    <g transform={iconOnly ? "translate(45, 10)" : "translate(45, 10)"}>
                        {/* The O Arc Layers */}
                        <path d="M5 40C5 25 12 15 25 12V22C18 25 15 32 15 40C15 48 18 55 25 58V68C12 65 5 55 5 40Z" />
                        <path d="M65 40C65 55 58 65 45 68V58C52 55 55 48 55 40C55 32 52 25 45 22V12C58 15 65 25 65 40Z" />

                        {/* Lower Diagonal Bar - Deep Green Accent */}
                        <path d="M15 65L35 45L45 55L25 75L15 65Z" fill="#13a300" opacity="0.9" />

                        {/* Upper Diagonal Bar with Arrowhead - Glow Green */}
                        <path d="M25 55L58 22L68 32L35 65L25 55Z" fill="url(#logo-glow-grad)" />

                        {/* Sharp Arrowheads / Points */}
                        <path d="M55 18L72 18V35" stroke="#1dff00" strokeWidth="6" strokeLinecap="square" />
                        <path d="M72 18L84 6" stroke="#1dff00" strokeWidth="6" strokeLinecap="square" />

                        {/* Top ghost notch extension */}
                        <path d="M42 22L52 12L56 16L46 26L42 22Z" fill="#1dff00" opacity="0.7" />
                    </g>

                    {!iconOnly && (
                        <g>
                            {/* B */}
                            <path d="M125 20H150C165 20 170 25 170 35C170 42 165 46 155 48C162 50 170 55 170 65C170 75 165 80 150 80H125V20ZM135 30V45H148C155 45 158 42 158 37C158 32 155 30 148 30H135ZM135 55V70H152C158 70 160 67 160 62.5C160 58 158 55 152 55H135Z" />
                            {/* R */}
                            <path d="M185 20H215C225 20 230 25 230 35C230 43 225 48 215 48L230 80H218L203 48H195V80H185V20ZM195 30V40H210C215 40 218 38 218 35C218 32 215 30 210 30H195Z" />
                            {/* A */}
                            <path d="M255 20L275 80H263L260 70H242L239 80H227L247 20H255ZM251 35L245 55H257L251 35Z" />
                            {/* K */}
                            <path d="M280 20H290V45L310 20H322L300 48L322 80H310L290 55V80H280V20Z" />
                            {/* E */}
                            <path d="M330 20H355V30H340V45H355V55H340V70H355V80H330V20Z" />
                            {/* R */}
                            <path d="M365 20H395C405 20 410 25 410 35C410 43 405 48 395 48L410 80H398L383 48H375V80H365V20ZM375 30V40H390C395 40 398 38 398 35C398 32 395 30 390 30H375Z" />
                        </g>
                    )}
                </g>
            </svg>
        </div>
    )
}

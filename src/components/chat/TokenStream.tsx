import React, { useMemo } from "react";
import { motion } from "framer-motion";

export interface TokenStreamProps {
  /** The text string to render with cascading token animation */
  text: string;
  /** Whether the text is actively streaming in real-time */
  isStreaming?: boolean;
  /** Custom container class */
  className?: string;
  /** Optional delay multiplier per token (in seconds) */
  staggerDelay?: number;
}

export const TokenStream: React.FC<TokenStreamProps> = ({
  text,
  isStreaming = true,
  className = "",
  staggerDelay = 0.03,
}) => {
  const tokens = useMemo(() => {
    if (!text) return [];
    // Split text into words and spaces to preserve formatting
    return text.split(/(\s+)/);
  }, [text]);

  return (
    <span className={`token-stream ${isStreaming ? "token-stream-active" : ""} ${className}`}>
      {tokens.map((token, index) => {
        // Render whitespace directly without wrapping
        if (/^\s+$/.test(token)) {
          return token;
        }
        return (
          <span
            key={`${token}-${index}`}
            className="token"
            style={{
              animationDelay: `${Math.min(index * staggerDelay, 1.2)}s`,
            }}
          >
            {token}
          </span>
        );
      })}
      {isStreaming && (
        <motion.span
          className="inline-block w-1.5 h-4 ml-0.5 rounded bg-[#2fd968] align-middle shadow-[0_0_8px_rgba(47,217,104,0.6)]"
          animate={{ opacity: [1, 0.2, 1] }}
          transition={{ duration: 0.7, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
    </span>
  );
};

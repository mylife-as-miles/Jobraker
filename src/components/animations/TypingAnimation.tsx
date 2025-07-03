import React, { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { TextPlugin } from "gsap/TextPlugin";

gsap.registerPlugin(TextPlugin);

interface TypingAnimationProps {
  texts: string[];
  className?: string;
  speed?: number;
  delay?: number;
  cursor?: boolean;
}

export const TypingAnimation: React.FC<TypingAnimationProps> = ({
  texts,
  className = "",
  speed = 0.1,
  delay = 2,
  cursor = true
}) => {
  const textRef = useRef<HTMLSpanElement>(null);
  const cursorRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!textRef.current) return;

    const textElement = textRef.current;
    const cursorElement = cursorRef.current;
    
    // Cursor blinking animation
    if (cursor && cursorElement) {
      gsap.to(cursorElement, {
        opacity: 0,
        duration: 0.5,
        repeat: -1,
        yoyo: true,
        ease: "power2.inOut"
      });
    }

    // Typing animation
    const tl = gsap.timeline({ repeat: -1 });
    
    texts.forEach((text, index) => {
      tl.to(textElement, {
        duration: text.length * speed,
        text: text,
        ease: "none"
      })
      .to(textElement, {
        duration: text.length * speed * 0.5,
        text: "",
        ease: "none",
        delay: delay
      });
    });

    return () => {
      tl.kill();
    };
  }, [texts, speed, delay, cursor]);

  return (
    <span className={className}>
      <span ref={textRef}></span>
      {cursor && <span ref={cursorRef} className="text-[#1dff00]">|</span>}
    </span>
  );
};
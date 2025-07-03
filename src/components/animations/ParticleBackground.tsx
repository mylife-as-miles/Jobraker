import React, { useEffect, useRef } from "react";
import { gsap } from "gsap";

interface ParticleBackgroundProps {
  className?: string;
}

export const ParticleBackground: React.FC<ParticleBackgroundProps> = ({ className = "" }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const particles: HTMLDivElement[] = [];
    
    // Create particles
    for (let i = 0; i < 50; i++) {
      const particle = document.createElement("div");
      particle.className = "absolute w-1 h-1 bg-[#1dff00] rounded-full opacity-30";
      
      // Random position
      particle.style.left = `${Math.random() * 100}%`;
      particle.style.top = `${Math.random() * 100}%`;
      
      container.appendChild(particle);
      particles.push(particle);
    }

    // Animate particles
    particles.forEach((particle, index) => {
      gsap.to(particle, {
        x: `${Math.random() * 200 - 100}px`,
        y: `${Math.random() * 200 - 100}px`,
        duration: 10 + Math.random() * 10,
        repeat: -1,
        yoyo: true,
        ease: "power2.inOut",
        delay: index * 0.1,
        opacity: Math.random() * 0.5 + 0.1
      });
    });

    return () => {
      particles.forEach(particle => {
        if (particle.parentNode) {
          particle.parentNode.removeChild(particle);
        }
      });
    };
  }, []);

  return (
    <div 
      ref={containerRef} 
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
    />
  );
};
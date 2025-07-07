import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { TextPlugin } from 'gsap/TextPlugin';

// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger, TextPlugin);

export const useGSAPAnimations = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Set up smooth scrolling with enhanced performance
      gsap.config({
        force3D: true,
        nullTargetWarn: false,
      });

      // Enable hardware acceleration for better performance
      gsap.set("body", { 
        perspective: 1000,
        transformStyle: "preserve-3d"
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return { containerRef };
};

export const useScrollReveal = (selector: string, options?: any) => {
  useEffect(() => {
    const elements = gsap.utils.toArray(selector);
    
    elements.forEach((element: any) => {
      gsap.fromTo(element, 
        {
          y: 100,
          opacity: 0,
          scale: 0.8,
          rotationX: 45,
        },
        {
          y: 0,
          opacity: 1,
          scale: 1,
          rotationX: 0,
          duration: 1.2,
          ease: "power3.out",
          scrollTrigger: {
            trigger: element,
            start: "top 85%",
            end: "bottom 15%",
            toggleActions: "play none none reverse",
            ...options
          }
        }
      );
    });
  }, [selector, options]);
};

export const useParallaxEffect = (selector: string, speed: number = 0.5) => {
  useEffect(() => {
    const elements = gsap.utils.toArray(selector);
    
    elements.forEach((element: any) => {
      gsap.to(element, {
        yPercent: -50 * speed,
        ease: "none",
        scrollTrigger: {
          trigger: element,
          start: "top bottom",
          end: "bottom top",
          scrub: true,
          invalidateOnRefresh: true,
        }
      });
    });
  }, [selector, speed]);
};

export const useAdvancedParallax = (selector: string, config: {
  speed?: number;
  scale?: number;
  rotation?: number;
  opacity?: boolean;
} = {}) => {
  useEffect(() => {
    const { speed = 0.5, scale = 0, rotation = 0, opacity = false } = config;
    const elements = gsap.utils.toArray(selector);
    
    elements.forEach((element: any) => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: element,
          start: "top bottom",
          end: "bottom top",
          scrub: 1,
          invalidateOnRefresh: true,
        }
      });

      tl.to(element, {
        yPercent: -50 * speed,
        scale: 1 + scale,
        rotation: rotation,
        opacity: opacity ? 0.3 : 1,
        ease: "none",
      });
    });
  }, [selector, config]);
};

export const useCounterAnimation = (selector: string, endValue: number) => {
  useEffect(() => {
    const elements = gsap.utils.toArray(selector);
    
    elements.forEach((element: any) => {
      const obj = { value: 0 };
      
      gsap.to(obj, {
        value: endValue,
        duration: 2,
        ease: "power2.out",
        onUpdate: () => {
          element.textContent = Math.round(obj.value);
        },
        scrollTrigger: {
          trigger: element,
          start: "top 80%",
          toggleActions: "play none none reverse"
        }
      });
    });
  }, [selector, endValue]);
};

export const useStaggerAnimation = (selector: string, stagger: number = 0.1) => {
  useEffect(() => {
    const elements = gsap.utils.toArray(selector);
    
    gsap.fromTo(elements,
      {
        y: 60,
        opacity: 0,
        scale: 0.9,
      },
      {
        y: 0,
        opacity: 1,
        scale: 1,
        duration: 0.8,
        stagger: stagger,
        ease: "power2.out",
        scrollTrigger: {
          trigger: elements[0],
          start: "top 80%",
          toggleActions: "play none none reverse"
        }
      }
    );
  }, [selector, stagger]);
};

export const useTextReveal = (selector: string) => {
  useEffect(() => {
    const elements = gsap.utils.toArray(selector);
    
    elements.forEach((element: any) => {
      const text = element.textContent;
      const chars = text.split('');
      element.innerHTML = chars.map((char: string) => 
        char === ' ' ? ' ' : `<span class="char">${char}</span>`
      ).join('');
      
      const charElements = element.querySelectorAll('.char');
      
      gsap.fromTo(charElements,
        {
          y: 100,
          opacity: 0,
          rotationX: -90,
        },
        {
          y: 0,
          opacity: 1,
          rotationX: 0,
          duration: 0.8,
          stagger: 0.02,
          ease: "back.out(1.7)",
          scrollTrigger: {
            trigger: element,
            start: "top 80%",
            toggleActions: "play none none reverse"
          }
        }
      );
    });
  }, [selector]);
};

export const useMorphingBackground = (selector: string) => {
  useEffect(() => {
    const elements = gsap.utils.toArray(selector);
    
    elements.forEach((element: any) => {
      const tl = gsap.timeline({
        repeat: -1,
        yoyo: true,
        ease: "power2.inOut"
      });
      
      tl.to(element, {
        duration: 4,
        morphSVG: "M0,0 Q50,100 100,0 T200,0 L200,100 L0,100 Z",
      })
      .to(element, {
        duration: 4,
        morphSVG: "M0,0 Q50,-50 100,0 T200,0 L200,100 L0,100 Z",
      });
    });
  }, [selector]);
};

export const useMouseFollower = () => {
  useEffect(() => {
    const cursor = document.createElement('div');
    cursor.className = 'mouse-follower';
    cursor.style.cssText = `
      position: fixed;
      width: 20px;
      height: 20px;
      background: linear-gradient(45deg, #1dff00, #0a8246);
      border-radius: 50%;
      pointer-events: none;
      z-index: 9999;
      mix-blend-mode: difference;
      transition: transform 0.1s ease;
      will-change: transform;
    `;
    document.body.appendChild(cursor);

    const moveCursor = (e: MouseEvent) => {
      gsap.to(cursor, {
        x: e.clientX - 10,
        y: e.clientY - 10,
        duration: 0.1,
        ease: "power2.out",
      });
    };

    document.addEventListener('mousemove', moveCursor);

    return () => {
      document.removeEventListener('mousemove', moveCursor);
      if (document.body.contains(cursor)) {
        document.body.removeChild(cursor);
      }
    };
  }, []);
};

export const use3DCardEffect = (selector: string) => {
  useEffect(() => {
    const cards = gsap.utils.toArray(selector);
    
    cards.forEach((card: any) => {
      const handleMouseMove = (e: MouseEvent) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = (y - centerY) / 10;
        const rotateY = (centerX - x) / 10;

        gsap.to(card, {
          duration: 0.3,
          rotationX: rotateX,
          rotationY: rotateY,
          transformPerspective: 1000,
          ease: "power2.out"
        });
      };

      const handleMouseLeave = () => {
        gsap.to(card, {
          duration: 0.3,
          rotationX: 0,
          rotationY: 0,
          ease: "power2.out"
        });
      };

      card.addEventListener('mousemove', handleMouseMove);
      card.addEventListener('mouseleave', handleMouseLeave);

      return () => {
        card.removeEventListener('mousemove', handleMouseMove);
        card.removeEventListener('mouseleave', handleMouseLeave);
      };
    });
  }, [selector]);
};
import { useEffect, useRef, useCallback } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger);

// Performance optimization: Debounce utility for scroll events
export const useDebounce = (callback: Function, delay: number) => {
  const timeoutRef = useRef<NodeJS.Timeout>();
  
  return useCallback((...args: any[]) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => callback(...args), delay);
  }, [callback, delay]);
};

// Intersection Observer hook for performance optimization
export const useIntersectionObserver = (options = {}) => {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
    }, {
      threshold: 0.1,
      rootMargin: '50px',
      ...options
    });

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  return [ref, isIntersecting] as const;
};

// Main GSAP animations hook with performance optimizations
export const useGSAPAnimations = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Performance optimizations
      gsap.config({
        force3D: true,
        nullTargetWarn: false,
      });

      // Enable hardware acceleration for better performance
      gsap.set("body", { 
        perspective: 1000,
        transformStyle: "preserve-3d"
      });

      // Smooth scroll behavior with performance optimization
      document.documentElement.style.scrollBehavior = 'smooth';

    }, containerRef);

    return () => {
      ctx.revert();
      document.documentElement.style.scrollBehavior = 'auto';
    };
  }, []);

  return { containerRef };
};

// Scroll reveal animation with performance optimization
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

// Advanced parallax effect with multiple layers
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

// Parallax effect with GPU acceleration
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

// Counter animation with performance optimization
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

// Stagger animation with performance optimization
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

// Text reveal animation with character-by-character effect
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

// 3D card effect with mouse interaction
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

// Mouse follower with performance optimization
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

// Morphing background effect
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
        scale: 1.2,
        rotation: 10,
      })
      .to(element, {
        duration: 4,
        scale: 0.8,
        rotation: -10,
      });
    });
  }, [selector]);
};

// Performance monitoring utility
export const usePerformanceMonitor = () => {
  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    
    const measureFPS = () => {
      frameCount++;
      const currentTime = performance.now();
      
      if (currentTime - lastTime >= 1000) {
        const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
        
        // Log performance warnings if FPS drops below 30
        if (fps < 30) {
          console.warn(`Performance warning: FPS dropped to ${fps}`);
        }
        
        frameCount = 0;
        lastTime = currentTime;
      }
      
      requestAnimationFrame(measureFPS);
    };
    
    requestAnimationFrame(measureFPS);
  }, []);
};
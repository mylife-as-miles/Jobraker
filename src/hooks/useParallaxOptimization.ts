import { useEffect, useRef, useCallback } from 'react';

interface ParallaxOptions {
  speed?: number;
  enableOnMobile?: boolean;
  threshold?: number;
}

export const useParallaxOptimization = (options: ParallaxOptions = {}) => {
  const {
    speed = 0.5,
    enableOnMobile = false,
    threshold = 0.1
  } = options;

  const elementRef = useRef<HTMLElement>(null);
  const rafRef = useRef<number>();
  const lastScrollY = useRef(0);

  const updateParallax = useCallback(() => {
    if (!elementRef.current) return;

    const scrollY = window.scrollY;
    const deltaY = scrollY - lastScrollY.current;
    
    // Only update if scroll delta is significant (performance optimization)
    if (Math.abs(deltaY) < threshold) {
      rafRef.current = requestAnimationFrame(updateParallax);
      return;
    }

    const rect = elementRef.current.getBoundingClientRect();
    const isInViewport = rect.bottom >= 0 && rect.top <= window.innerHeight;

    if (isInViewport) {
      const yPos = -(scrollY * speed);
      
      // Use transform3d for hardware acceleration
      elementRef.current.style.transform = `translate3d(0, ${yPos}px, 0)`;
      elementRef.current.style.willChange = 'transform';
    }

    lastScrollY.current = scrollY;
    rafRef.current = requestAnimationFrame(updateParallax);
  }, [speed, threshold]);

  useEffect(() => {
    // Check if device supports parallax
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const supportsParallax = !isMobile || enableOnMobile;
    
    if (!supportsParallax) return;

    // Enable hardware acceleration
    if (elementRef.current) {
      elementRef.current.style.transform = 'translateZ(0)';
      elementRef.current.style.willChange = 'transform';
      elementRef.current.style.backfaceVisibility = 'hidden';
      elementRef.current.style.perspective = '1000px';
    }

    // Start parallax animation
    rafRef.current = requestAnimationFrame(updateParallax);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      if (elementRef.current) {
        elementRef.current.style.willChange = 'auto';
      }
    };
  }, [updateParallax, enableOnMobile]);

  return elementRef;
};

// Performance monitoring hook
export const useScrollPerformance = () => {
  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());
  const fpsHistory = useRef<number[]>([]);

  useEffect(() => {
    const measureFPS = () => {
      frameCount.current++;
      const currentTime = performance.now();
      
      if (currentTime - lastTime.current >= 1000) {
        const fps = Math.round((frameCount.current * 1000) / (currentTime - lastTime.current));
        fpsHistory.current.push(fps);
        
        // Keep only last 10 measurements
        if (fpsHistory.current.length > 10) {
          fpsHistory.current.shift();
        }
        
        // Log performance warnings
        if (fps < 30) {
          console.warn(`Parallax performance warning: FPS dropped to ${fps}`);
        }
        
        frameCount.current = 0;
        lastTime.current = currentTime;
      }
      
      requestAnimationFrame(measureFPS);
    };
    
    requestAnimationFrame(measureFPS);
  }, []);

  const getAverageFPS = useCallback(() => {
    if (fpsHistory.current.length === 0) return 60;
    return fpsHistory.current.reduce((sum, fps) => sum + fps, 0) / fpsHistory.current.length;
  }, []);

  return { getAverageFPS };
};

// Intersection Observer hook for performance
export const useInViewport = (threshold = 0.1) => {
  const elementRef = useRef<HTMLElement>(null);
  const isInViewport = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        isInViewport.current = entry.isIntersecting;
      },
      { threshold, rootMargin: '50px' }
    );

    if (elementRef.current) {
      observer.observe(elementRef.current);
    }

    return () => observer.disconnect();
  }, [threshold]);

  return { elementRef, isInViewport: isInViewport.current };
};
import { useEffect, useRef } from 'react';
import { animate, stagger } from 'animejs';

interface UseAnimeAnimationsOptions {
  targets?: string | HTMLElement | NodeList | Array<HTMLElement>;
  delay?: number;
  duration?: number;
  easing?: string;
  once?: boolean;
}

export const useAnimeAnimations = (options: UseAnimeAnimationsOptions = {}) => {
  const { targets, delay = 0, duration = 1000, easing = 'easeOutExpo', once = true } = options;
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!targets || (once && hasAnimated.current)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (once && hasAnimated.current) return;
            hasAnimated.current = true;

            animate(targets, {
              opacity: [0, 1],
              translateY: [50, 0],
              duration,
              delay: stagger(delay),
              easing,
            });
          }
        });
      },
      { threshold: 0.1 }
    );

    const elements = typeof targets === 'string' 
      ? document.querySelectorAll(targets)
      : Array.isArray(targets)
      ? targets
      : [targets];

    elements.forEach((el) => {
      if (el instanceof Element) observer.observe(el);
    });

    return () => {
      elements.forEach((el) => {
        if (el instanceof Element) observer.unobserve(el);
      });
    };
  }, [targets, delay, duration, easing, once]);
};

export const useStaggerText = (selector: string, delay: number = 100) => {
  useEffect(() => {
    const elements = document.querySelectorAll(selector);
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animate(selector, {
              opacity: [0, 1],
              translateY: [30, 0],
              duration: 800,
              delay: stagger(delay),
              easing: 'easeOutExpo',
            });
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2 }
    );

    elements.forEach((el) => observer.observe(el));

    return () => {
      elements.forEach((el) => observer.unobserve(el));
    };
  }, [selector, delay]);
};

export const useParallaxScroll = (selector: string, speed: number = 0.5) => {
  useEffect(() => {
    const elements = document.querySelectorAll(selector);
    if (elements.length === 0) return;

    const handleScroll = () => {
      const scrollY = window.scrollY;
      elements.forEach((el) => {
        if (el instanceof HTMLElement) {
          const rect = el.getBoundingClientRect();
          const offset = (scrollY - rect.top) * speed;
          el.style.transform = `translateY(${offset}px)`;
        }
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [selector, speed]);
};

export const useCounterAnimation = (
  target: number,
  duration: number = 2000,
  selector?: string
) => {
  const countRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!countRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const obj = { value: 0 };
            animate(obj, {
              value: target,
              duration,
              easing: 'easeOutExpo',
              update: () => {
                if (countRef.current) {
                  countRef.current.textContent = Math.floor(obj.value).toString();
                }
              },
            });
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.5 }
    );

    observer.observe(countRef.current);

    return () => {
      if (countRef.current) observer.unobserve(countRef.current);
    };
  }, [target, duration]);

  return countRef;
};


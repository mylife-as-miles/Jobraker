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
      // Set up smooth scrolling
      gsap.config({
        force3D: true,
        nullTargetWarn: false,
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
          scrub: true
        }
      });
    });
  }, [selector, speed]);
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
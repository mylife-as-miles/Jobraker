import React, { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

interface ScrollAnimationWrapperProps {
  children: React.ReactNode;
  animation?: "fadeInUp" | "fadeInLeft" | "fadeInRight" | "scale" | "stagger";
  delay?: number;
  duration?: number;
  className?: string;
}

export const ScrollAnimationWrapper: React.FC<ScrollAnimationWrapperProps> = ({
  children,
  animation = "fadeInUp",
  delay = 0,
  duration = 0.8,
  className = ""
}) => {
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!elementRef.current) return;

    const element = elementRef.current;
    
    let fromProps: any = {};
    let toProps: any = {};

    switch (animation) {
      case "fadeInUp":
        fromProps = { y: 50, opacity: 0 };
        toProps = { y: 0, opacity: 1 };
        break;
      case "fadeInLeft":
        fromProps = { x: -50, opacity: 0 };
        toProps = { x: 0, opacity: 1 };
        break;
      case "fadeInRight":
        fromProps = { x: 50, opacity: 0 };
        toProps = { x: 0, opacity: 1 };
        break;
      case "scale":
        fromProps = { scale: 0.8, opacity: 0 };
        toProps = { scale: 1, opacity: 1 };
        break;
      case "stagger":
        fromProps = { y: 30, opacity: 0 };
        toProps = { y: 0, opacity: 1 };
        break;
    }

    gsap.set(element, fromProps);

    ScrollTrigger.create({
      trigger: element,
      start: "top 80%",
      onEnter: () => {
        if (animation === "stagger") {
          gsap.to(element.children, {
            ...toProps,
            duration,
            delay,
            ease: "power3.out",
            stagger: 0.1
          });
        } else {
          gsap.to(element, {
            ...toProps,
            duration,
            delay,
            ease: "power3.out"
          });
        }
      }
    });

    return () => {
      ScrollTrigger.getAll().forEach(trigger => {
        if (trigger.trigger === element) {
          trigger.kill();
        }
      });
    };
  }, [animation, delay, duration]);

  return (
    <div ref={elementRef} className={className}>
      {children}
    </div>
  );
};
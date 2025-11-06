import React from 'react';
import { motion } from 'framer-motion';

export const AnimatedSVGBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
      {/* Animated SVG Grid Pattern */}
      <svg
        className="absolute inset-0 w-full h-full opacity-20"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Animated gradient */}
          <linearGradient id="grid-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1dff00" stopOpacity="0.1">
              <animate
                attributeName="stop-opacity"
                values="0.1;0.3;0.1"
                dur="4s"
                repeatCount="indefinite"
              />
            </stop>
            <stop offset="100%" stopColor="#0a8246" stopOpacity="0.05">
              <animate
                attributeName="stop-opacity"
                values="0.05;0.15;0.05"
                dur="4s"
                repeatCount="indefinite"
              />
            </stop>
          </linearGradient>

          {/* Animated pattern */}
          <pattern
            id="grid-pattern"
            x="0"
            y="0"
            width="100"
            height="100"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 100 0 L 0 0 0 100"
              fill="none"
              stroke="url(#grid-gradient)"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid-pattern)" />
      </svg>

      {/* Floating Hexagon */}
      <motion.svg
        className="absolute top-20 right-20 w-24 h-24 opacity-10"
        viewBox="0 0 100 100"
        animate={{
          y: [0, -20, 0],
          rotate: [0, 360],
          opacity: [0.1, 0.2, 0.1],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <polygon
          points="50 1 95 25 95 75 50 99 5 75 5 25"
          fill="none"
          stroke="#1dff00"
          strokeWidth="1"
        />
      </motion.svg>

      {/* Floating Circle */}
      <motion.svg
        className="absolute bottom-40 left-40 w-32 h-32 opacity-10"
        viewBox="0 0 100 100"
        animate={{
          y: [0, 30, 0],
          x: [0, 20, 0],
          scale: [1, 1.2, 1],
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2,
        }}
      >
        <circle cx="50" cy="50" r="40" fill="none" stroke="#1dff00" strokeWidth="0.5" />
        <circle cx="50" cy="50" r="30" fill="none" stroke="#0a8246" strokeWidth="0.5">
          <animate
            attributeName="r"
            values="30;35;30"
            dur="3s"
            repeatCount="indefinite"
          />
        </circle>
      </motion.svg>

      {/* Animated Wave */}
      <svg
        className="absolute bottom-0 left-0 w-full h-48 opacity-5"
        viewBox="0 0 1200 120"
        preserveAspectRatio="none"
      >
        <path
          d="M0,50 C150,80 350,0 600,50 C850,100 1050,20 1200,50 L1200,120 L0,120 Z"
          fill="url(#wave-gradient)"
        >
          <animate
            attributeName="d"
            values="M0,50 C150,80 350,0 600,50 C850,100 1050,20 1200,50 L1200,120 L0,120 Z;
                    M0,60 C150,30 350,90 600,40 C850,10 1050,70 1200,40 L1200,120 L0,120 Z;
                    M0,50 C150,80 350,0 600,50 C850,100 1050,20 1200,50 L1200,120 L0,120 Z"
            dur="10s"
            repeatCount="indefinite"
          />
        </path>
        <defs>
          <linearGradient id="wave-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#1dff00" />
            <stop offset="100%" stopColor="#0a8246" />
          </linearGradient>
        </defs>
      </svg>

      {/* Particle System */}
      {[...Array(15)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-[#1dff00] rounded-full"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            y: [0, -30, 0],
            x: [0, Math.random() * 20 - 10, 0],
            opacity: [0, 1, 0],
            scale: [0, 1.5, 0],
          }}
          transition={{
            duration: 3 + Math.random() * 2,
            repeat: Infinity,
            delay: Math.random() * 5,
            ease: "easeInOut",
          }}
        />
      ))}

      {/* Rotating Rings */}
      <motion.svg
        className="absolute top-1/3 left-1/4 w-64 h-64 opacity-5"
        viewBox="0 0 200 200"
        animate={{ rotate: 360 }}
        transition={{
          duration: 30,
          repeat: Infinity,
          ease: "linear",
        }}
      >
        <circle
          cx="100"
          cy="100"
          r="80"
          fill="none"
          stroke="#1dff00"
          strokeWidth="0.5"
          strokeDasharray="5,5"
        />
        <circle
          cx="100"
          cy="100"
          r="60"
          fill="none"
          stroke="#1dff00"
          strokeWidth="0.5"
          strokeDasharray="3,3"
        />
      </motion.svg>

      {/* Morphing Blob */}
      <svg
        className="absolute top-1/2 right-1/4 w-96 h-96 opacity-5"
        viewBox="0 0 200 200"
      >
        <defs>
          <linearGradient id="blob-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1dff00" />
            <stop offset="100%" stopColor="#0a8246" />
          </linearGradient>
        </defs>
        <path fill="url(#blob-gradient)">
          <animate
            attributeName="d"
            values="M40,-65C50,-55,55,-40,60,-25C65,-10,70,5,70,20C70,35,65,50,55,60C45,70,30,75,15,75C0,75,-15,70,-30,65C-45,60,-60,55,-70,45C-80,35,-85,20,-85,5C-85,-10,-80,-25,-70,-35C-60,-45,-45,-50,-30,-55C-15,-60,0,-65,20,-65C40,-65,40,-65,40,-65Z;
                    M45,-70C55,-60,60,-45,65,-30C70,-15,75,0,75,15C75,30,70,45,60,55C50,65,35,70,20,70C5,70,-10,65,-25,60C-40,55,-55,50,-65,40C-75,30,-80,15,-80,0C-80,-15,-75,-30,-65,-40C-55,-50,-40,-55,-25,-60C-10,-65,5,-70,25,-70C45,-70,45,-70,45,-70Z;
                    M40,-65C50,-55,55,-40,60,-25C65,-10,70,5,70,20C70,35,65,50,55,60C45,70,30,75,15,75C0,75,-15,70,-30,65C-45,60,-60,55,-70,45C-80,35,-85,20,-85,5C-85,-10,-80,-25,-70,-35C-60,-45,-45,-50,-30,-55C-15,-60,0,-65,20,-65C40,-65,40,-65,40,-65Z"
            dur="8s"
            repeatCount="indefinite"
          />
        </path>
      </svg>
    </div>
  );
};


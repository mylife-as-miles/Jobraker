import React from "react";
import { motion, useScroll, useTransform, useSpring, MotionValue } from "framer-motion";
import { Button } from "../../../components/ui/button";
import { ArrowRight, Terminal } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const HeroParallax = () => {
  const navigate = useNavigate();
  const ref = React.useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const springConfig = { stiffness: 300, damping: 30, bounce: 100 };
  const translateY = useSpring(
    useTransform(scrollYProgress, [0, 0.2], [0, -100]),
    springConfig
  );
  const translateX = useSpring(
    useTransform(scrollYProgress, [0, 0.2], [0, 100]),
    springConfig
  );
  const rotateX = useSpring(
    useTransform(scrollYProgress, [0, 0.2], [15, 0]),
    springConfig
  );
  const opacity = useSpring(
    useTransform(scrollYProgress, [0, 0.2], [0.2, 1]),
    springConfig
  );
  const rotateZ = useSpring(
    useTransform(scrollYProgress, [0, 0.2], [20, 0]),
    springConfig
  );
  const translateYReverse = useSpring(
    useTransform(scrollYProgress, [0, 0.2], [-50, 50]), // Adjusted range
    springConfig
  );

  return (
    <div
      ref={ref}
      className="h-[60rem] py-20 overflow-hidden  antialiased relative flex flex-col self-auto [perspective:1000px] [transform-style:preserve-3d]"
    >
      <Header />
      <motion.div
        style={{
          rotateX,
          rotateZ,
          translateY,
          opacity,
        }}
        className=""
      >
        <motion.div className="flex flex-row-reverse space-x-reverse space-x-10 mb-20">
          {firstRow.map((product) => (
            <ProductCard
              product={product}
              translate={translateX}
              key={product.title}
            />
          ))}
        </motion.div>
        <motion.div className="flex flex-row mb-20 space-x-10">
          {secondRow.map((product) => (
            <ProductCard
              product={product}
              translate={translateYReverse}
              key={product.title}
            />
          ))}
        </motion.div>
        <motion.div className="flex flex-row-reverse space-x-reverse space-x-10">
          {thirdRow.map((product) => (
            <ProductCard
              product={product}
              translate={translateX}
              key={product.title}
            />
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
};

const Header = () => {
  const navigate = useNavigate();
  return (
    <div className="max-w-7xl relative mx-auto py-20 md:py-32 px-4 w-full left-0 top-0">
      <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full border border-[#1dff00]/30 bg-[#1dff00]/5 text-[#1dff00] text-xs font-mono tracking-widest uppercase mb-8">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1dff00] opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[#1dff00]"></span>
        </span>
        <span>AI Agent V2.0 Online</span>
      </div>
      <h1 className="text-4xl md:text-7xl font-bold dark:text-white font-mono">
        Your Job Search <br />
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1dff00] to-[#00b300]">
          On Autopilot
        </span>
      </h1>
      <p className="max-w-2xl text-base md:text-xl mt-8 dark:text-neutral-200 font-mono text-gray-400">
        JobRaker is the world's first autonomous AI agent that applies to jobs for you.
        It scans 50k+ boards, optimizes your resume, and submits applications 24/7.
      </p>

      <div className="flex flex-col sm:flex-row items-center gap-4 mt-10">
        <Button
          onClick={() => navigate('/signup')}
          className="bg-[#1dff00] text-black hover:bg-[#1dff00]/90 h-12 px-8 text-lg font-bold rounded-none border border-[#1dff00]"
        >
          DEPLOY AGENT
          <ArrowRight className="w-5 h-5 ml-2" />
        </Button>
        <Button
          variant="outline"
          className="border-[#1dff00] text-[#1dff00] bg-transparent hover:bg-[#1dff00]/10 h-12 px-8 text-lg font-mono rounded-none"
        >
          <Terminal className="w-5 h-5 mr-2" />
          VIEW LOGS
        </Button>
      </div>
    </div>
  );
};

export const ProductCard = ({
  product,
  translate,
}: {
  product: {
    title: string;
    link: string;
    thumbnail: string;
  };
  translate: MotionValue<number>;
}) => {
  return (
    <motion.div
      style={{
        x: translate,
      }}
      whileHover={{
        y: -20,
      }}
      key={product.title}
      className="group/product h-96 w-[30rem] relative flex-shrink-0"
    >
      <div className="block group-hover/product:shadow-2xl opacity-40 group-hover/product:opacity-100 transition duration-500">
        <div
          className="absolute inset-0 bg-cover bg-center rounded-xl border border-[#1dff00]/30"
          style={{ backgroundImage: `url(${product.thumbnail})` }}
        />
        <div className="absolute inset-0 bg-black/50 group-hover/product:bg-black/0 transition duration-500 rounded-xl pointer-events-none" />
      </div>
      <div className="absolute bottom-4 left-4 opacity-0 group-hover/product:opacity-100 text-white font-mono">
        {product.title}
      </div>
    </motion.div>
  );
};

const firstRow = [
  {
    title: "AI Resume Builder",
    link: "#",
    thumbnail: "https://images.unsplash.com/photo-1586281380349-632531db7ed4?q=80&w=2070&auto=format&fit=crop",
  },
  {
    title: "Auto-Apply Engine",
    link: "#",
    thumbnail: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2070&auto=format&fit=crop",
  },
  {
    title: "Job Discovery",
    link: "#",
    thumbnail: "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?q=80&w=2072&auto=format&fit=crop",
  },
];
const secondRow = [
  {
    title: "Interview Coaching",
    link: "#",
    thumbnail: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=2069&auto=format&fit=crop",
  },
  {
    title: "Salary Negotiation",
    link: "#",
    thumbnail: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?q=80&w=2070&auto=format&fit=crop",
  },
  {
    title: "Analytics Dashboard",
    link: "#",
    thumbnail: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2070&auto=format&fit=crop",
  },
];
const thirdRow = [
  {
    title: "Smart Filtering",
    link: "#",
    thumbnail: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=2070&auto=format&fit=crop",
  },
  {
    title: "Cover Letter Gen",
    link: "#",
    thumbnail: "https://images.unsplash.com/photo-1516383748727-85db1280d72c?q=80&w=2070&auto=format&fit=crop",
  },
  {
    title: "Email Automation",
    link: "#",
    thumbnail: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=2070&auto=format&fit=crop",
  },
];

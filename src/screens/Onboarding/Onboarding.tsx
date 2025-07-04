import { motion } from "framer-motion";

export const Onboarding = (): JSX.Element => {
  const floatingVariants = {
    animate: {
      y: [-10, 10, -10],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut",
      },
    },
  };

  const fadeInUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.6 } },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="text-center">
        <motion.h1
          className="text-4xl font-bold text-white mb-4"
          variants={fadeInUp}
          initial="initial"
          animate="animate"
        >
          Welcome to Jobraker
        </motion.h1>
        <motion.p
          className="text-xl text-white/80 mb-8"
          variants={fadeInUp}
          initial="initial"
          animate="animate"
        >
          Let's get you set up
        </motion.p>
        <motion.div
          variants={floatingVariants}
          animate="animate"
          className="w-16 h-16 bg-white/20 rounded-full mx-auto"
        />
      </div>
    </div>
  );
};
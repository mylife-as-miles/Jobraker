import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowDown } from 'lucide-react';

interface Props {
  target: React.RefObject<HTMLDivElement>;
}

export const ScrollToBottom: React.FC<Props> = ({ target }) => {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = target.current;
    if (!el) return;
    const onScroll = () => {
      const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
      setVisible(dist > 240);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener('scroll', onScroll);
  }, [target]);

  const scrollDown = () => {
    const el = target.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.92 }}
            onClick={scrollDown}
            className="absolute bottom-4 right-4 z-20 px-2.5 py-2 rounded-xl bg-[#0d0d0d]/90 border border-[#1dff00]/30 text-[#1dff00] shadow-md backdrop-blur-md flex items-center gap-1 text-xs"
        >
          <ArrowDown className="w-4 h-4" /> New Messages
        </motion.button>
      )}
    </AnimatePresence>
  );
};

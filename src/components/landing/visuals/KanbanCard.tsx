import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";

export const KanbanCard = () => {
  // Simulate cards moving from "To Do" -> "In Progress" -> "Done"
  const [columns, setColumns] = useState([
    { id: "todo", title: "Queue", cards: [1, 2] },
    { id: "progress", title: "Applying", cards: [3] },
    { id: "done", title: "Applied", cards: [4, 5] },
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setColumns((prev) => {
        const newCols = JSON.parse(JSON.stringify(prev));
        // Move a card from todo to progress, or progress to done, or recycle done to todo
        const todo = newCols[0];
        const progress = newCols[1];
        const done = newCols[2];

        if (progress.cards.length > 0) {
          // Move from progress to done
          const card = progress.cards.shift();
          done.cards.push(card);
        } else if (todo.cards.length > 0) {
          // Move from todo to progress
          const card = todo.cards.shift();
          progress.cards.push(card);
        } else {
           // Reset for loop effect
           todo.cards = [1, 2, 3];
           progress.cards = [];
           done.cards = [4, 5];
        }
        return newCols;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full h-full p-4 flex gap-4 bg-neutral-900/50 rounded-xl overflow-hidden">
      {columns.map((col) => (
        <div key={col.id} className="flex-1 flex flex-col gap-2 min-w-[60px]">
          <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold mb-1">
            {col.title}
          </div>
          <div className="flex-1 bg-white/5 rounded-lg p-2 flex flex-col gap-2">
            {col.cards.map((card: any) => (
              <motion.div
                layoutId={`card-${card}`}
                key={card}
                className="h-8 bg-neutral-800 rounded border border-neutral-700 w-full relative overflow-hidden"
              >
                 <div className="absolute top-1/2 left-2 w-12 h-1 bg-neutral-600 rounded-full -translate-y-1/2" />
                 {col.id === 'done' && (
                     <div className="absolute right-2 top-1/2 -translate-y-1/2 w-2 h-2 bg-[#1dff00] rounded-full" />
                 )}
              </motion.div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

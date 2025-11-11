import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState, useCallback, useMemo } from 'react';
import { Trash2 } from 'lucide-react';
import { createClient } from "@/lib/supabaseClient";

import { CreateCoverLetterCard } from "./_components/create-card";
import { CoverLetterCard } from "./_components/cover-letter-card";

type LibraryEntry = { id: string; name: string; updatedAt: string; data: any };

export const GridView = () => {
  const supabase = useMemo(() => createClient(), []);
  const [library, setLibrary] = useState<LibraryEntry[]>([]);
  const [selected, setSelected] = useState<string[]>([]);

  // Load library from Supabase
  const loadLibrary = useCallback(async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) {
        setLibrary([]);
        return;
      }

      const { data: coverLetters, error } = await (supabase as any)
        .from('cover_letters')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      if (coverLetters) {
        const entries: LibraryEntry[] = coverLetters.map((cl: any) => ({
          id: cl.id,
          name: cl.name || 'Untitled Cover Letter',
          updatedAt: cl.updated_at,
          data: {
            role: cl.role,
            company: cl.company,
            jobDescription: cl.job_description,
            tone: cl.tone,
            lengthPref: cl.length_pref,
            senderName: cl.sender_name,
            senderEmail: cl.sender_email,
            senderPhone: cl.sender_phone,
            senderAddress: cl.sender_address,
            recipient: cl.recipient,
            recipientTitle: cl.recipient_title,
            recipientAddress: cl.recipient_address,
            date: cl.date,
            subject: cl.subject,
            salutation: cl.salutation,
            paragraphs: Array.isArray(cl.paragraphs) ? cl.paragraphs : [],
            closing: cl.closing,
            signatureName: cl.signature_name,
            content: cl.content,
            fontSize: cl.font_size,
            savedAt: cl.updated_at,
          },
        }));
        setLibrary(entries);
      } else {
        setLibrary([]);
      }
    } catch (error) {
      console.error('Error loading cover letters:', error);
      setLibrary([]);
    }
  }, [supabase]);

  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  // Reload library (callback for cards to trigger refresh)
  const reloadLibrary = useCallback(() => {
    loadLibrary();
  }, [loadLibrary]);

  const toggleSelect = useCallback((id: string) => {
    setSelected(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }, []);

  const clearSelection = useCallback(() => setSelected([]), []);

  const bulkDelete = useCallback(async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) return;

      const { error } = await (supabase as any)
        .from('cover_letters')
        .delete()
        .eq('user_id', userId)
        .in('id', selected);

      if (error) throw error;

      setLibrary((prev) => prev.filter(l => !selected.includes(l.id)));
      setSelected([]);
    } catch (error) {
      console.error('Error deleting cover letters:', error);
    }
  }, [library, selected, supabase]);

  return (
    <div className="relative">
      {selected.length > 0 && (
        <div className="sticky top-0 z-40 mb-4 -mt-2 -mx-1 px-4 py-3 flex items-center gap-3 rounded-lg bg-gradient-to-r from-[#0d0d0d] via-[#111] to-[#0d0d0d] border border-[#1dff00]/30 shadow-[0_0_20px_-6px_rgba(29,255,0,0.4)] animate-in slide-in-from-top-5">
          <span className="text-xs font-medium tracking-wide text-[#1dff00]">{selected.length} selected</span>
          <div className="h-4 w-px bg-[#1dff00]/30" />
          <button 
            onClick={bulkDelete} 
            className="text-[11px] px-2 py-1 rounded-md border border-red-500/40 hover:bg-red-500/10 text-red-400 flex items-center gap-1"
          >
            <Trash2 className="w-3 h-3"/> Delete
          </button>
          <button 
            onClick={clearSelection} 
            className="ml-auto text-[11px] px-2 py-1 rounded-md border border-white/15 hover:border-[#1dff00]/40 text-white"
          >
            Clear
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        <motion.div initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }}>
          <CreateCoverLetterCard />
        </motion.div>

        {library.length > 0 && (
          <AnimatePresence>
            {library.map((letter, index) => (
              <motion.div
                key={letter.id}
                layout
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0, transition: { delay: (index + 1) * 0.1 } }}
                exit={{ opacity: 0, filter: "blur(8px)", transition: { duration: 0.5 } }}
              >
                <CoverLetterCard 
                  letter={letter} 
                  onDelete={reloadLibrary}
                  isSelected={selected.includes(letter.id)}
                  onToggleSelect={() => toggleSelect(letter.id)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};

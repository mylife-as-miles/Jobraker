import { useState, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Pin, BookmarkPlus, Trash2 } from 'lucide-react';
import { useChatSessions } from '../../stores/chatSessions';

interface Props { open: boolean; onClose: () => void; }

export const PinnedAndSnippetsPanel = ({ open, onClose }: Props) => {
  const { activeSessionId, sessions, messages, snippets, unpinMessage, deleteSnippet } = useChatSessions();
  const [tab, setTab] = useState<'pinned' | 'snippets'>('pinned');
  const pinnedIds = activeSessionId ? (sessions[activeSessionId]?.pinned || []) : [];
  const pinnedMessages = useMemo(() => {
    if (!activeSessionId) return [];
    const list = messages[activeSessionId] || [];
    return list.filter(m => pinnedIds.includes(m.id));
  }, [activeSessionId, messages, pinnedIds]);

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ x: 380, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 380, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 30 }}
          className="fixed top-0 right-0 h-full w-[360px] z-[160] bg-[#060806]/95 backdrop-blur-xl border-l border-[#1dff00]/20 flex flex-col"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#1dff00]/20">
            <div className="flex items-center gap-3 text-sm font-semibold tracking-wide text-[#1dff00]">
              {tab === 'pinned' ? 'Pinned Insights' : 'Snippets'}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setTab('pinned')} className={`text-[11px] px-2 py-1 rounded-md border ${tab==='pinned'?'border-[#1dff00]/60 text-[#1dff00] bg-[#152e15]':'border-[#1dff00]/20 text-neutral-400 hover:text-[#1dff00]'}`}>Pinned</button>
              <button onClick={() => setTab('snippets')} className={`text-[11px] px-2 py-1 rounded-md border ${tab==='snippets'?'border-[#1dff00]/60 text-[#1dff00] bg-[#152e15]':'border-[#1dff00]/20 text-neutral-400 hover:text-[#1dff00]'}`}>Snippets</button>
              <button onClick={onClose} className="p-1.5 rounded-md hover:bg-[#1dff00]/10 text-neutral-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {tab === 'pinned' && (
              <div className="space-y-2">
                {pinnedMessages.length === 0 && <div className="text-[11px] text-neutral-500 text-center pt-6">No pinned messages yet.</div>}
                {pinnedMessages.map(pm => (
                  <div key={pm.id} className="group border border-[#1dff00]/25 rounded-xl p-3 bg-[#0f150f]/60 hover:bg-[#141f14]/70 transition">
                    <div className="flex items-start gap-2">
                      <Pin className="w-4 h-4 text-[#1dff00] mt-0.5" />
                      <div className="flex-1 text-[12px] leading-relaxed text-neutral-200 whitespace-pre-wrap">{pm.content.slice(0, 800)}</div>
                    </div>
                    <div className="flex justify-end pt-2">
                      <button onClick={()=>unpinMessage(activeSessionId!, pm.id)} className="text-[10px] px-2 py-1 rounded-md bg-[#1dff00]/10 text-[#1dff00] hover:bg-[#1dff00]/20 transition">Unpin</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {tab === 'snippets' && (
              <div className="space-y-2">
                {snippets.length === 0 && <div className="text-[11px] text-neutral-500 text-center pt-6">No saved snippets yet.</div>}
                {snippets.slice().sort((a,b)=>b.createdAt - a.createdAt).map(sn => (
                  <div key={sn.id} className="group border border-[#1dff00]/25 rounded-xl p-3 bg-[#101510]/60 hover:bg-[#162416]/70 transition">
                    <div className="flex items-start gap-2">
                      <BookmarkPlus className="w-4 h-4 text-[#1dff00] mt-0.5" />
                      <div className="flex-1">
                        <div className="text-[11px] font-semibold text-[#b5ffb2] mb-1 truncate">{sn.title}</div>
                        <div className="text-[12px] leading-relaxed text-neutral-300 whitespace-pre-wrap">{sn.content.slice(0, 1000)}</div>
                      </div>
                    </div>
                    <div className="flex justify-end pt-2 gap-2">
                      <button onClick={()=>deleteSnippet(sn.id)} className="text-[10px] px-2 py-1 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 transition flex items-center gap-1"><Trash2 className="w-3 h-3" />Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="px-4 py-2 border-t border-[#1dff00]/20 text-[10px] text-neutral-500 tracking-wider flex justify-between">
            <span>{pinnedMessages.length} pinned</span>
            <span>{snippets.length} snippets</span>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
};

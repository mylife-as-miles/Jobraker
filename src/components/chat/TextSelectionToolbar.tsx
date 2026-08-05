import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquarePlus, Copy, HelpCircle, FileText, Check, Sparkles } from "lucide-react";
import { useToast } from "../ui/toast";

export interface TextSelectionToolbarProps {
  /** Optional container element to limit selection detection to. Defaults to entire document. */
  containerRef?: React.RefObject<HTMLElement>;
}

export const TextSelectionToolbar: React.FC<TextSelectionToolbarProps> = ({ containerRef }) => {
  const { success: toastSuccess } = useToast();
  const [selectedText, setSelectedText] = useState("");
  const [position, setPosition] = useState<{ top: number; left: number; placeAbove: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);

  const handleSelectionChange = useCallback(() => {
    const selection = window.getSelection();

    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      setSelectedText("");
      setPosition(null);
      return;
    }

    const text = selection.toString().trim();
    if (text.length < 2) {
      setSelectedText("");
      setPosition(null);
      return;
    }

    // Ignore selection if inside an editable input / textarea
    const activeElement = document.activeElement;
    if (
      activeElement &&
      (activeElement.tagName === "INPUT" ||
        activeElement.tagName === "TEXTAREA" ||
        (activeElement as HTMLElement).isContentEditable)
    ) {
      setSelectedText("");
      setPosition(null);
      return;
    }

    // Check container bounds if containerRef is provided
    if (containerRef && containerRef.current) {
      const anchorNode = selection.anchorNode;
      if (anchorNode && !containerRef.current.contains(anchorNode)) {
        setSelectedText("");
        setPosition(null);
        return;
      }
    }

    try {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      if (rect.width === 0 || rect.height === 0) {
        setSelectedText("");
        setPosition(null);
        return;
      }

      // Compute position relative to viewport / scroll
      const placeAbove = rect.top > 60;
      const top = placeAbove
        ? rect.top + window.scrollY - 52
        : rect.bottom + window.scrollY + 10;
      const left = Math.max(120, Math.min(window.innerWidth - 120, rect.left + rect.width / 2 + window.scrollX));

      setSelectedText(text);
      setPosition({ top, left, placeAbove });
    } catch {
      setSelectedText("");
      setPosition(null);
    }
  }, [containerRef]);

  useEffect(() => {
    const onMouseUp = () => {
      setTimeout(handleSelectionChange, 10);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedText("");
        setPosition(null);
        return;
      }
      setTimeout(handleSelectionChange, 10);
    };

    const onMouseDown = (e: MouseEvent) => {
      if (toolbarRef.current && toolbarRef.current.contains(e.target as Node)) {
        return;
      }
    };

    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("keyup", onKeyUp);
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("selectionchange", handleSelectionChange);

    return () => {
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, [handleSelectionChange]);

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selectedText) return;

    navigator.clipboard.writeText(selectedText);
    setCopied(true);
    toastSuccess("Copied selection to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAction = (mode: "quote" | "explain" | "summarize", e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selectedText) return;

    window.dispatchEvent(
      new CustomEvent("jobraker:add-to-chat", {
        detail: { text: selectedText, mode },
      })
    );

    const modeLabels: Record<string, string> = {
      quote: "Added quote to AI Chat!",
      explain: "Prompt set to explain selection!",
      summarize: "Prompt set to summarize selection!",
    };
    toastSuccess(modeLabels[mode] || "Added to AI Chat!");

    // Clear selection
    window.getSelection()?.removeAllRanges();
    setSelectedText("");
    setPosition(null);
  };

  if (!selectedText || !position) return null;

  return (
    <AnimatePresence>
      <motion.div
        ref={toolbarRef}
        initial={{ opacity: 0, scale: 0.9, y: position.placeAbove ? 6 : -6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: position.placeAbove ? 6 : -6 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        style={{
          position: "absolute",
          top: `${position.top}px`,
          left: `${position.left}px`,
          transform: "translateX(-50%)",
          zIndex: 9999,
        }}
        className="flex items-center gap-1.5 p-1.5 rounded-full bg-black/95 backdrop-blur-2xl border border-zinc-800/90 shadow-2xl shadow-black text-xs font-medium text-zinc-100 select-none ring-1 ring-white/10"
      >
        {/* Add to Chat Button */}
        <button
          onClick={(e) => handleAction("quote", e)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition-all shadow-md shadow-cyan-600/20 active:scale-95 cursor-pointer"
          title="Add quoted text into AI Chat prompt"
        >
          <MessageSquarePlus className="w-3.5 h-3.5" />
          <span>Add to Chat</span>
        </button>

        <div className="h-4 w-px bg-zinc-800 my-auto" />

        {/* Explain Button */}
        <button
          onClick={(e) => handleAction("explain", e)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-full hover:bg-zinc-900 text-zinc-200 hover:text-white transition-all active:scale-95 cursor-pointer"
          title="Ask AI to explain this highlighted text"
        >
          <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline">Explain</span>
        </button>

        {/* Summarize Button */}
        <button
          onClick={(e) => handleAction("summarize", e)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-full hover:bg-zinc-900 text-zinc-200 hover:text-white transition-all active:scale-95 cursor-pointer"
          title="Ask AI to summarize this highlighted text"
        >
          <FileText className="w-3.5 h-3.5 text-indigo-400" />
          <span className="hidden sm:inline">Summarize</span>
        </button>

        <div className="h-4 w-px bg-zinc-800 my-auto" />

        {/* Copy Button */}
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-full hover:bg-zinc-900 text-zinc-200 hover:text-white transition-all active:scale-95 cursor-pointer"
          title="Copy selected text to clipboard"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Copy className="w-3.5 h-3.5 text-zinc-400" />
          )}
          <span>{copied ? "Copied!" : "Copy"}</span>
        </button>
      </motion.div>
    </AnimatePresence>
  );
};

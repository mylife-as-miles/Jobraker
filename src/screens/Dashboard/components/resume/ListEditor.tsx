import React, { useState } from "react";
import { useArtboardStore } from "../../../../store/artboard";
import { X, Plus } from "lucide-react";
import { Input } from "../../../../components/ui/input";
import { Button } from "../../../../components/ui/button";
import { cn } from "../../../../lib/utils";

interface ListEditorProps {
  sectionId: string;
}

export const ListEditor = ({ sectionId }: ListEditorProps) => {
  const section = useArtboardStore(
    (state) => state.resume.data.sections[sectionId],
  );
  const addSectionItem = useArtboardStore((state) => state.addSectionItem);
  const removeSectionItem = useArtboardStore(
    (state) => state.removeSectionItem,
  );
  const [newItemName, setNewItemName] = useState("");

  if (!section) return null;

  const handleAddItem = () => {
    if (!newItemName.trim()) return;

    const newItem = {
      id: crypto.randomUUID(),
      hidden: false,
      name: newItemName.trim(),
      level: 3, // Default
    };
    addSectionItem(sectionId, newItem);
    setNewItemName("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddItem();
    }
  };

  return (
    <div className='space-y-4 animate-in slide-in-from-top-2 duration-200'>
      <div className='flex flex-wrap gap-2'>
        {section.items.map((item) => (
          <div
            key={item.id}
            className='product-section-card-muted group flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-foreground transition-all hover:border-[#ffd700]/60 hover:bg-[#fff2b3]'
          >
            <span>{item.name}</span>
            <button
              onClick={() => removeSectionItem(sectionId, item.id)}
              className='p-0.5 rounded-full hover:bg-red-500/20 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all'
            >
              <X className='w-3 h-3' />
            </button>
          </div>
        ))}
      </div>

      <div className='flex gap-2'>
        <Input
          value={newItemName}
          onChange={(e) => setNewItemName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Add ${section.title.toLowerCase()}...`}
          className='flex-1'
        />
        <Button
          onClick={handleAddItem}
          disabled={!newItemName.trim()}
          className='bg-[#1dff00] text-black hover:bg-[#15bd00]'
        >
          <Plus className='w-4 h-4' />
        </Button>
      </div>
    </div>
  );
};


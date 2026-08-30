import { useState } from "react";
import { useArtboardStore } from "../../../../store/artboard";
import { X, Plus, ChevronDown } from "lucide-react";
import { Input } from "../../../../components/ui/input";
import { Button } from "../../../../components/ui/button";

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
  const updateSectionItem = useArtboardStore(
    (state) => state.updateSectionItem,
  );
  const [newItemName, setNewItemName] = useState("");
  const [newItemLevel, setNewItemLevel] = useState(0);

  if (!section) return null;

  const handleAddItem = () => {
    if (!newItemName.trim()) return;

    const newItem = {
      id: crypto.randomUUID(),
      hidden: false,
      name: newItemName.trim(),
      level: newItemLevel, // User-set or 0 by default
    };
    addSectionItem(sectionId, newItem);
    setNewItemName("");
    setNewItemLevel(0);
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
            className='product-section-card-muted group flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-foreground transition-all hover:border-brand/60 hover:bg-brand/15'
          >
            <span>{item.name}</span>
            <div className='relative flex items-center'>
              <select
                className='appearance-none bg-transparent pl-1 pr-4 py-0.5 text-xs text-muted-foreground outline-none cursor-pointer hover:text-foreground'
                value={item.level || 0}
                onChange={(e) => updateSectionItem(sectionId, item.id, { level: Number(e.target.value) })}
                title="Skill Level"
              >
                <option value={0}>No Rating</option>
                <option value={1}>1 - Beginner</option>
                <option value={2}>2 - Intermediate</option>
                <option value={3}>3 - Good</option>
                <option value={4}>4 - Advanced</option>
                <option value={5}>5 - Expert</option>
              </select>
              <ChevronDown className='absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none' />
            </div>
            <button
              onClick={() => removeSectionItem(sectionId, item.id)}
              className='p-0.5 rounded-full hover:bg-brand/20 hover:text-brand opacity-0 group-hover:opacity-100 transition-all ml-1'
            >
              <X className='w-3 h-3' />
            </button>
          </div>
        ))}
      </div>

      <div className='flex flex-col gap-2 sm:flex-row'>
        <Input
          value={newItemName}
          onChange={(e) => setNewItemName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Add ${section.title.toLowerCase()}...`}
          className='flex-1'
        />
        <div className='relative flex items-center'>
          <select
            value={newItemLevel}
            onChange={(e) => setNewItemLevel(Number(e.target.value))}
            className='flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none pr-8'
          >
            <option value={0}>No Rating</option>
            <option value={1}>1 - Beginner</option>
            <option value={2}>2 - Intermediate</option>
            <option value={3}>3 - Good</option>
            <option value={4}>4 - Advanced</option>
            <option value={5}>5 - Expert</option>
          </select>
          <ChevronDown className='absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none' />
        </div>
        <Button
          onClick={handleAddItem}
          disabled={!newItemName.trim()}
          className='bg-brand text-black hover:bg-brand sm:w-auto'
        >
          <Plus className='w-4 h-4' />
        </Button>
      </div>
    </div>
  );
};

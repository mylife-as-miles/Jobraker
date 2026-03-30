import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../../../../components/ui/dialog";
import { useArtboardStore } from "../../../../store/artboard";
import {
  Briefcase,
  GraduationCap,
  BrainCircuit,
  FolderGit2,
  Languages,
  Heart,
  Trophy,
  Scroll,
  BookOpen,
  HandHeart,
  Users,
  LayoutTemplate,
  Plus,
} from "lucide-react";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { cn } from "../../../../lib/utils";

interface AddSectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STANDARD_SECTIONS = [
  {
    id: "experience",
    label: "Experience",
    icon: Briefcase,
    desc: "Work history and roles",
  },
  {
    id: "education",
    label: "Education",
    icon: GraduationCap,
    desc: "Degrees and schools",
  },
  {
    id: "skills",
    label: "Skills",
    icon: BrainCircuit,
    desc: "Technical and soft skills",
  },
  {
    id: "projects",
    label: "Projects",
    icon: FolderGit2,
    desc: "Showcase your work",
  },
  {
    id: "languages",
    label: "Languages",
    icon: Languages,
    desc: "Languages you speak",
  },
  {
    id: "interests",
    label: "Interests",
    icon: Heart,
    desc: "Hobbies and passions",
  },
  {
    id: "awards",
    label: "Awards",
    icon: Trophy,
    desc: "Achievements and recognition",
  },
  {
    id: "certifications",
    label: "Certifications",
    icon: Scroll,
    desc: "Professional certifications",
  },
  {
    id: "publications",
    label: "Publications",
    icon: BookOpen,
    desc: "Articles and papers",
  },
  {
    id: "volunteer",
    label: "Volunteering",
    icon: HandHeart,
    desc: "Community service",
  },
  {
    id: "references",
    label: "References",
    icon: Users,
    desc: "Professional references",
  },
];

export const AddSectionDialog = ({
  open,
  onOpenChange,
}: AddSectionDialogProps) => {
  const [customName, setCustomName] = useState("");
  const sections = useArtboardStore((state) => state.resume.data.sections);
  const toggleSectionVisibility = useArtboardStore(
    (state) => state.toggleSectionVisibility,
  );
  const addSection = useArtboardStore((state) => state.addSection);

  const handleAddStandard = (id: string) => {
    // If it's hidden, just toggle it
    if (sections[id] && sections[id].hidden) {
      toggleSectionVisibility(id);
    } else if (!sections[id]) {
      // Should not happen for standard sections if store is initialized correctly,
      // but if so, we'd need to add it.
      // For now assume standard sections exist in the store map.
      console.warn(`Section ${id} not found in store`);
    }
    onOpenChange(false);
  };

  const handleAddCustom = () => {
    if (!customName.trim()) return;
    const id = `custom-${Date.now()}`;
    addSection({
      id,
      title: customName,
      columns: 1,
      hidden: false,
      items: [],
      type: "custom",
    });
    setCustomName("");
    onOpenChange(false);
  };

  // Filter out visible sections
  const availableSections = STANDARD_SECTIONS.filter(
    (s) => sections[s.id]?.hidden,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='product-section-card sm:max-w-[600px] text-foreground'>
        <DialogHeader>
          <DialogTitle>Add Section</DialogTitle>
          <DialogDescription>
            Choose a section to add to your resume.
          </DialogDescription>
        </DialogHeader>

        <div className='grid grid-cols-1 gap-3 py-4 sm:grid-cols-2'>
          {availableSections.map((section) => (
            <button
              key={section.id}
              onClick={() => handleAddStandard(section.id)}
              className='product-section-card-muted group flex flex-col items-start p-4 text-left transition-all hover:border-[#ffd700]/60 hover:bg-[#fff2b3]'
            >
              <div className='flex items-center gap-2 mb-2'>
                <section.icon className='product-helper-text h-4 w-4 transition-colors group-hover:text-[#ffd700]' />
                <span className='font-semibold text-sm'>{section.label}</span>
              </div>
              <p className='product-helper-text text-xs'>
                {section.desc}
              </p>
            </button>
          ))}
        </div>

        <div className='mt-2 border-t border-border/40 pt-4'>
          <h4 className='text-sm font-medium mb-3'>Custom Section</h4>
          <div className='flex flex-col gap-2 sm:flex-row'>
            <Input
              placeholder='e.g. Speaking Engagements'
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              className='flex-1'
            />
            <Button
              onClick={handleAddCustom}
              disabled={!customName.trim()}
              className='bg-[#1dff00] text-black hover:bg-[#15bd00]'
            >
              <Plus className='w-4 h-4 mr-2' />
              Add
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

import React, { useState } from "react";
import {
  Dialog,
  DialogClose,
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
  const addSection = useArtboardStore((state) => state.addSection);

  const handleAddStandard = (id: string) => {
    if (sections[id] && sections[id].hidden) {
      addSection({
        ...sections[id],
        hidden: false,
      });
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
      <DialogContent className='product-section-card flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-1.5rem)] max-w-[600px] flex-col overflow-hidden p-0 text-foreground sm:w-full'>
        <DialogHeader className='shrink-0 border-b border-border/40 px-5 py-4'>
          <DialogTitle>Add Section</DialogTitle>
          <DialogDescription>
            Choose a section to add to your resume.
          </DialogDescription>
        </DialogHeader>

        <div className='flex-1 overflow-y-auto px-5 py-4'>
          <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
            {availableSections.map((section) => (
              <button
                key={section.id}
                onClick={() => handleAddStandard(section.id)}
                className='product-section-card-muted group flex flex-col items-start p-4 text-left transition-all hover:border-brand/60 hover:bg-brand/15'
              >
                <div className='mb-2 flex items-center gap-2'>
                  <section.icon className='product-helper-text h-4 w-4 transition-colors group-hover:text-brand' />
                  <span className='text-sm font-semibold'>{section.label}</span>
                </div>
                <p className='product-helper-text text-xs'>{section.desc}</p>
              </button>
            ))}
          </div>

          <div className='mt-4 border-t border-border/40 pt-4'>
            <h4 className='mb-3 text-sm font-medium'>Custom Section</h4>
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
                className='bg-brand text-black hover:bg-brand'
              >
                <Plus className='mr-2 h-4 w-4' />
                Add
              </Button>
            </div>
          </div>
        </div>

        <div className='shrink-0 border-t border-border/40 px-5 py-4'>
          <DialogClose asChild>
            <Button variant='outline' className='w-full sm:w-auto'>
              Cancel
            </Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
};

import React, { useState } from "react";
import { useArtboardStore } from "../../../../store/artboard";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  GripVertical,
} from "lucide-react";
import { cn } from "../../../../lib/utils";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Textarea } from "../../../../components/ui/textarea"; // Assuming textarea exists

interface SectionEditorProps {
  sectionId: string;
  title?: string;
}

export const SectionEditor = ({ sectionId, title }: SectionEditorProps) => {
  const section = useArtboardStore(
    (state) => state.resume.data.sections[sectionId],
  );
  const addSectionItem = useArtboardStore((state) => state.addSectionItem);
  const updateSectionItem = useArtboardStore(
    (state) => state.updateSectionItem,
  );
  const removeSectionItem = useArtboardStore(
    (state) => state.removeSectionItem,
  );
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  if (!section) return null;

  const handleAddItem = () => {
    const newItem = {
      id: crypto.randomUUID(),
      hidden: false,
      title: "",
      company: "",
      date: "",
      location: "",
      description: "",
      website: { url: "", label: "" },
    };
    addSectionItem(sectionId, newItem);
    setExpandedItem(newItem.id);
  };

  return (
    <div className='space-y-4 animate-in slide-in-from-top-2 duration-200'>
      {section.items.map((item) => (
        <div
          key={item.id}
          className='bg-gray-100 dark:bg-muted/50 rounded-lg border border-gray-200 dark:border-foreground/5 overflow-hidden transition-all hover:border-[#1dff00]/30'
        >
          <div
            className='p-3 flex items-center gap-3 cursor-pointer bg-foreground/50 dark:bg-muted/50 hover:bg-gray-50 dark:hover:bg-muted'
            onClick={() =>
              setExpandedItem(expandedItem === item.id ? null : item.id)
            }
          >
            <div className='flex-1 min-w-0'>
              <h5 className='text-sm font-medium text-gray-900 dark:text-foreground truncate'>
                {item.title || item.name || item.degree || "(Untitled)"}
              </h5>
              <p className='text-xs text-gray-500 dark:text-gray-400 truncate'>
                {item.company ||
                  item.school ||
                  item.institution ||
                  item.issuer ||
                  ""}
              </p>
            </div>
            <div className='flex items-center gap-1'>
              <Button
                variant='ghost'
                size='icon'
                className='h-7 w-7 text-gray-400 hover:text-red-500 hover:bg-red-500/10'
                onClick={(e) => {
                  e.stopPropagation();
                  removeSectionItem(sectionId, item.id);
                }}
              >
                <Trash2 className='w-3.5 h-3.5' />
              </Button>
              {expandedItem === item.id ? (
                <ChevronUp className='w-4 h-4 text-gray-400' />
              ) : (
                <ChevronDown className='w-4 h-4 text-gray-400' />
              )}
            </div>
          </div>

          {expandedItem === item.id && (
            <div className='p-4 space-y-3 bg-white dark:bg-background border-t border-gray-200 dark:border-foreground/5'>
              <div className='grid grid-cols-2 gap-3'>
                <div className='col-span-2'>
                  <label className='text-xs font-medium text-gray-500 mb-1 block'>
                    {sectionId === "education"
                      ? "School / University"
                      : sectionId === "awards"
                        ? "Award Name"
                        : sectionId === "certifications"
                          ? "Certification Name"
                          : sectionId === "publications"
                            ? "Publication Title"
                            : sectionId === "references"
                              ? "Referee Name"
                              : sectionId === "projects"
                                ? "Project Name"
                                : "Title / Role"}
                  </label>
                  <Input
                    value={item.title || item.degree || item.name || ""}
                    onChange={(e) =>
                      updateSectionItem(sectionId, item.id, {
                        title: e.target.value,
                        degree: e.target.value,
                        name: e.target.value,
                      })
                    }
                  />
                </div>

                <div className='col-span-2 sm:col-span-1'>
                  <label className='text-xs font-medium text-gray-500 mb-1 block'>
                    {sectionId === "education"
                      ? "Degree"
                      : sectionId === "awards"
                        ? "Issuer"
                        : sectionId === "certifications"
                          ? "Issuing Organization"
                          : sectionId === "publications"
                            ? "Publisher"
                            : sectionId === "references"
                              ? "Company / Relation"
                              : sectionId === "projects"
                                ? "Project Link"
                                : "Company / Organization"}
                  </label>
                  <Input
                    value={
                      item.company ||
                      item.school ||
                      item.institution ||
                      item.issuer ||
                      ""
                    }
                    onChange={(e) =>
                      updateSectionItem(sectionId, item.id, {
                        company: e.target.value,
                        school: e.target.value,
                        institution: e.target.value,
                        issuer: e.target.value,
                      })
                    }
                  />
                </div>

                <div className='col-span-2 sm:col-span-1'>
                  <label className='text-xs font-medium text-gray-500 mb-1 block'>
                    {sectionId === "awards"
                      ? "Date"
                      : sectionId === "projects"
                        ? "Date"
                        : "Date / Period"}
                  </label>
                  <Input
                    value={item.date || item.period || ""}
                    onChange={(e) =>
                      updateSectionItem(sectionId, item.id, {
                        date: e.target.value,
                        period: e.target.value,
                      })
                    }
                    placeholder='e.g. 2020 - Present'
                  />
                </div>

                {sectionId === "references" && (
                  <div className='col-span-2 sm:col-span-1'>
                    <label className='text-xs font-medium text-gray-500 mb-1 block'>
                      Referee Contact (Email / Phone)
                    </label>
                    <Input
                      value={item.phone || ""}
                      onChange={(e) =>
                        updateSectionItem(sectionId, item.id, {
                          phone: e.target.value,
                        })
                      }
                      placeholder='e.g. john@example.com / +1 234 567 890'
                    />
                  </div>
                )}

                <div className='col-span-2'>
                  <label className='text-xs font-medium text-gray-500 mb-1 block'>
                    Description
                  </label>
                  <Textarea
                    value={item.description || ""}
                    onChange={(e) =>
                      updateSectionItem(sectionId, item.id, {
                        description: e.target.value,
                      })
                    }
                    placeholder='Description...'
                    rows={3}
                    className='text-xs bg-transparent border-foreground/10'
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      ))}

      <Button
        variant='outline'
        className='w-full border-dashed border-gray-300 dark:border-foreground/20 hover:border-[#1dff00] hover:text-[#1dff00]'
        onClick={handleAddItem}
      >
        <Plus className='w-4 h-4 mr-2' />
        Add Item
      </Button>
    </div>
  );
};

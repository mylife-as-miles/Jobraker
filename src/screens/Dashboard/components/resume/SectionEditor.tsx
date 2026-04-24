import React, { useState } from "react";
import { useArtboardStore } from "../../../../store/artboard";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
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
          className='product-section-card-muted overflow-hidden rounded-lg transition-all hover:border-brand/60'
        >
          <div
            className='product-section-card flex cursor-pointer items-center gap-3 p-3 hover:bg-brand/15'
            onClick={() =>
              setExpandedItem(expandedItem === item.id ? null : item.id)
            }
          >
            <div className='flex-1 min-w-0'>
              <h5 className='product-page-title truncate text-sm font-medium'>
                {item.title || item.name || item.degree || "(Untitled)"}
              </h5>
              <p className='product-helper-text truncate text-xs'>
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
                className='product-helper-text h-7 w-7 hover:bg-brand/10 hover:text-brand'
                onClick={(e) => {
                  e.stopPropagation();
                  removeSectionItem(sectionId, item.id);
                }}
              >
                <Trash2 className='w-3.5 h-3.5' />
              </Button>
              {expandedItem === item.id ? (
                <ChevronUp className='product-helper-text h-4 w-4' />
              ) : (
                <ChevronDown className='product-helper-text h-4 w-4' />
              )}
            </div>
          </div>

          {expandedItem === item.id && (
            <div className='border-t border-border/40 bg-background p-4 space-y-3'>
              <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                <div className='sm:col-span-2'>
                  <label className='product-helper-text mb-1 block text-xs font-medium'>
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

                <div>
                  <label className='product-helper-text mb-1 block text-xs font-medium'>
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

                <div>
                  <label className='product-helper-text mb-1 block text-xs font-medium'>
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
                  <div>
                    <label className='product-helper-text mb-1 block text-xs font-medium'>
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

                <div className='sm:col-span-2'>
                  <label className='product-helper-text mb-1 block text-xs font-medium'>
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
                    className='product-input-surface border-border/40 bg-transparent text-xs'
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      ))}

      <Button
        variant='outline'
        className='product-outline-button w-full border-dashed hover:border-brand hover:text-brand'
        onClick={handleAddItem}
      >
        <Plus className='w-4 h-4 mr-2' />
        Add Item
      </Button>
    </div>
  );
};

import { useState, useCallback } from "react";
import { useArtboardStore } from "../../../../store/artboard";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Textarea } from "../../../../components/ui/textarea"; // Assuming textarea exists

interface SectionEditorProps {
  sectionId: string;
  title?: string;
}

export const SectionEditor = ({ sectionId }: SectionEditorProps) => {
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

          <div
            className={`spring-grid-expandable overflow-hidden border-t border-border/40 transition-all ${
              expandedItem === item.id ? "expanded" : ""
            }`}
            style={{
              display: "grid",
              gridTemplateRows: expandedItem === item.id ? "1fr" : "0fr",
              transition: "grid-template-rows 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
            }}
          >
            <div
              className='spring-grid-inner min-h-0 overflow-hidden'
              style={{
                opacity: expandedItem === item.id ? 1 : 0,
                transition: "opacity 0.35s ease 0.15s",
              }}
            >
              <div className='bg-background p-4 space-y-3'>
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
                              : sectionId === "projects"
                                ? "Project Title"
                                : "Title / Degree"}
                    </label>
                    <input
                      type='text'
                      className='product-input-surface rounded-xl px-3 py-2 text-sm w-full border border-border/40 bg-transparent'
                      value={
                        item.title ||
                        item.name ||
                        item.degree ||
                        item.school ||
                        ""
                      }
                      onChange={(e) =>
                        updateSectionItem(sectionId, item.id, {
                          [sectionId === "education"
                            ? "school"
                            : sectionId === "awards" || sectionId === "projects"
                              ? "name"
                              : "title"]: e.target.value,
                        })
                      }
                    />
                  </div>

                  {sectionId === "experience" && (
                    <>
                      <div>
                        <label className='product-helper-text mb-1 block text-xs font-medium'>
                          Company
                        </label>
                        <input
                          type='text'
                          className='product-input-surface rounded-xl px-3 py-2 text-sm w-full border border-border/40 bg-transparent'
                          value={item.company || ""}
                          onChange={(e) =>
                            updateSectionItem(sectionId, item.id, {
                              company: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className='product-helper-text mb-1 block text-xs font-medium'>
                          Location
                        </label>
                        <input
                          type='text'
                          className='product-input-surface rounded-xl px-3 py-2 text-sm w-full border border-border/40 bg-transparent'
                          value={item.location || ""}
                          onChange={(e) =>
                            updateSectionItem(sectionId, item.id, {
                              location: e.target.value,
                            })
                          }
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <label className='product-helper-text mb-1 block text-xs font-medium'>
                      Start Date
                    </label>
                    <input
                      type='text'
                      placeholder='MM/YYYY'
                      maxLength={7}
                      className='product-input-surface rounded-xl px-3 py-2 text-sm w-full border border-border/40 bg-transparent'
                      value={item.startDate || ""}
                      onChange={(e) => {
                        let v = e.target.value.replace(/[^0-9\/]/g, "");
                        // Auto-insert slash after 2-digit month
                        if (v.length === 2 && !v.includes("/") && (item.startDate || "").length < 2) {
                          v = v + "/";
                        }
                        updateSectionItem(sectionId, item.id, { startDate: v });
                      }}
                    />
                  </div>
                  <div>
                    <label className='product-helper-text mb-1 block text-xs font-medium'>
                      End Date
                    </label>
                    <input
                      type='text'
                      placeholder='MM/YYYY or Present'
                      maxLength={7}
                      className='product-input-surface rounded-xl px-3 py-2 text-sm w-full border border-border/40 bg-transparent'
                      value={item.endDate || ""}
                      onChange={(e) => {
                        const raw = e.target.value;
                        // Allow "Present" to be typed freely
                        if (/^[Pp]/i.test(raw)) {
                          const capped = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
                          updateSectionItem(sectionId, item.id, { endDate: capped.slice(0, 7) });
                          return;
                        }
                        let v = raw.replace(/[^0-9\/]/g, "");
                        if (v.length === 2 && !v.includes("/") && (item.endDate || "").length < 2) {
                          v = v + "/";
                        }
                        updateSectionItem(sectionId, item.id, { endDate: v });
                      }}
                    />
                  </div>

                  <div className='sm:col-span-2'>
                    <label className='product-helper-text mb-1 block text-xs font-medium'>
                      Description / Highlights
                    </label>
                    <textarea
                      rows={3}
                      className='product-input-surface rounded-xl px-3 py-2 text-sm w-full border border-border/40 bg-transparent'
                      value={
                        item.description ||
                        (item.highlights ? item.highlights.join("\n") : "")
                      }
                      onChange={(e) =>
                        updateSectionItem(sectionId, item.id, {
                          description: e.target.value,
                          highlights: e.target.value
                            .split("\n")
                            .filter(Boolean),
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
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

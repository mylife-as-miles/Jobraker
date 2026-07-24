import { useState } from "react";
import { X, Check, Edit3, LayoutTemplate, Search } from "lucide-react";
import { useArtboardStore, ArtboardStore } from "../../../store/artboard";
import { cn } from "../../../lib/utils";
import { TemplatePreview } from "./TemplatePreview";
import { TemplateDetailPreview } from "./TemplateDetailPreview";

// Each entry needs a matching component in render-resume-template.tsx.
const availableTemplates: Array<{
  id: string;
  name: string;
  description: string;
  category: string;
}> = [
  {
    id: "linton",
    name: "Linton",
    description: "Editorial cream layout with charcoal quote panel.",
    category: "Creative",
  },
  {
    id: "kumar",
    name: "Kumar",
    description: "Dark bento grid of rounded cards and chip badges.",
    category: "Tech",
  },
  {
    id: "micah",
    name: "Micah",
    description: "Charcoal & gold with white cards and skill bars.",
    category: "Creative",
  },
  {
    id: "smith",
    name: "Smith",
    description: "Coral two-column with dark sidebar and timelines.",
    category: "Professional",
  },
  {
    id: "clarke",
    name: "Clarke",
    description: "Lime bento cards with a bold name and pill skills.",
    category: "Creative",
  },
  {
    id: "mercado",
    name: "Mercado",
    description: "Playful pink Memphis card with colorful pill sections.",
    category: "Creative",
  },
  {
    id: "anderson",
    name: "Anderson",
    description: "Retro pixel-desktop CV with mint OS-window panels.",
    category: "Tech",
  },
  {
    id: "rosca",
    name: "Rosca",
    description: "Bold editorial fashion CV with folder-tab dark cards.",
    category: "Creative",
  },
  {
    id: "laurent",
    name: "Laurent",
    description: "Editorial layout with a giant rotated vertical name.",
    category: "Creative",
  },
  {
    id: "dian",
    name: "Dian",
    description: "Neo-brutalist CV with thick strokes and accent blocks.",
    category: "Creative",
  },
];

interface TemplateGalleryProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TemplateGallery = ({ isOpen, onClose }: TemplateGalleryProps) => {
  const currentTemplate = useArtboardStore(
    (state: ArtboardStore) => state.resume.data.metadata.template,
  );
  const setResumeData = useArtboardStore(
    (state: ArtboardStore) => state.setResumeData,
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [detailId, setDetailId] = useState<string | null>(null);

  if (!isOpen) return null;

  if (detailId) {
    return (
      <TemplateDetailPreview
        templateId={detailId}
        onClose={onClose}
        onBack={() => setDetailId(null)}
      />
    );
  }

  const handleConfirm = () => {
    setResumeData({
      metadata: {
        ...useArtboardStore.getState().resume.data.metadata,
        template: detailId || currentTemplate,
      },
    });
    onClose();
  };

  const filteredTemplates = availableTemplates.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filter === "All" || t.category === filter;
    return matchesSearch && matchesFilter;
  });

  const activeTemplateInfo = availableTemplates.find(
    (t) => t.id === currentTemplate,
  );

  return (
    <div className='fixed inset-0 z-[100] bg-[#102213] flex flex-col overflow-hidden animate-in fade-in duration-300'>
      {/* Main Header / Top Bar */}
      <div className='h-16 border-b border-[#28392b] bg-foreground/50 backdrop-blur-sm flex items-center justify-between px-8 shrink-0'>
        <div className='flex items-center gap-2 text-sm'>
          <span className='text-[#9cbaa1]'>Templates</span>
          <span className='text-[#5c6e60]'>/</span>
          <span className='text-foreground font-medium'>Gallery</span>
        </div>

        <div className='flex items-center gap-4'>
          <div className='relative hidden sm:block'>
            <Search className='absolute left-3 top-1/2 -translate-y-1/2 text-[#9cbaa1] w-4 h-4' />
            <input
              type='text'
              placeholder='Search templates...'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className='bg-background border border-[#28392b] text-foreground text-sm rounded-lg pl-10 pr-4 py-2 w-64 focus:ring-1 focus:ring-brand focus:border-brand outline-none placeholder-[#5c6e60]'
            />
          </div>
          <button
            onClick={onClose}
            className='p-2 hover:bg-border rounded-full text-[#9cbaa1] hover:text-foreground transition-colors'
          >
            <X className='w-6 h-6' />
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className='flex-1 overflow-y-auto px-8 md:px-12 py-10 custom-scrollbar'>
        <div className='max-w-7xl mx-auto'>
          {/* Hero Section of Modal */}
          <div className='flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6'>
            <div>
              <h1 className='text-4xl font-bold text-foreground mb-3'>
                Select a Template
              </h1>
              <p className='text-[#9cbaa1] text-lg max-w-2xl'>
                Choose from our selection of performance-optimized, ATS-friendly
                designs.
              </p>
            </div>
            <div className='flex flex-wrap gap-2'>
              {["All", "Professional", "Creative", "Simple", "Tech"].map(
                (cat) => (
                  <button
                    key={cat}
                    onClick={() => setFilter(cat)}
                    className={cn(
                      "px-4 py-1.5 rounded-full text-xs font-bold transition-all border",
                      filter === cat
                        ? "bg-brand/10 text-brand border-brand/30 shadow-[0_0_15px_rgba(22,163,74,0.1)]"
                        : "bg-background text-[#9cbaa1] border-[#28392b] hover:border-[#5c6e60]",
                    )}
                  >
                    {cat}
                  </button>
                ),
              )}
            </div>
          </div>

          {/* Template Grid */}
          {filteredTemplates.length === 0 && (
            <div className='flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[#28392b] bg-background/40 py-24 text-center'>
              <LayoutTemplate className='w-10 h-10 text-[#5c6e60]' />
              <h3 className='text-xl font-bold text-foreground'>
                No templates available yet
              </h3>
              <p className='text-[#9cbaa1] max-w-md'>
                A new batch of resume templates is on the way. Check back soon.
              </p>
            </div>
          )}
          <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10 pb-32'>
            {filteredTemplates.map((template) => (
              <div
                key={template.id}
                onClick={() => setDetailId(template.id)}
                className='group cursor-pointer'
              >
                <div
                  className={cn(
                    "relative bg-white aspect-[1/1.414] rounded-xl overflow-hidden border transition-all duration-300 transform group-hover:scale-[1.02]",
                    currentTemplate === template.id
                      ? "border-brand border-4 shadow-[0_0_30px_rgba(22,163,74,0.2)]"
                      : "border-[#28392b] hover:border-brand/50",
                  )}
                >
                  {/* Preview Content */}
                  <div className='w-full h-full pointer-events-none origin-top transition-transform duration-500'>
                    <TemplatePreview templateId={template.id} />
                  </div>

                  {/* Selected Indicator */}
                  {currentTemplate === template.id && (
                    <div className='absolute top-4 right-4 z-20 bg-brand text-black rounded-full p-1.5 shadow-lg border-2 border-[#102213]'>
                      <Check className='w-5 h-5 font-bold' />
                    </div>
                  )}

                  {/* Hover Overlay */}
                  <div
                    className={cn(
                      "absolute inset-0 bg-transparent group-hover:bg-foreground/5 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100",
                      currentTemplate === template.id &&
                        "bg-foreground/5 group-hover:bg-foreground/10",
                    )}
                  >
                    <div className='bg-white text-black font-bold py-2.5 px-8 rounded-full shadow-2xl transform translate-y-4 group-hover:translate-y-0 transition-transform'>
                      {currentTemplate === template.id ? "Active" : "Select"}
                    </div>
                  </div>
                </div>

                {/* Label Info */}
                <div className='mt-5 flex justify-between items-start'>
                  <div>
                    <h3
                      className={cn(
                        "font-bold text-xl transition-colors",
                        currentTemplate === template.id
                          ? "text-brand"
                          : "text-foreground",
                      )}
                    >
                      {template.name}
                      {currentTemplate === template.id && (
                        <span className='ml-2 text-[10px] bg-brand/20 text-brand px-2 py-0.5 rounded border border-brand/20 uppercase tracking-wider vertical-middle'>
                          Selected
                        </span>
                      )}
                    </h3>
                    <p className='text-[#9cbaa1] text-sm mt-1'>
                      {template.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sticky Bottom Action Bar */}
      <div className='fixed bottom-0 right-0 left-0 bg-foreground/95 backdrop-blur-md border-t border-[#28392b] p-5 z-[110]'>
        <div className='max-w-7xl mx-auto flex justify-between items-center'>
          <div className='hidden md:block'>
            <p className='text-foreground font-medium text-base'>
              Selection:{" "}
              <span className='text-brand'>
                {activeTemplateInfo?.name || "None"}
              </span>
            </p>
            <p className='text-[#9cbaa1] text-xs mt-0.5 flex items-center gap-1.5'>
              <LayoutTemplate className='w-3 h-3' /> A4 Format â€¢ ATS-Ready â€¢
              High Performance
            </p>
          </div>
          <div className='flex gap-4 ml-auto'>
            <button
              onClick={onClose}
              className='px-6 py-3 rounded-lg text-foreground font-bold hover:bg-border transition-all text-sm border border-[#28392b]'
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className='px-10 py-3 bg-brand hover:bg-[#18d600] text-black rounded-lg font-black text-sm transition-all shadow-[0_0_20px_rgba(22,163,74,0.3)] flex items-center gap-2 active:scale-95'
            >
              <Edit3 className='w-4 h-4' />
              Use This Template
            </button>
          </div>
        </div>
      </div>

      <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 8px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: #102213;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #28392b;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #3a4f3e;
                }
                @keyframes fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .animate-in {
                    animation: fade-in 0.3s ease-out forwards;
                }
            `}</style>
    </div>
  );
};

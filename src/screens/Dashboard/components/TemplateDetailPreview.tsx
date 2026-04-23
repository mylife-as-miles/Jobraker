import { useState, useMemo } from "react";
import {
  X,
  ChevronLeft,
  ZoomIn,
  ZoomOut,
  Maximize,
  Check,
  LayoutTemplate,
  Edit3,
  Download,
  Palette,
  Type as TypeIcon,
} from "lucide-react";
import { useArtboardStore, ArtboardStore } from "../../../store/artboard";
import { cn } from "../../../lib/utils";
import { TemplatePreview } from "./TemplatePreview";

interface TemplateDetailPreviewProps {
  templateId: string;
  onClose: () => void;
  onBack: () => void;
}

const themeColors = [
  { name: "Green", value: "#0df233" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Purple", value: "#a855f7" },
  { name: "Signal", value: "#1dff00" },
  { name: "Teal", value: "#2dd4bf" },
  { name: "Neon", value: "#1dff00" },
];

const typographyOptions = [
  { name: "Inter", family: "Inter, sans-serif" },
  { name: "Serif", family: "Georgia, serif" },
];

export const TemplateDetailPreview = ({
  templateId,
  onClose,
  onBack,
}: TemplateDetailPreviewProps) => {
  const storeMetadata = useArtboardStore(
    (state: ArtboardStore) => state.resume.data.metadata,
  );
  const setResumeData = useArtboardStore(
    (state: ArtboardStore) => state.setResumeData,
  );

  // Local state for live preview overrides
  const [primaryColor, setPrimaryColor] = useState(
    storeMetadata.theme?.primary || "#0df233",
  );
  const [fontFamily, setFontFamily] = useState(
    storeMetadata.typography.font.family || "Inter, sans-serif",
  );
  const [zoom, setZoom] = useState(1);

  const metadataOverride = useMemo(
    () => ({
      ...storeMetadata,
      theme: {
        ...storeMetadata.theme,
        primary: primaryColor,
      },
      typography: {
        ...storeMetadata.typography,
        font: {
          ...storeMetadata.typography.font,
          family: fontFamily,
        },
      },
    }),
    [storeMetadata, primaryColor, fontFamily],
  );

  const handleConfirm = () => {
    setResumeData({
      metadata: metadataOverride,
    });
    onClose();
  };

  const templateInfo = {
    azurill: {
      name: "Azurill",
      description:
        "A professional, structured template ideal for designers and developers. Features a timeline layout and clean typography.",
    },
    bronzor: {
      name: "Bronzor",
      description:
        "Structured grid layout, highly organized and space-efficient for technical profiles.",
    },
    chikorita: {
      name: "Chikorita",
      description:
        "Modern sidebar layout with vibrant accents, perfect for creative professionals.",
    },
    onyx: {
      name: "Onyx",
      description:
        "Classic single-column professional layout with a focus on core experiences.",
    },
    ditgar: {
      name: "Ditgar",
      description:
        "Bold purple-accented layout with a prominent sidebar for skills and contact info.",
    },
    ditto: {
      name: "Ditto",
      description:
        "Playful split-header layout with a floating portrait and balanced sidebar.",
    },
    gengar: {
      name: "Gengar",
      description:
        "Sleek, dark modern sidebar with purple highlights and geometric sections.",
    },
    glalie: {
      name: "Glalie",
      description:
        "Cool blue-accented layout with a polished boxed contact panel.",
    },
    kakuna: {
      name: "Kakuna",
      description:
        "Centered minimalist layout with strong symmetry and subtle portrait framing.",
    },
    eevee: {
      name: "Eevee",
      description:
        "Soft boxed header with editorial portrait framing and elegant spacing.",
    },
    lapras: {
      name: "Lapras",
      description:
        "Clean card-based layout with rounded corners and a very modern feel.",
    },
    pikachu: {
      name: "Pikachu",
      description:
        "Vibrant bold header with a modern look that stands out instantly.",
    },
    rhyhorn: {
      name: "Rhyhorn",
      description:
        "Sturdy professional layout with a right-aligned photo for a balanced look.",
    },
  }[templateId] || {
    name: "Template",
    description: "A professional resume template.",
  };

  return (
    <div className='fixed inset-0 z-[120] bg-[#102213] flex animate-in fade-in duration-300'>
      {/* Sidebar customization panel */}
      <aside className='w-80 border-r border-[#28392b] bg-foreground flex flex-col shrink-0'>
        <div className='p-6 border-b border-[#28392b]'>
          <button
            onClick={onBack}
            className='flex items-center gap-2 text-[#9cbaa1] text-xs hover:text-foreground transition-colors mb-6'
          >
            <ChevronLeft className='w-3 h-3' />
            Templates / {templateInfo.name}
          </button>
          <h1 className='text-2xl font-bold text-foreground mb-2'>
            {templateInfo.name}
          </h1>
          <p className='text-[#9cbaa1] text-sm leading-relaxed'>
            {templateInfo.description}
          </p>
        </div>

        <div className='p-6 flex flex-col gap-8 overflow-y-auto custom-scrollbar flex-1'>
          {/* Color selection */}
          <div>
            <div className='flex items-center gap-2 mb-4'>
              <Palette className='w-4 h-4 text-brand' />
              <h3 className='text-foreground text-xs font-semibold uppercase tracking-wider'>
                Theme Colors
              </h3>
            </div>
            <div className='flex flex-wrap gap-3'>
              {themeColors.map((color) => (
                <button
                  key={color.value}
                  onClick={() => setPrimaryColor(color.value)}
                  className={cn(
                    "w-8 h-8 rounded-full transition-all border-2",
                    primaryColor === color.value
                      ? "border-white ring-2 ring-white/20 ring-offset-2 ring-offset-[#111812] scale-110"
                      : "border-transparent hover:scale-105",
                  )}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          {/* Typography selection */}
          <div>
            <div className='flex items-center gap-2 mb-4'>
              <TypeIcon className='w-4 h-4 text-brand' />
              <h3 className='text-foreground text-xs font-semibold uppercase tracking-wider'>
                Typography
              </h3>
            </div>
            <div className='grid grid-cols-2 gap-3'>
              {typographyOptions.map((font) => (
                <button
                  key={font.name}
                  onClick={() => setFontFamily(font.family)}
                  className={cn(
                    "h-10 rounded border text-sm font-medium transition-all flex items-center justify-center",
                    fontFamily === font.family
                      ? "bg-border border-brand text-foreground shadow-[0_0_10px_rgba(29,255,0,0.1)]"
                      : "bg-background border-transparent text-[#9cbaa1] hover:border-[#28392b] hover:text-foreground",
                  )}
                >
                  {font.name}
                </button>
              ))}
            </div>
          </div>

          {/* Bottom actions */}
          <div className='mt-auto pt-6 border-t border-[#28392b] space-y-3'>
            <button
              onClick={handleConfirm}
              className='w-full flex items-center justify-center gap-2 h-12 bg-brand hover:bg-[#18d600] text-[#111812] rounded-lg font-bold text-base transition-all shadow-[0_0_20px_rgba(29,255,0,0.2)] active:scale-95'
            >
              <Edit3 className='w-5 h-5' />
              Use This Template
            </button>
            <button className='w-full flex items-center justify-center gap-2 h-12 bg-border hover:bg-[#344a38] text-foreground rounded-lg font-semibold text-base transition-colors opacity-50 cursor-not-allowed'>
              <Download className='w-5 h-5' />
              Download PDF
            </button>
          </div>
        </div>
      </aside>

      {/* Preview Canvas Area */}
      <div className='flex-1 flex flex-col relative overflow-hidden bg-background'>
        {/* Toolbar */}
        <div className='h-14 border-b border-[#28392b] bg-foreground/50 backdrop-blur-sm flex items-center justify-between px-6 shrink-0'>
          <div className='flex items-center gap-4'>
            <button
              onClick={() => setZoom((prev) => Math.min(prev + 0.1, 2))}
              className='p-1.5 hover:bg-border rounded-lg text-[#9cbaa1] hover:text-foreground transition-colors'
            >
              <ZoomIn className='w-5 h-5' />
            </button>
            <span className='text-sm font-bold text-brand min-w-[3rem] text-center'>
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((prev) => Math.max(prev - 0.1, 0.5))}
              className='p-1.5 hover:bg-border rounded-lg text-[#9cbaa1] hover:text-foreground transition-colors'
            >
              <ZoomOut className='w-5 h-5' />
            </button>
            <div className='h-6 w-px bg-border' />
            <button
              onClick={() => setZoom(1)}
              className='p-1.5 hover:bg-border rounded-lg text-[#9cbaa1] hover:text-foreground transition-colors'
              title='Reset Zoom'
            >
              <Maximize className='w-5 h-5' />
            </button>
          </div>

          <div className='flex items-center gap-3'>
            <span className='text-xs font-semibold text-[#5c6e60] uppercase tracking-widest hidden sm:block'>
              A4 Format â€¢ 100% ATS-Ready
            </span>
            <button
              onClick={onClose}
              className='p-1.5 hover:bg-brand/20 hover:text-brand rounded-lg text-[#9cbaa1] transition-colors'
            >
              <X className='w-6 h-6' />
            </button>
          </div>
        </div>

        {/* Scrollable Preview Container */}
        <div className='flex-1 overflow-auto preview-scroll flex justify-center items-start p-12 bg-grid-pattern'>
          <div
            className='bg-white shadow-2xl transition-all duration-300 transform-gpu bg-white'
            style={{
              width: "794px",
              height: "1123px",
              transform: `scale(${zoom})`,
              transformOrigin: "top center",
            }}
          >
            <TemplatePreview
              templateId={templateId}
              metadataOverride={metadataOverride}
            />
          </div>
        </div>
      </div>

      <style>{`
                .preview-scroll::-webkit-scrollbar {
                    width: 10px;
                    height: 10px;
                }
                .preview-scroll::-webkit-scrollbar-track {
                    background: #0A0A0A;
                }
                .preview-scroll::-webkit-scrollbar-thumb {
                    background: #28392b;
                    border-radius: 5px;
                    border: 2px solid #0A0A0A;
                }
                .preview-scroll::-webkit-scrollbar-thumb:hover {
                    background: #1dff00;
                }
                .bg-grid-pattern {
                    background-image: radial-gradient(circle, #28392b 1px, transparent 1px);
                    background-size: 30px 30px;
                }
            `}</style>
    </div>
  );
};

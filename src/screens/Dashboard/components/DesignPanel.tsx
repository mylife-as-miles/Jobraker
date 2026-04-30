import React, { useState } from "react";
import { Type, Palette, FileText, Layout, ChevronDown } from "lucide-react";
import { useArtboardStore } from "../../../store/artboard";
import { Slider } from "../../../components/ui/slider";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import { Input } from "../../../components/ui/input";

type Tab = "typography" | "design" | "page" | "layout";

export const DesignPanel = () => {
  const [activeTab, setActiveTab] = useState<Tab>("typography");

  const metadata = useArtboardStore((state) => state.resume.data.metadata);
  const updateTypography = useArtboardStore((state) => state.updateTypography);
  const updateTheme = useArtboardStore((state) => state.updateTheme);
  const updatePage = useArtboardStore((state) => state.updatePage);
  const updateLayout = useArtboardStore((state) => state.updateLayout);

  const typography = metadata.typography.font;
  const theme = metadata.theme || {
    primary: "#000000",
    text: "#000000",
    background: "#ffffff",
  };
  const page = metadata.page;
  const layout = metadata.layout;

  const fontFamilies = [
    "IBM Plex Serif",
    "Roboto",
    "Open Sans",
    "Lato",
    "Montserrat",
    "Raleway",
    "Merriweather",
    "Playfair Display",
  ];

  return (
    <div className='w-full h-full bg-gray-50 dark:bg-background border-r border-gray-200 dark:border-foreground/10 flex flex-col'>
      {/* Tabs Header */}
      <div className='flex items-center justify-between p-2 border-b border-gray-200 dark:border-foreground/10 overflow-x-auto no-scrollbar'>
        <TabButton
          isActive={activeTab === "typography"}
          onClick={() => setActiveTab("typography")}
          icon={<Type className='w-4 h-4' />}
          label='Typography'
        />
        <TabButton
          isActive={activeTab === "design"}
          onClick={() => setActiveTab("design")}
          icon={<Palette className='w-4 h-4' />}
          label='Design'
        />
        <TabButton
          isActive={activeTab === "page"}
          onClick={() => setActiveTab("page")}
          icon={<FileText className='w-4 h-4' />}
          label='Page'
        />
        <TabButton
          isActive={activeTab === "layout"}
          onClick={() => setActiveTab("layout")}
          icon={<Layout className='w-4 h-4' />}
          label='Layout'
        />
      </div>

      {/* Content Area */}
      <div className='flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar'>
        {/* Typography Settings */}
        {activeTab === "typography" && (
          <div className='space-y-6 animate-in fade-in duration-300'>
            <div className='space-y-3'>
              <label className='text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400'>
                Font Family
              </label>
              <Select
                value={typography.family}
                onValueChange={(value) => updateTypography({ family: value })}
              >
                <SelectTrigger className='w-full bg-white dark:bg-muted/50 border-gray-200 dark:border-foreground/10 text-gray-900 dark:text-foreground'>
                  <SelectValue placeholder='Select a font' />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Serif</SelectLabel>
                    {fontFamilies
                      .filter((f) =>
                        [
                          "IBM Plex Serif",
                          "Merriweather",
                          "Playfair Display",
                        ].includes(f),
                      )
                      .map((font) => (
                        <SelectItem
                          key={font}
                          value={font}
                          style={{ fontFamily: font }}
                        >
                          {font}
                        </SelectItem>
                      ))}
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>Sans Serif</SelectLabel>
                    {fontFamilies
                      .filter(
                        (f) =>
                          ![
                            "IBM Plex Serif",
                            "Merriweather",
                            "Playfair Display",
                          ].includes(f),
                      )
                      .map((font) => (
                        <SelectItem
                          key={font}
                          value={font}
                          style={{ fontFamily: font }}
                        >
                          {font}
                        </SelectItem>
                      ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-4'>
              <div className='flex items-center justify-between'>
                <label className='text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400'>
                  Font Size
                </label>
                <span className='text-xs font-mono text-gray-400'>
                  {typography.size}px
                </span>
              </div>
              <Slider
                min={8}
                max={24}
                step={0.5}
                value={[typography.size]}
                onValueChange={(vals) => updateTypography({ size: vals[0] })}
              />
            </div>

            <div className='space-y-4'>
              <div className='flex items-center justify-between'>
                <label className='text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400'>
                  Line Height
                </label>
                <span className='text-xs font-mono text-gray-400'>
                  {typography.lineHeight || 1.5}
                </span>
              </div>
              <Slider
                min={1}
                max={2.5}
                step={0.1}
                value={[typography.lineHeight || 1.5]}
                onValueChange={(vals) =>
                  updateTypography({ lineHeight: vals[0] })
                }
              />
            </div>

            <div className='space-y-4'>
              <div className='flex items-center justify-between'>
                <label className='text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400'>
                  Paragraph Spacing
                </label>
                <span className='text-xs font-mono text-gray-400'>
                  {typography.paragraphSpacing ?? 8}px
                </span>
              </div>
              <Slider
                min={0}
                max={24}
                step={1}
                value={[typography.paragraphSpacing ?? 8]}
                onValueChange={(vals) =>
                  updateTypography({ paragraphSpacing: vals[0] })
                }
              />
            </div>
          </div>
        )}

        {/* Design Settings */}
        {activeTab === "design" && (
          <div className='space-y-6 animate-in fade-in duration-300'>
            <ColorPicker
              label='Primary Color'
              value={theme.primary}
              onChange={(val) => updateTheme({ primary: val })}
            />
            <ColorPicker
              label='Text Color'
              value={theme.text}
              onChange={(val) => updateTheme({ text: val })}
            />
            <ColorPicker
              label='Background Color'
              value={theme.background}
              onChange={(val) => updateTheme({ background: val })}
            />
          </div>
        )}

        {/* Page Settings */}
        {activeTab === "page" && (
          <div className='space-y-6 animate-in fade-in duration-300'>
            <div className='space-y-3'>
              <label className='text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400'>
                Format
              </label>
              <Select
                value={page.format}
                onValueChange={(value: "a4" | "letter") =>
                  updatePage({ format: value })
                }
              >
                <SelectTrigger className='w-full bg-white dark:bg-muted/50 border-gray-200 dark:border-foreground/10 text-gray-900 dark:text-foreground'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='a4'>A4 (210mm x 297mm)</SelectItem>
                  <SelectItem value='letter'>Letter (8.5in x 11in)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-4'>
              <div className='flex items-center justify-between'>
                <label className='text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400'>
                  Margins
                </label>
                <span className='text-xs font-mono text-gray-400'>
                  {page.margin}mm
                </span>
              </div>
              <Slider
                min={0}
                max={50}
                step={1}
                value={[page.margin]}
                onValueChange={(vals) => updatePage({ margin: vals[0] })}
              />
            </div>
          </div>
        )}

        {/* Layout Settings */}
        {activeTab === "layout" && (
          <div className='space-y-6 animate-in fade-in duration-300'>
            <div className='space-y-4'>
              <div className='flex items-center justify-between'>
                <label className='text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400'>
                  Sidebar Width
                </label>
                <span className='text-xs font-mono text-gray-400'>
                  {layout.sidebarWidth}%
                </span>
              </div>
              <Slider
                min={20}
                max={45}
                step={1}
                value={[layout.sidebarWidth]}
                onValueChange={(vals) =>
                  updateLayout({ sidebarWidth: vals[0] })
                }
              />
              <p className='text-[10px] text-gray-400'>
                Adjusts the width of the sidebar column relative to the page
                width.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const TabButton = ({
  isActive,
  onClick,
  icon,
  label,
}: {
  isActive: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) => (
  <button
    onClick={onClick}
    className={`
            flex flex-col items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all min-w-[70px]
            ${
              isActive
                ? "bg-white dark:bg-muted text-brand shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-foreground hover:bg-gray-100 dark:hover:bg-muted/50"
            }
        `}
  >
    {icon}
    <span>{label}</span>
  </button>
);

const ColorPicker = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
}) => (
  <div className='space-y-3'>
    <label className='text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400'>
      {label}
    </label>
    <div className='flex items-center gap-3'>
      <div className='relative w-10 h-10 rounded-lg overflow-hidden border border-gray-200 dark:border-foreground/10 shadow-sm shrink-0'>
        <input
          type='color'
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className='absolute -top-1/2 -left-1/2 w-[200%] h-[200%] p-0 m-0 cursor-pointer border-none outline-none'
        />
      </div>
      <div className='flex-1'>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          variant='outlined'
          inputSize='sm'
          className='font-mono text-xs h-10'
        />
      </div>
    </div>
  </div>
);

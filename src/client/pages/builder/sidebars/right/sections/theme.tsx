import { t } from "@lingui/macro";
import { Input, Label, Popover, PopoverContent, PopoverTrigger } from "@reactive-resume/ui";
import { cn } from "@reactive-resume/utils";
import { useEffect } from "react";
import { HexColorPicker } from "react-colorful";

import { colors } from "@/client/constants/colors";
import { useResumeStore } from "@/client/stores/resume";

import { SectionIcon } from "../shared/section-icon";

const hexToHsl = (hex: string): { h: number; s: number; l: number } | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;

  let r = parseInt(result[1], 16);
  let g = parseInt(result[2], 16);
  let b = parseInt(result[3], 16);

  (r /= 255), (g /= 255), (b /= 255);

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  let l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
};

export const ThemeSection = () => {
  const setValue = useResumeStore((state) => state.setValue);
  const theme = useResumeStore((state) => state.resume?.data?.metadata?.theme);

  useEffect(() => {
    if (theme?.primary) {
      const hsl = hexToHsl(theme.primary);
      if (hsl) {
        document.documentElement.style.setProperty("--color-brand-h", `${hsl.h}`);
        document.documentElement.style.setProperty("--color-brand-s", `${hsl.s}%`);
        document.documentElement.style.setProperty("--color-brand-l", `${hsl.l}%`);
      }
    }
  }, [theme?.primary]);

  return (
    <section id="theme" className="grid gap-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-x-4">
          <SectionIcon id="theme" size={18} name={t`Theme`} />
          <h2 className="line-clamp-1 text-2xl font-bold lg:text-3xl">{t`Theme`}</h2>
        </div>
      </header>

      <main className="grid gap-y-6">
        <div className="mb-2 grid grid-cols-6 gap-x-2 gap-y-4 @xs/right:grid-cols-9">
          {colors.map((color) => (
            <div
              key={color}
              className={cn(
                "flex size-6 cursor-pointer items-center justify-center rounded-full transition-shadow",
                theme?.primary === color
                  ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                  : "ring-0 hover:ring-2 hover:ring-muted-foreground/30",
              )}
              onClick={() => {
                setValue("metadata.theme.primary", color);
              }}
            >
              <div className="size-5 rounded-full" style={{ backgroundColor: color }} />
            </div>
          ))}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="theme.primary">{t`Primary Color`}</Label>
          <div className="relative">
            <Popover>
              <PopoverTrigger asChild>
                <div
                  className="absolute inset-y-0 left-3 my-2.5 size-4 cursor-pointer rounded-full ring-primary ring-offset-2 ring-offset-background transition-shadow hover:ring-1"
                  style={{ backgroundColor: theme?.primary || "#000000" }}
                />
              </PopoverTrigger>
              <PopoverContent className="rounded-lg border-none bg-transparent p-0">
                <HexColorPicker
                  color={theme?.primary || "#000000"}
                  onChange={(color) => {
                    setValue("metadata.theme.primary", color);
                  }}
                />
              </PopoverContent>
            </Popover>
            <Input
              id="theme.primary"
              value={theme?.primary || "#000000"}
              className="pl-10"
              onChange={(event) => {
                setValue("metadata.theme.primary", event.target.value);
              }}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="theme.primary">{t`Background Color`}</Label>
          <div className="relative">
            <Popover>
              <PopoverTrigger asChild>
                <div
                  className="absolute inset-y-0 left-3 my-2.5 size-4 cursor-pointer rounded-full ring-primary ring-offset-2 ring-offset-background transition-shadow hover:ring-1"
                  style={{ backgroundColor: theme?.background || "#ffffff" }}
                />
              </PopoverTrigger>
              <PopoverContent className="rounded-lg border-none bg-transparent p-0">
                <HexColorPicker
                  color={theme?.background || "#ffffff"}
                  onChange={(color) => {
                    setValue("metadata.theme.background", color);
                  }}
                />
              </PopoverContent>
            </Popover>
            <Input
              id="theme.background"
              value={theme?.background || "#ffffff"}
              className="pl-10"
              onChange={(event) => {
                setValue("metadata.theme.background", event.target.value);
              }}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="theme.primary">{t`Text Color`}</Label>
          <div className="relative">
            <Popover>
              <PopoverTrigger asChild>
                <div
                  className="absolute inset-y-0 left-3 my-2.5 size-4 cursor-pointer rounded-full ring-primary ring-offset-2 ring-offset-background transition-shadow hover:ring-1"
                  style={{ backgroundColor: theme?.text || "#000000" }}
                />
              </PopoverTrigger>
              <PopoverContent className="rounded-lg border-none bg-transparent p-0">
                <HexColorPicker
                  color={theme?.text || "#000000"}
                  onChange={(color) => {
                    setValue("metadata.theme.text", color);
                  }}
                />
              </PopoverContent>
            </Popover>
            <Input
              id="theme.text"
              value={theme?.text || "#000000"}
              className="pl-10"
              onChange={(event) => {
                setValue("metadata.theme.text", event.target.value);
              }}
            />
          </div>
        </div>
      </main>
    </section>
  );
};

import { t } from "@lingui/macro";
import { motion } from "framer-motion";
import { Button, Separator, Tooltip } from "@reactive-resume/ui";
import { templatesList, cn } from "@reactive-resume/utils";
import { useResumeStore } from "@/client/stores/resume";
import { useBuilderStore } from "@/client/stores/builder";
import { colors } from "@/client/constants/colors";

type KickstartPanelProps = {
  onClose: () => void;
};

export const KickstartPanel = ({ onClose }: KickstartPanelProps) => {
  const setValue = useResumeStore((s) => s.setValue);
  const currentTemplate = useResumeStore((s) => s.resume.data.metadata.template);
  const theme = useResumeStore((s) => s.resume.data.metadata.theme);
  const openRight = useBuilderStore((s) => s.sheet.right.setOpen);

  const goTo = (selector: string) => {
    document.querySelector(selector)?.scrollIntoView({ behavior: "smooth", block: "start" });
    onClose();
  };

  const openRightAndScroll = (selector: string) => {
    // Ensure right sheet is open on mobile
    openRight(true);
    setTimeout(() => {
      document.querySelector(selector)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
    onClose();
  };

  const presets: { name: string; primary: string; background: string; text: string }[] = [
    { name: "Classic", primary: "#2563eb", background: "#ffffff", text: "#0f172a" },
    { name: "Modern Dark", primary: "#1dff00", background: "#0b0b0b", text: "#e5e7eb" },
    { name: "Elegant", primary: "#7c3aed", background: "#ffffff", text: "#111827" },
    { name: "Serene", primary: "#0d9488", background: "#f8fafc", text: "#0f172a" },
  ];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-5xl overflow-hidden rounded-2xl border border-[#1dff00]/20 bg-gradient-to-b from-[#0b0b0b] via-[#0a0a0a] to-[#0b0b0b] shadow-2xl shadow-black/40"
      >
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <h3 className="text-xl font-semibold text-white">{t`Kickstart your resume`}</h3>
            <p className="text-xs text-muted-foreground">
              {t`Choose a template, pick a color, and jump right into the most important sections.`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Tooltip content={t`Hide this onboarding`}> 
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setValue("metadata.ui.kickstartDismissed", true);
                  onClose();
                }}
              >
                {t`Don't show again`}
              </Button>
            </Tooltip>
            <Button size="sm" variant="secondary" onClick={onClose}>
              {t`Start building`}
            </Button>
          </div>
        </div>

        <Separator className="opacity-10" />

        <div className="grid gap-8 p-6 md:grid-cols-2">
          {/* Templates */}
          <div>
            <p className="mb-3 text-sm font-semibold text-white">{t`Pick a template`}</p>
            <div className="grid grid-cols-3 gap-3">
              {templatesList.slice(0, 6).map((tpl: any) => {
                const slug: string | undefined = typeof tpl === "string" ? tpl : (typeof tpl?.id === 'string' ? tpl.id : (typeof tpl?.name === 'string' ? tpl.name : undefined));
                if (!slug) return null; // skip objects without string id/name
                const label: string = slug;
                const isActive = currentTemplate === slug;
                return (
                  <button
                    key={slug}
                    className={cn(
                      "group relative overflow-hidden rounded-md ring-1 ring-white/10 transition focus:outline-none focus:ring-2 focus:ring-primary",
                      isActive && "ring-2 ring-primary"
                    )}
                    onClick={() => {
                      setValue("metadata.template", slug);
                      // Subtle guidance: open right sidebar to Template section
                      openRightAndScroll("#template");
                    }}
                  >
                    <img
                      src={`/templates/jpg/${slug}.jpg`}
                      alt={label}
                      className="aspect-[1/1.4142] w-full object-cover opacity-95 transition group-hover:opacity-100"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-1.5">
                      <p className="truncate text-center text-[11px] font-medium capitalize text-white/90">
                        {label}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Colors */}
          <div>
            <p className="mb-3 text-sm font-semibold text-white">{t`Choose a highlight color`}</p>
            <div className="grid grid-cols-10 gap-2">
              {colors.map((color) => (
                <div
                  key={color}
                  className={cn(
                    "flex size-7 cursor-pointer items-center justify-center rounded-full transition-shadow",
                    theme.primary === color
                      ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                      : "ring-0 hover:ring-2 hover:ring-muted-foreground/30",
                  )}
                  onClick={() => setValue("metadata.theme.primary", color)}
                >
                  <div className="size-6 rounded-full" style={{ backgroundColor: color }} />
                </div>
              ))}
            </div>

            {/* Presets */}
            <p className="mt-5 mb-2 text-xs font-medium text-white/80">{t`Or choose a preset`}</p>
            <div className="grid grid-cols-2 gap-3">
              {presets.map((p) => (
                <button
                  key={p.name}
                  className="group flex items-center gap-3 rounded-md border border-white/10 p-2 text-left transition hover:border-primary/50"
                  onClick={() => {
                    setValue("metadata.theme.primary", p.primary);
                    setValue("metadata.theme.background", p.background);
                    setValue("metadata.theme.text", p.text);
                    // Guide: open theme settings for further tweak
                    openRightAndScroll("#theme");
                  }}
                >
                  <div className="relative h-9 w-14 overflow-hidden rounded">
                    <div className="absolute inset-0" style={{ background: p.background }} />
                    <div className="absolute inset-0" style={{ color: p.text }} />
                    <div className="absolute right-1 top-1 size-3 rounded-full" style={{ background: p.primary }} />
                    <div className="absolute bottom-1 left-1 h-1.5 w-10 rounded" style={{ background: p.text, opacity: 0.6 }} />
                  </div>
                  <div>
                    <p className="text-[12px] font-medium text-white">{p.name}</p>
                    <p className="text-[10px] text-white/60">
                      <span style={{ color: p.primary }} className="font-semibold">●</span> {t`Primary`}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Quick actions */}
          <div className="md:col-span-2">
            <p className="mb-3 text-sm font-semibold text-white">{t`Quick start`}</p>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
              <Button variant="outline" className="justify-center" onClick={() => goTo("#summary")}>
                {t`Write Summary`}
              </Button>
              <Button variant="outline" className="justify-center" onClick={() => goTo("#experience")}>
                {t`Add Experience`}
              </Button>
              <Button variant="outline" className="justify-center" onClick={() => goTo("#skills")}>
                {t`Add Skills`}
              </Button>
              <Button variant="outline" className="justify-center" onClick={() => openRightAndScroll("#template")}>
                {t`Template Settings`}
              </Button>
              <Button variant="outline" className="justify-center" onClick={() => openRightAndScroll("#theme")}>
                {t`Theme Settings`}
              </Button>
              <Button
                variant="outline"
                className="justify-center"
                onClick={() => {
                  window.location.href = "/dashboard/resumes/import";
                }}
              >
                {t`Import Resume`}
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

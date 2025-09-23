import { t } from "@lingui/macro";
import { motion } from "framer-motion";
import { Button, Separator, Tooltip } from "@reactive-resume/ui";
import { templatesList, cn } from "@reactive-resume/utils";
import { useResumeStore } from "@/client/stores/resume";
import { colors } from "@/client/constants/colors";

type KickstartPanelProps = {
  onClose: () => void;
};

export const KickstartPanel = ({ onClose }: KickstartPanelProps) => {
  const setValue = useResumeStore((s) => s.setValue);
  const currentTemplate = useResumeStore((s) => s.resume.data.metadata.template);
  const theme = useResumeStore((s) => s.resume.data.metadata.theme);

  const goTo = (selector: string) => {
    document.querySelector(selector)?.scrollIntoView({ behavior: "smooth", block: "start" });
    onClose();
  };

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
                const slug: string = typeof tpl === "string" ? tpl : tpl.id ?? tpl.name;
                const label: string = typeof tpl === "string" ? tpl : tpl.name ?? tpl.id;
                const isActive = currentTemplate === slug || currentTemplate === label;
                return (
                  <button
                    key={slug}
                    className={cn(
                      "group relative overflow-hidden rounded-md ring-1 ring-white/10 transition focus:outline-none focus:ring-2 focus:ring-primary",
                      isActive && "ring-2 ring-primary"
                    )}
                    onClick={() => setValue("metadata.template", slug)}
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
          </div>

          {/* Quick actions */}
          <div className="md:col-span-2">
            <p className="mb-3 text-sm font-semibold text-white">{t`Quick start`}</p>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Button variant="outline" className="justify-center" onClick={() => goTo("#summary")}>
                {t`Write Summary`}
              </Button>
              <Button variant="outline" className="justify-center" onClick={() => goTo("#experience")}>
                {t`Add Experience`}
              </Button>
              <Button variant="outline" className="justify-center" onClick={() => goTo("#skills")}>
                {t`Add Skills`}
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

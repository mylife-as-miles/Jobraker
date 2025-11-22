import { t } from "@lingui/macro";
import { AspectRatio } from "@reactive-resume/ui";
import { cn, templatesList } from "@reactive-resume/utils";
import { motion } from "framer-motion";

import { useResumeStore } from "@/client/stores/resume";

import { SectionIcon } from "../shared/section-icon";

export const TemplateSection = () => {
  const setValue = useResumeStore((state) => state.setValue);
  const currentTemplate = useResumeStore((state) => state.resume?.data?.metadata?.template || "pikachu");

  return (
    <section id="template" className="grid gap-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-x-4">
          <SectionIcon id="template" size={18} name={t`Template`} />
          <h2 className="line-clamp-1 text-2xl font-bold lg:text-3xl">{t`Template`}</h2>
        </div>
      </header>

      <main className="grid grid-cols-2 gap-8 @lg/right:grid-cols-3 @2xl/right:grid-cols-4">
        {templatesList.map((template, index) => {
          const templateId = typeof template === 'string' ? template : (template.id || 'pikachu');
          const templateName = typeof template === 'string' ? template : (template.name || 'Pikachu');
          return (
          <AspectRatio key={templateId} ratio={1 / 1.4142}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { delay: index * 0.1 } }}
              whileTap={{ scale: 0.98, transition: { duration: 0.1 } }}
              className={cn(
                "relative cursor-pointer rounded-sm ring-primary transition-all hover:ring-2",
                currentTemplate === templateId && "ring-2",
              )}
              onClick={() => {
                setValue("metadata.template", templateId);
              }}
            >
              <img 
                src={`/templates/jpg/${encodeURIComponent((templateId || 'pikachu').trim() || 'pikachu')}.jpg`} 
                alt={templateName} 
                className="rounded-sm"
                onError={(e) => {
                  const img = e.currentTarget as HTMLImageElement;
                  if (!img.dataset.fallbackUsed) {
                    img.dataset.fallbackUsed = 'true';
                    img.src = "/templates/jpg/pikachu.jpg";
                  } else {
                    img.style.display = 'none';
                  }
                }}
              />

              <div className="absolute inset-x-0 bottom-0 h-32 w-full bg-gradient-to-b from-transparent to-background/80">
                <p className="absolute inset-x-0 bottom-2 text-center font-bold capitalize text-primary">
                  {templateName}
                </p>
              </div>
            </motion.div>
          </AspectRatio>
          );
        })}
      </main>
    </section>
  );
};

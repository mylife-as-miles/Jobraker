import { Check, X } from "lucide-react";
import { ArtboardStore, useArtboardStore } from "../../../store/artboard";
import { TemplatePreview } from "./TemplatePreview";

// Each entry needs a matching component in render-resume-template.tsx.
const availableTemplates: Array<{
  id: string;
  name: string;
  description: string;
}> = [
  {
    id: "linton",
    name: "Linton",
    description:
      "An editorial cream layout with a charcoal quote panel, dot-rated skills, and a bold display name.",
  },
  {
    id: "kumar",
    name: "Kumar",
    description:
      "A dark bento-grid layout with rounded cards, chip badges, and side-by-side experience panels.",
  },
  {
    id: "micah",
    name: "Micah",
    description:
      "A charcoal layout with gold accents, a stacked name, arch photo, white experience/achievement cards, and skill bars.",
  },
  {
    id: "smith",
    name: "Smith",
    description:
      "A coral-accented two-column layout with a dark sidebar (photo, skill and language bars, contact, reference) and timeline sections.",
  },
  {
    id: "clarke",
    name: "Clarke",
    description:
      "A light bento layout with black-outlined cards, a bold name, a lime-framed photo, lime profile and reference cards, and pill skills.",
  },
];

interface TemplateSelectorProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TemplateSelector = ({
  isOpen,
  onClose,
}: TemplateSelectorProps) => {
  const currentTemplate = useArtboardStore(
    (state: ArtboardStore) => state.resume.data.metadata.template,
  );
  const setResumeData = useArtboardStore(
    (state: ArtboardStore) => state.setResumeData,
  );

  const handleSelect = (templateId: string) => {
    setResumeData({
      metadata: {
        ...useArtboardStore.getState().resume.data.metadata,
        template: templateId,
      },
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200'>
      <div className='flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl animate-in zoom-in-95 duration-200 dark:border-white/10 dark:bg-[#121212]'>
        <div className='flex items-center justify-between border-b border-gray-200 p-6 dark:border-white/10'>
          <div>
            <h2 className='text-2xl font-bold text-gray-900 dark:text-white'>
              Choose a Template
            </h2>
            <p className='mt-1 text-gray-500 dark:text-gray-400'>
              Select a design that best fits your professional story.
            </p>
          </div>
          <button
            onClick={onClose}
            className='rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5'
          >
            <X className='h-6 w-6' />
          </button>
        </div>

        <div className='custom-scrollbar flex-1 overflow-y-auto p-6'>
          {availableTemplates.length === 0 && (
            <div className='flex flex-col items-center justify-center gap-2 py-20 text-center'>
              <h3 className='text-lg font-bold text-gray-900 dark:text-white'>
                No templates available yet
              </h3>
              <p className='max-w-md text-sm text-gray-500 dark:text-gray-400'>
                A new batch of resume templates is on the way. Check back soon.
              </p>
            </div>
          )}
          <div className='grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3'>
            {availableTemplates.map((template) => (
              <div
                key={template.id}
                onClick={() => handleSelect(template.id)}
                className={`group relative overflow-hidden rounded-xl border-2 transition-all duration-200 ${
                  currentTemplate === template.id
                    ? "border-brand bg-brand/5 ring-2 ring-brand/20"
                    : "border-gray-200 bg-white hover:border-brand/50 hover:shadow-lg dark:border-white/10 dark:bg-[#1A1A1A]"
                }`}
              >
                <div className='relative aspect-[210/297] overflow-hidden bg-gray-100 dark:bg-[#2A2A2A]'>
                  <div className='flex h-full w-full items-start justify-center bg-gray-50 dark:bg-[#1A1A1A]'>
                    <TemplatePreview templateId={template.id} />
                  </div>

                  <div className='absolute inset-0 z-10 bg-black/0 transition-colors group-hover:bg-black/10 dark:group-hover:bg-white/5' />

                  {currentTemplate === template.id && (
                    <div className='absolute right-3 top-3 z-20 flex items-center gap-1 rounded-full bg-brand px-2 py-1 text-xs font-bold text-black shadow-sm'>
                      <Check className='h-3 w-3' />
                      Selected
                    </div>
                  )}
                </div>

                <div className='border-t border-gray-100 p-4 dark:border-white/5'>
                  <h3 className='font-bold text-gray-900 dark:text-white'>
                    {template.name}
                  </h3>
                  <p className='mt-1 line-clamp-2 text-sm text-gray-500 dark:text-gray-400'>
                    {template.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

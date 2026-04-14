import { createContext, useContext, type PropsWithChildren } from "react";
import { useArtboardStore, type ResumeData } from "@/store/artboard";

interface ResumeTemplateContextValue {
  resumeDataOverride?: ResumeData;
  metadataOverride?: ResumeData["metadata"];
}

const ResumeTemplateContext = createContext<ResumeTemplateContextValue | null>(
  null,
);

interface ResumeTemplateDataProviderProps extends PropsWithChildren {
  value?: ResumeTemplateContextValue | null;
}

export function ResumeTemplateDataProvider({
  value = null,
  children,
}: ResumeTemplateDataProviderProps) {
  return (
    <ResumeTemplateContext.Provider value={value}>
      {children}
    </ResumeTemplateContext.Provider>
  );
}

export function useResumeTemplateData(): ResumeData {
  const context = useContext(ResumeTemplateContext);
  const storeResumeData = useArtboardStore((state) => state.resume.data);

  const baseResumeData = context?.resumeDataOverride ?? storeResumeData;

  if (!context?.metadataOverride) {
    return baseResumeData;
  }

  return {
    ...baseResumeData,
    metadata: context.metadataOverride,
  };
}

export function useResumeTemplateValue<T>(
  selector: (resumeData: ResumeData) => T,
): T {
  const resumeData = useResumeTemplateData();
  return selector(resumeData);
}

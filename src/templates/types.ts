import type { ResumeData } from "../store/artboard";

/**
 * Props passed to every resume template component.
 *
 * New template batches should type their component with these props.
 */
export interface TemplateProps {
  pageIndex?: number;
  pageLayout?: ResumeData["metadata"]["layout"]["pages"][0];
  metadataOverride?: ResumeData["metadata"];
}

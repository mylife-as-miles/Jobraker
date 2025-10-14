import { CoverLetter } from "./_components/cover-letter";
import { useRegisterCoachMarks } from "@/providers/TourProvider";

export const CoverLetterPage = () => {
  useRegisterCoachMarks({
    page: 'cover_letter',  // Use underscore to match database column: walkthrough_cover_letter
    marks: [
      { id: 'cover-header', selector: '#cover-header', title: 'Cover Letter Workspace', body: 'Compose, refine, and export tailored cover letters here.' },
      { id: 'cover-meta-panel', selector: '#cover-meta-panel', title: 'Context Inputs', body: 'Set role, company, tone and preferences to guide AI suggestions.' },
      { id: 'cover-editor', selector: '#cover-editor', title: 'Editable Draft', body: 'Your live letter. Edit paragraphs directly — changes auto-save.' },
      { id: 'cover-actions', selector: '#cover-actions', title: 'Actions & Export', body: 'Download, copy, adjust font size, or manage versions.' }
    ]
  });
  return <CoverLetter />;
};

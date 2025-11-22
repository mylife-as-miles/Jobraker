import { CoverLetter } from "./_components/cover-letter";
import { CoverLettersPage } from "../cover-letters/page";
import { useRegisterCoachMarks } from "@/providers/TourProvider";
import { useSearchParams } from "react-router-dom";

export const CoverLetterPage = () => {
  const [searchParams] = useSearchParams();
  const edit = searchParams.get('edit') === 'true' || searchParams.get('id');

  useRegisterCoachMarks({
    page: 'cover_letter',  // Use underscore to match database column: walkthrough_cover_letter
    marks: [
      { id: 'cover-header', selector: '#cover-header', title: 'Cover Letter Workspace', body: 'Compose, refine, and export tailored cover letters here.' },
      { id: 'cover-meta-panel', selector: '#cover-meta-panel', title: 'Context Inputs', body: 'Set role, company, tone and preferences to guide AI suggestions.' },
      { id: 'cover-editor', selector: '#cover-editor', title: 'Editable Draft', body: 'Your live letter. Edit paragraphs directly — changes auto-save.' },
      { id: 'cover-actions', selector: '#cover-actions', title: 'Actions & Export', body: 'Download, copy, adjust font size, or manage versions.' }
    ]
  });

  // If no edit mode, show the grid view
  if (!edit) {
    return <CoverLettersPage />;
  }

  return <CoverLetter />;
};

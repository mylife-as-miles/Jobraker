import { matchPath, useLocation } from 'react-router-dom';
import { ResumeBuilderPage } from './ResumeBuilderPage';
import { ResumeHomePage } from './ResumeHomePage';

export const ResumePage = () => {
    const location = useLocation();
    const editMatch = matchPath('/dashboard/resume/edit/:id', location.pathname);
    const isBuilderRoute = Boolean(
        matchPath('/dashboard/resume/edit', location.pathname) ||
        editMatch
    );

    return isBuilderRoute ? <ResumeBuilderPage resumeId={editMatch?.params.id} /> : <ResumeHomePage />;
};

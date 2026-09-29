import { matchPath, useLocation } from 'react-router-dom';
import { ApplicationProfilePage } from './ApplicationProfilePage';
import { ResumeBuilderPage } from './ResumeBuilderPage';
import { ResumeHomePage } from './ResumeHomePage';

export const ResumePage = () => {
    const location = useLocation();
    const editMatch = matchPath('/dashboard/resume/edit/:id', location.pathname);
    const isBuilderRoute = Boolean(
        matchPath('/dashboard/resume/edit', location.pathname) ||
        editMatch
    );

    if (matchPath('/dashboard/resume/profile', location.pathname)) return <ApplicationProfilePage />;
    return isBuilderRoute ? <ResumeBuilderPage resumeId={editMatch?.params.id} /> : <ResumeHomePage />;
};

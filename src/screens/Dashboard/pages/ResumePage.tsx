import { matchPath, useLocation } from 'react-router-dom';
import { ResumeBuilderPage } from './ResumeBuilderPage';
import { ResumeHomePage } from './ResumeHomePage';

export const ResumePage = () => {
    const location = useLocation();
    const isBuilderRoute = Boolean(
        matchPath('/dashboard/resume/edit', location.pathname) ||
        matchPath('/dashboard/resume/edit/:id', location.pathname)
    );

    return isBuilderRoute ? <ResumeBuilderPage /> : <ResumeHomePage />;
};

import { matchPath, useLocation } from 'react-router-dom';
import { CoverLetterHomePage } from './CoverLetterHomePage';
import { CoverLetterBuilderPage } from './CoverLetterBuilderPage';

export const CoverLetterPage = () => {
    const location = useLocation();
    const isBuilderRoute = Boolean(
        matchPath('/dashboard/cover-letter/create', location.pathname) ||
        matchPath('/dashboard/cover-letter/edit', location.pathname) ||
        matchPath('/dashboard/cover-letter/edit/:id', location.pathname)
    );

    return isBuilderRoute ? <CoverLetterBuilderPage /> : <CoverLetterHomePage />;
};

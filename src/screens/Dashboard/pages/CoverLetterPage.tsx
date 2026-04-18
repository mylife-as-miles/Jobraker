import { Suspense, lazy } from 'react';
import { matchPath, useLocation } from 'react-router-dom';
import { CoverLetterHomePage } from './CoverLetterHomePage';

const CoverLetterBuilderPage = lazy(async () => {
    const module = await import('./CoverLetterBuilderPage');
    return { default: module.CoverLetterBuilderPage };
});

export const CoverLetterPage = () => {
    const location = useLocation();
    const isBuilderRoute = Boolean(
        matchPath('/dashboard/cover-letter/create', location.pathname) ||
        matchPath('/dashboard/cover-letter/edit', location.pathname) ||
        matchPath('/dashboard/cover-letter/edit/:id', location.pathname)
    );

    if (!isBuilderRoute) {
        return <CoverLetterHomePage />;
    }

    return (
        <Suspense
            fallback={
                <div className="flex min-h-[40vh] items-center justify-center text-sm text-foreground/70">
                    Loading cover letter builder...
                </div>
            }
        >
            <CoverLetterBuilderPage />
        </Suspense>
    );
};

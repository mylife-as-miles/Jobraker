import { Routes, Route } from 'react-router-dom';
import { CoverLetterHomePage } from './CoverLetterHomePage';
import { CoverLetterBuilderPage } from './CoverLetterBuilderPage';

export const CoverLetterPage = () => {
    return (
        <Routes>
            <Route index element={<CoverLetterHomePage />} />
            <Route path="create" element={<CoverLetterBuilderPage />} />
            <Route path="edit" element={<CoverLetterBuilderPage />} />
            <Route path="edit/:id" element={<CoverLetterBuilderPage />} />
        </Routes>
    );
};

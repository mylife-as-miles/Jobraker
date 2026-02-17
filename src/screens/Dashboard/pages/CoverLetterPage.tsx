import { Routes, Route } from 'react-router-dom';
import { CoverLetterHomePage } from './CoverLetterHomePage';
import { CoverLetterBuilderPage } from './CoverLetterBuilderPage';

export const CoverLetterPage = () => {
    return (
        <Routes>
            <Route path="cover-letter" element={<CoverLetterHomePage />} />
            <Route path="cover-letter/create" element={<CoverLetterBuilderPage />} />
            <Route path="cover-letter/edit" element={<CoverLetterBuilderPage />} />
            <Route path="cover-letter/edit/:id" element={<CoverLetterBuilderPage />} />
        </Routes>
    );
};

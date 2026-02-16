import { Routes, Route } from 'react-router-dom';
import { ResumeBuilderPage } from './ResumeBuilderPage';
import { ResumeHomePage } from './ResumeHomePage';

export const ResumePage = () => {
    return (
        <Routes>
            <Route index element={<ResumeHomePage />} />
            <Route path="edit" element={<ResumeBuilderPage />} />
            <Route path="edit/:id" element={<ResumeBuilderPage />} />
        </Routes>
    );
};

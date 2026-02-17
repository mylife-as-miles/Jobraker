import { Routes, Route } from 'react-router-dom';
import { ResumeBuilderPage } from './ResumeBuilderPage';
import { ResumeHomePage } from './ResumeHomePage';

export const ResumePage = () => {
    return (
        <Routes>
            <Route path="resume" element={<ResumeHomePage />} />
            <Route path="resume/edit" element={<ResumeBuilderPage />} />
            <Route path="resume/edit/:id" element={<ResumeBuilderPage />} />
        </Routes>
    );
};

import { useLocation } from 'react-router-dom';
import { ResumeBuilderPage } from './ResumeBuilderPage';
import { ResumeHomePage } from './ResumeHomePage';

export const ResumePage = () => {
    const location = useLocation();
    const isBuilder = location.pathname.includes('/edit');

    return isBuilder ? <ResumeBuilderPage /> : <ResumeHomePage />;
};

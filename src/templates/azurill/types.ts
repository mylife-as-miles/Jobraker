import { ResumeData } from '../../store/artboard';

export interface TemplateProps {
    pageIndex?: number;
    pageLayout?: ResumeData['metadata']['layout']['pages'][0];
    metadataOverride?: ResumeData['metadata'];
}
import { FC } from 'react';
import type { ResumeData } from '../../../store/artboard';
import { ResumeTemplateRenderer } from '../../../templates/render-resume-template';

interface TemplatePreviewProps {
    templateId: string;
    metadataOverride?: ResumeData['metadata'];
}

export const TemplatePreview: FC<TemplatePreviewProps> = ({ templateId, metadataOverride }) => {
    const scale = 0.3;

    return (
        <div className="w-full h-full overflow-hidden relative bg-white isolate">
            <div
                style={{
                    width: '794px',
                    height: '1123px',
                    transform: `scale(${scale})`,
                    transformOrigin: 'top left',
                }}
                className="absolute top-0 left-0 pointer-events-none select-none shadow-sm origin-top-left"
            >
                <ResumeTemplateRenderer templateId={templateId} metadataOverride={metadataOverride} />
            </div>
        </div>
    );
};
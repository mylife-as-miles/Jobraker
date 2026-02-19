import { FC } from 'react';
import { AzurillTemplate } from '../../../templates/azurill/index';
import { OnyxTemplate } from '../../../templates/onyx';
import { BronzorTemplate } from '../../../templates/bronzor';
import { ChikoritaTemplate } from '../../../templates/chikorita';
import { DitgarTemplate } from '../../../templates/ditgar';
import { DittoTemplate } from '../../../templates/ditto';
import { GengarTemplate } from '../../../templates/gengar';
import { GlalieTemplate } from '../../../templates/glalie';
import { KakunaTemplate } from '../../../templates/kakuna';
import { PikachuTemplate } from '../../../templates/pikachu';
import { RhyhornTemplate } from '../../../templates/rhyhorn';
import { EeveeTemplate } from '../../../templates/eevee';
import { LaprasTemplate } from '../../../templates/lapras';

interface TemplatePreviewProps {
    templateId: string;
}

export const TemplatePreview: FC<TemplatePreviewProps> = ({ templateId }) => {
    // 210mm is approx 794px at 96 DPI
    // The container in TemplateSelector is defined by aspect-ratio, we need to scale this 794px content to fit.
    // We'll use a CSS transform scale.
    // Assuming the parent container's width is around 250px-300px depending on screen size.
    // We can use a container query or just a generic responsive scale.
    // A safer bet for a simple implementation is to force a scale that fits the specific grid column size.
    // But since the grid is responsive, the width varies.
    // Let's use a "container" that is 794px wide, and scale it down using style={{ zoom: ... }} or transform.
    // The best approach for "responsive preview" without complex resizing logic is to:
    // 1. Render the A4 page at full size (794px width) within a div.
    // 2. Use `transform: scale(X)` on that div, where X is `containerWidth / 794`.
    // Since we don't know containerWidth easily without a ref/resize observer, we can use a fixed scale if the grid is fixed,
    // OR we can make the preview component take 100% width and height, and use a ViewBox-like approach (SVG foreignObject) or CSS container queries.

    // SIMPLIFIED APPROACH:
    // Render at a fixed small scale (e.g. 0.3) which is roughly 240px width.
    const scale = 0.3;

    return (
        <div className="w-full h-full overflow-hidden relative bg-white isolate">
            <div
                style={{
                    width: '794px', // A4 width at 96 DPI
                    height: '1123px', // A4 height at 96 DPI
                    transform: `scale(${scale})`,
                    transformOrigin: 'top left',
                    // Center it horizontally if the container is wider than the scaled content
                }}
                className="absolute top-0 left-0 pointer-events-none select-none shadow-sm origin-top-left"
            >
                {templateId === 'azurill' && <AzurillTemplate />}
                {templateId === 'onyx' && <OnyxTemplate />}
                {templateId === 'bronzor' && <BronzorTemplate />}
                {templateId === 'chikorita' && <ChikoritaTemplate />}
                {templateId === 'ditgar' && <DitgarTemplate />}
                {templateId === 'ditto' && <DittoTemplate />}
                {templateId === 'gengar' && <GengarTemplate />}
                {templateId === 'glalie' && <GlalieTemplate />}
                {templateId === 'kakuna' && <KakunaTemplate />}
                {templateId === 'pikachu' && <PikachuTemplate />}
                {templateId === 'rhyhorn' && <RhyhornTemplate />}
                {templateId === 'eevee' && <EeveeTemplate />}
                {templateId === 'lapras' && <LaprasTemplate />}
            </div>
        </div>
    );
};

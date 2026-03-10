import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { createClient } from '../../lib/supabaseClient';
import { useArtboardStore } from '../../store/artboard';
import { AzurillTemplate } from '../../templates/azurill';
import { OnyxTemplate } from '../../templates/onyx';
import { BronzorTemplate } from '../../templates/bronzor';
import { ChikoritaTemplate } from '../../templates/chikorita';
import { DitgarTemplate } from '../../templates/ditgar';
import { DittoTemplate } from '../../templates/ditto';
import { GengarTemplate } from '../../templates/gengar';
import { GlalieTemplate } from '../../templates/glalie';
import { KakunaTemplate } from '../../templates/kakuna';
import { PikachuTemplate } from '../../templates/pikachu';
import { RhyhornTemplate } from '../../templates/rhyhorn';
import { Loader2, AlertCircle, Download } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { downloadResumePDF } from '../../utils/resume-download';

export const PublicResumePage = () => {
    const { id } = useParams();
    const supabase = createClient();
    const setResumeData = useArtboardStore((state) => state.setResumeData);
    const resumeData = useArtboardStore((state) => state.resume.data);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchResume = async () => {
            try {
                const { data, error } = await supabase
                    .from('resumes')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (error) throw error;
                if (!data.public_share_enabled) {
                    throw new Error('This resume is not public.');
                }

                setResumeData(data.data);

                // Increment views
                await supabase.rpc('increment_resume_stat', {
                    p_resume_id: id,
                    p_stat_type: 'views'
                });

            } catch (err: any) {
                console.error(err);
                setError(err.message || 'Failed to load resume');
            } finally {
                setLoading(false);
            }
        };

        if (id) fetchResume();
    }, [id, supabase, setResumeData]);

    const handleDownload = async () => {
        // Increment downloads
        await supabase.rpc('increment_resume_stat', {
            p_resume_id: id,
            p_stat_type: 'downloads'
        });

        downloadResumePDF(resumeData);
    };

    if (loading) return <div className="flex items-center justify-center h-screen bg-white dark:bg-background text-gray-900 dark:text-foreground"><Loader2 className="animate-spin w-8 h-8" /></div>;
    if (error) return <div className="flex flex-col items-center justify-center h-screen gap-4 bg-white dark:bg-background text-gray-900 dark:text-foreground"><AlertCircle className="w-10 h-10 text-red-500" /><p className="text-lg">{error}</p></div>;

    const selectedTemplate = resumeData.metadata.template;

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-background flex flex-col">
            <header className="h-16 bg-white dark:bg-background border-b border-gray-200 dark:border-foreground/10 flex items-center justify-between px-8 sticky top-0 z-50">
                <span className="font-bold text-xl text-gray-900 dark:text-foreground">{resumeData.basics.name}</span>
                <Button onClick={handleDownload} className="bg-[#1dff00] text-black hover:bg-[#15bd00]">
                    <Download className="w-4 h-4 mr-2" />
                    Download PDF
                </Button>
            </header>
            <div className="flex-1 flex justify-center p-8 overflow-y-auto">
                 <div className="bg-white shadow-2xl min-h-[1123px] w-[794px] origin-top scale-100 sm:scale-100 md:scale-100">
                    {selectedTemplate === 'azurill' && <AzurillTemplate />}
                    {selectedTemplate === 'onyx' && <OnyxTemplate />}
                    {selectedTemplate === 'bronzor' && <BronzorTemplate />}
                    {selectedTemplate === 'chikorita' && <ChikoritaTemplate />}
                    {selectedTemplate === 'ditgar' && <DitgarTemplate />}
                    {selectedTemplate === 'ditto' && <DittoTemplate />}
                    {selectedTemplate === 'gengar' && <GengarTemplate />}
                    {selectedTemplate === 'glalie' && <GlalieTemplate />}
                    {selectedTemplate === 'kakuna' && <KakunaTemplate />}
                    {selectedTemplate === 'pikachu' && <PikachuTemplate />}
                    {selectedTemplate === 'rhyhorn' && <RhyhornTemplate />}
                </div>
            </div>
        </div>
    );
};

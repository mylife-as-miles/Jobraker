import { ResumeData } from '../store/artboard';

export const downloadResumePDF = async (resumeData: ResumeData) => {
    const { default: jsPDF } = await import('jspdf');
    const { basics, sections, summary } = resumeData;
    const paragraphSpacing =
        resumeData.metadata.typography.font.paragraphSpacing ?? 8;
    const doc = new jsPDF({
        format: 'a4',
        unit: 'pt'
    });

    const margin = 50;
    let y = margin;
    const pageWidth = 595;
    const contentWidth = pageWidth - margin * 2;

    // Helper to check page break
    const checkPageBreak = (height: number) => {
        if (y + height > 800) { // Approx A4 height - margin
            doc.addPage();
            y = margin;
        }
    };

    // Header
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text(basics.name, margin, y);
    y += 20;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(basics.headline, margin, y);
    y += 20;

    doc.setFontSize(10);
    doc.setTextColor(150);
    const contactInfo = [
        basics.email,
        basics.phone,
        basics.location,
        basics.website?.url
    ].filter(Boolean).join(' | ');
    doc.text(contactInfo, margin, y);
    y += 30;

    // Profiles
    if (basics.profiles && basics.profiles.length > 0) {
         const profilesText = basics.profiles.map(p => `${p.network}: ${p.url}`).join(' | ');
         const splitProfiles = doc.splitTextToSize(profilesText, contentWidth);
         doc.text(splitProfiles, margin, y);
         y += splitProfiles.length * 12 + 10;
    }

    doc.setTextColor(0);

    // Summary
    if (summary.content && !summary.hidden) {
        checkPageBreak(50);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(summary.title || 'SUMMARY', margin, y);
        y += 15;
        doc.line(margin, y - 5, pageWidth - margin, y - 5);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const plainSummary = summary.content.replace(/<[^>]*>?/gm, '');
        const splitSummary = doc.splitTextToSize(plainSummary, contentWidth);
        doc.text(splitSummary, margin, y);
        y += splitSummary.length * 12 + paragraphSpacing + 7;
    }

    // Process all sections based on layout order if possible, or just iterate common ones
    // For simplicity, we iterate common ones + custom
    const sectionKeys = Object.keys(sections);
    // Sort logic could be added here based on layout if available

    const renderSection = (sectionId: string) => {
        const section = sections[sectionId];
        if (!section || section.hidden || section.items.length === 0) return;

        checkPageBreak(50);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text((section.title || sectionId).toUpperCase(), margin, y);
        y += 15;
        doc.line(margin, y - 5, pageWidth - margin, y - 5);

        if (section.type === 'list') {
            // Skills, Interests, Languages
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            const items = section.items.map((s: any) => s.name).join(' • ');
            const splitItems = doc.splitTextToSize(items, contentWidth);
            doc.text(splitItems, margin, y);
            y += splitItems.length * 12 + 15;
        } else {
            // Experience, Education, etc.
            section.items.forEach((item: any) => {
                checkPageBreak(60); // Check for item height
                doc.setFontSize(11);
                doc.setFont('helvetica', 'bold');

                const title = item.title || item.degree || item.name || '';
                const subtitle = item.company || item.school || item.institution || item.issuer || '';
                const date = item.date || item.period || '';

                doc.text(title, margin, y);
                doc.setFont('helvetica', 'normal');
                if (date) {
                    const dateWidth = doc.getTextWidth(date);
                    doc.text(date, pageWidth - margin - dateWidth, y);
                }
                y += 14;

                if (subtitle) {
                    doc.setFontSize(10);
                    doc.setFont('helvetica', 'italic');
                    doc.text(subtitle, margin, y);
                    y += 14;
                }

                if (item.description) {
                    doc.setFontSize(10);
                    doc.setFont('helvetica', 'normal');
                    const descText = item.description.replace(/<[^>]*>?/gm, '\n');
                    const lines = descText.split('\n').filter(Boolean);
                    lines.forEach((desc: string) => {
                        const bullet = '• ' + desc.trim();
                        const splitDesc = doc.splitTextToSize(bullet, contentWidth - 10);
                        checkPageBreak(splitDesc.length * 12);
                        doc.text(splitDesc, margin + 10, y);
                        y += splitDesc.length * 12 + paragraphSpacing;
                    });
                }
                y += 10; // spacing after item
            });
            y += 5;
        }
    };

    // Render in a specific order if desired, otherwise iterate
    // Standard order: Experience, Education, Skills, Projects, others...
    const priority = ['experience', 'education', 'skills', 'projects'];
    priority.forEach(id => renderSection(id));

    // Render remaining sections
    sectionKeys
        .filter(k => !priority.includes(k) && k !== 'summary') // summary handled separately
        .forEach(id => renderSection(id));

    doc.save(`${basics.name.replace(/\s+/g, '_')}_Resume.pdf`);
};

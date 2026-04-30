
import { nanoid } from 'nanoid';
import { ResumeData } from '../store/artboard';
import { ParsedProfileData } from '../services/ai/parseResumeProfile';

function formatPeriod(start?: string, end?: string) {
    const cleanStart = start?.trim() || '';
    const cleanEnd = end?.trim() || '';

    if (cleanStart && cleanEnd) return `${cleanStart} - ${cleanEnd}`;
    if (cleanStart) return cleanStart;
    if (cleanEnd) return cleanEnd;
    return '';
}

export function mapParsedDataToResume(parsed: ParsedProfileData, baseState: ResumeData): ResumeData {
    // Deep clone base state to avoid mutations
    const resume = JSON.parse(JSON.stringify(baseState)) as ResumeData;

    // 0. Reset base state to avoid "John Doe" ghost data
    resume.basics.name = '';
    resume.basics.email = '';
    resume.basics.phone = '';
    resume.basics.location = '';
    resume.basics.headline = '';
    resume.basics.website = { url: '', label: '' };
    resume.basics.customFields = [];
    resume.summary.content = '';
    
    // Reset sections
    Object.keys(resume.sections).forEach(key => {
        resume.sections[key].items = [];
    });

    // 1. Basics
    resume.basics.name = `${parsed.firstName} ${parsed.lastName}`.trim();
    resume.basics.email = parsed.email || '';
    resume.basics.phone = parsed.phone || '';
    resume.basics.location = parsed.location || '';
    resume.basics.headline = parsed.jobTitle || '';
    
    // 2. Summary
    if (parsed.about) {
        resume.summary.content = parsed.about;
        resume.summary.hidden = false;
    }

    // 3. Experience
    if (parsed.experience && parsed.experience.length > 0) {
        resume.sections.experience.items = parsed.experience.map(exp => ({
            id: nanoid(),
            hidden: false,
            company: exp.company,
            position: exp.title,
            location: exp.location || '',
            period: formatPeriod(exp.startDate, exp.endDate),
            date: formatPeriod(exp.startDate, exp.endDate),
            summary: exp.description || '', 
            description: exp.description || '',
            website: { url: '', label: '' },
            columns: 1
        }));
        resume.sections.experience.hidden = false;
    }

    // 4. Education
    if (parsed.education && parsed.education.length > 0) {
        resume.sections.education.items = parsed.education.map(edu => ({
            id: nanoid(),
            hidden: false,
            school: edu.school,
            degree: edu.degree,
            period: formatPeriod(edu.start, edu.end),
            date: formatPeriod(edu.start, edu.end),
            location: '',
            website: { url: '', label: '' },
            columns: 1
        }));
        resume.sections.education.hidden = false;
    }

    // 5. Skills
    if (parsed.skills && parsed.skills.length > 0) {
        resume.sections.skills.items = parsed.skills.map(skill => ({
            id: nanoid(),
            hidden: false,
            name: skill,
            level: 3, 
            description: '',
            keywords: [],
        }));
        resume.sections.skills.hidden = false;
    }

    // 6. Projects
    if (parsed.projects && parsed.projects.length > 0) {
        resume.sections.projects.items = parsed.projects.map(project => ({
            id: nanoid(),
            hidden: false,
            name: project.name,
            title: project.name,
            company: project.organization || '',
            period: project.date || '',
            date: project.date || '',
            description: project.description || '',
            website: { url: '', label: '' },
            columns: 1,
        }));
        resume.sections.projects.hidden = false;
    }

    // 7. Certifications
    if (parsed.certifications && parsed.certifications.length > 0) {
        resume.sections.certifications.items = parsed.certifications.map(cert => ({
            id: nanoid(),
            hidden: false,
            name: cert.name,
            title: cert.name,
            issuer: cert.issuer || '',
            company: cert.issuer || '',
            period: cert.date || '',
            date: cert.date || '',
            description: cert.description || '',
            website: { url: '', label: '' },
            columns: 1,
        }));
        resume.sections.certifications.hidden = false;
    }

    // 8. Title
    if (resume.basics.name) {
        resume.title = `${resume.basics.name}'s Resume`;
    }
    
    if (parsed.jobTitle) {
         // optionally append job title ? 
         // resume.title = `${parsed.firstName} - ${parsed.jobTitle}`;
    }

    return resume;
}

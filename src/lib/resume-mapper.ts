
import { nanoid } from 'nanoid';
import { ResumeData } from '../store/artboard';
import { ParsedProfileData, inferSocialProfileFromUrl } from '../services/ai/parseResumeProfile';
import { withResumeSource } from './resumeDocumentSchema';

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
    resume.basics.profiles = [];
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

    // Social Profiles & Links
    if (parsed.profiles && parsed.profiles.length > 0) {
        resume.basics.profiles = parsed.profiles.map(p => ({
            network: p.network || 'Website',
            username: p.username || '',
            url: p.url,
            icon: (p.network || 'website').toLowerCase(),
        }));
    } else if (parsed.urls && parsed.urls.length > 0) {
        resume.basics.profiles = parsed.urls.map(inferSocialProfileFromUrl).map(p => ({
            network: p.network,
            username: p.username,
            url: p.url,
            icon: p.network.toLowerCase(),
        }));
    } else {
        resume.basics.profiles = [];
    }

    if (parsed.website) {
        resume.basics.website = { url: parsed.website, label: 'Portfolio' };
    } else if (resume.basics.profiles.length > 0) {
        const portfolio = resume.basics.profiles.find(p => p.network === 'Portfolio' || p.network === 'Website');
        if (portfolio) {
            resume.basics.website = { url: portfolio.url, label: portfolio.network };
        }
    }
    
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
            level: 0, // User-set by default; stop system/AI auto-assigning ratings
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

    return withResumeSource(resume, 'imported');
}

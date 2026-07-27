
import { nanoid } from 'nanoid';
import { ResumeData } from '../store/artboard';
import { ParsedProfileData } from '../services/ai/parseResumeProfile';
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
    resume.basics.website = {
        url: parsed.website || '',
        label: parsed.website ? 'Website' : '',
    };
    resume.basics.profiles = parsed.profiles.map((profile) => ({
        network: profile.network,
        username: profile.username || '',
        url: profile.url,
    }));
    
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

    // 8. Languages
    if (parsed.languages.length > 0) {
        resume.sections.languages.items = parsed.languages.map((language) => ({
            id: nanoid(),
            hidden: false,
            name: language.name,
            description: language.description || '',
            columns: 1,
        }));
        resume.sections.languages.hidden = false;
    }

    // 9. Interests
    if (parsed.interests.length > 0) {
        resume.sections.interests.items = parsed.interests.map((interest) => ({
            id: nanoid(),
            hidden: false,
            name: interest.name,
            description: interest.description || '',
            keywords: interest.keywords || [],
            columns: 1,
        }));
        resume.sections.interests.hidden = false;
    }

    // 10. Awards
    if (parsed.awards.length > 0) {
        resume.sections.awards.items = parsed.awards.map((award) => ({
            id: nanoid(),
            hidden: false,
            name: award.name,
            title: award.name,
            issuer: award.issuer || '',
            company: award.issuer || '',
            period: award.date || '',
            date: award.date || '',
            description: award.description || '',
            columns: 1,
        }));
        resume.sections.awards.hidden = false;
    }

    // 11. Publications
    if (parsed.publications.length > 0) {
        resume.sections.publications.items = parsed.publications.map((publication) => ({
            id: nanoid(),
            hidden: false,
            name: publication.name,
            title: publication.name,
            publisher: publication.publisher || '',
            company: publication.publisher || '',
            period: publication.date || '',
            date: publication.date || '',
            description: publication.description || '',
            website: {
                url: publication.url || '',
                label: publication.url ? 'Publication' : '',
            },
            columns: 1,
        }));
        resume.sections.publications.hidden = false;
    }

    // 12. Volunteer work
    if (parsed.volunteer.length > 0) {
        resume.sections.volunteer.items = parsed.volunteer.map((entry) => ({
            id: nanoid(),
            hidden: false,
            name: entry.organization,
            company: entry.organization,
            position: entry.position || '',
            title: entry.position || '',
            location: entry.location || '',
            period: formatPeriod(entry.startDate, entry.endDate),
            date: formatPeriod(entry.startDate, entry.endDate),
            description: entry.description || '',
            columns: 1,
        }));
        resume.sections.volunteer.hidden = false;
    }

    // 13. References
    if (parsed.references.length > 0) {
        resume.sections.references.items = parsed.references.map((reference) => ({
            id: nanoid(),
            hidden: false,
            name: reference.name,
            description: reference.description || '',
            email: reference.email || '',
            phone: reference.phone || '',
            columns: 1,
        }));
        resume.sections.references.hidden = false;
    }

    // 14. Title
    if (resume.basics.name) {
        resume.title = `${resume.basics.name}'s Resume`;
    }
    
    if (parsed.jobTitle) {
         // optionally append job title ? 
         // resume.title = `${parsed.firstName} - ${parsed.jobTitle}`;
    }

    return withResumeSource(resume, 'imported');
}


import { nanoid } from 'nanoid';
import { ResumeData } from '../store/artboard';
import { ParsedProfileData } from '../services/ai/parseResumeProfile';

// Helper to ensure unique IDs
function withIds(items: any[], type: string = 'basic') {
    if (!Array.isArray(items)) return [];
    return items.map(item => ({
        ...item,
        id: nanoid(),
        hidden: false,
        columns: 1,
        type, 
        // Ensure common fields exist
        name: item.name || '',
        description: item.description || item.summary || '',
        date: item.date || item.period || '',
        website: item.website || { url: '', label: '' },
    }));
}

export function mapParsedDataToResume(parsed: any, baseState: ResumeData): ResumeData {
    // Deep clone base state
    const resume = JSON.parse(JSON.stringify(baseState)) as ResumeData;
    
    // Safety check - if parsed is null/undefined
    if (!parsed) return resume;

    // 1. Basics
    if (parsed.basics) {
        resume.basics = { ...resume.basics, ...parsed.basics };
    }

    // 2. Summary
    if (parsed.summary?.content) {
        resume.summary.content = parsed.summary.content;
        resume.summary.hidden = false;
    }

    // 3. Sections
    if (parsed.sections) {
        // Experience
        if (parsed.sections.experience?.items) {
             resume.sections.experience.items = withIds(parsed.sections.experience.items).map(i => ({
                 ...i,
                 position: i.position || i.title || '', // Map title/position
             }));
             resume.sections.experience.hidden = resume.sections.experience.items.length === 0;
        }

        // Education
        if (parsed.sections.education?.items) {
            resume.sections.education.items = withIds(parsed.sections.education.items);
            resume.sections.education.hidden = resume.sections.education.items.length === 0;
        }

        // Skills (List type)
        if (parsed.sections.skills?.items) {
            resume.sections.skills.items = withIds(parsed.sections.skills.items, 'list').map(i => ({
                ...i,
                level: i.level || 3,
            }));
            resume.sections.skills.hidden = resume.sections.skills.items.length === 0;
        }

        // Projects
        if (parsed.sections.projects?.items) {
            resume.sections.projects.items = withIds(parsed.sections.projects.items);
            resume.sections.projects.hidden = resume.sections.projects.items.length === 0;
        }
        
        // Map other sections dynamically if they follow standard patterns
        ['awards', 'certifications', 'languages', 'interests', 'volunteer', 'publications', 'references'].forEach(key => {
            if (parsed.sections[key]?.items) {
                 resume.sections[key].items = withIds(parsed.sections[key].items, resume.sections[key].type || 'basic');
                 resume.sections[key].hidden = resume.sections[key].items.length === 0;
            }
        });
    }

    // 4. Title
    if (resume.basics.name) {
        resume.title = `${resume.basics.name}'s Resume`;
    }

    return resume;
}

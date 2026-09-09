import { describe, it, expect } from 'vitest';
import { analyzeResumeText } from '../utils/analyzeResume';
import { sanitizeParsedProfileData } from '../services/ai/parseResumeProfile';
import { validateParsedResume } from '../types/resume-parse-schemas';

describe('Resume Section Detection & Segmentation Pipeline', () => {
  describe('analyzeResumeText Section Heading Heuristics', () => {
    it('detects standard section headings and variants with colons and markdown', () => {
      const resume = `
John Doe
john.doe@example.com | (555) 123-4567 | github.com/johndoe

## Professional Summary:
Senior Full-Stack Software Engineer with 8+ years of experience building scalable systems.

## Work History:
Senior Engineer | Google LLC | 2021 - Present
- Architected distributed search platform handling 50k QPS.
- Reduced latency by 40%.

Staff Engineer | Acme Corp | 2018 - 2021
- Led team of 6 engineers migrating monolith to microservices.

## Academic Background:
Stanford University | B.S. Computer Science | 2014 - 2018

## Core Competencies:
TypeScript, React, Node.js, Go, Python, PostgreSQL, Redis, Docker, Kubernetes

## Key Projects:
CloudFlow: Open-source workflow orchestration engine with 3k GitHub stars.

## Certifications & Licenses:
AWS Certified Solutions Architect - Professional (2023)
`;

      const analyzed = analyzeResumeText(resume);

      expect(analyzed.emails).toContain('john.doe@example.com');
      expect(analyzed.phones.length).toBeGreaterThan(0);

      // Verify sections are accurately detected
      const sectionTypes = analyzed.sections.map((s) => s.canonical);
      expect(sectionTypes).toContain('summary');
      expect(sectionTypes).toContain('experience');
      expect(sectionTypes).toContain('education');
      expect(sectionTypes).toContain('skills');
      expect(sectionTypes).toContain('projects');
      expect(sectionTypes).toContain('certifications');

      // Verify structured object matches
      expect(analyzed.structured.summary).toContain('Senior Full-Stack Software Engineer');
      expect(analyzed.structured.experience.length).toBeGreaterThan(0);
      expect(analyzed.structured.education.length).toBeGreaterThan(0);
      expect(analyzed.structured.skills).toContain('typescript');
      expect(analyzed.structured.skills).toContain('react');
      expect(analyzed.structured.skills).toContain('docker');
    });

    it('does not falsely classify regular body sentences mentioning "experience" as headings', () => {
      const resume = `
Jane Smith
jane@example.com

## Professional Summary
I have 10 years of experience leading engineering teams and building high throughput pipelines.

## Experience
Acme Corp | Staff Engineer
During my experience at Acme I led database performance tuning.
`;

      const analyzed = analyzeResumeText(resume);
      const experienceSections = analyzed.sections.filter((s) => s.canonical === 'experience');
      // Only the real section heading should be captured, not the sentence "During my experience at Acme..."
      expect(experienceSections.length).toBe(1);
    });
  });

  describe('Bidirectional Section Leakage Sanitization', () => {
    it('reclassifies degrees accidentally extracted into experience into education', () => {
      const malformedData = {
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        jobTitle: 'Software Engineer',
        experience: [
          {
            company: 'Acme Corp',
            title: 'Senior Software Engineer',
            description: 'Built payment APIs.',
          },
          {
            company: 'Harvard University',
            title: 'B.S. in Computer Science',
            description: 'Graduated magna cum laude.',
            startDate: '2015',
            endDate: '2019',
          },
        ],
        education: [],
        skills: ['TypeScript', 'React'],
      };

      const sanitized = sanitizeParsedProfileData(malformedData);

      // Experience should now only have Acme Corp
      expect(sanitized.experience.length).toBe(1);
      expect(sanitized.experience[0].company).toBe('Acme Corp');

      // Education should have Harvard University B.S. in Computer Science
      expect(sanitized.education.length).toBe(1);
      expect(sanitized.education[0].school).toBe('Harvard University');
      expect(sanitized.education[0].degree).toBe('B.S. in Computer Science');
    });

    it('absorbs skill lists mistakenly parsed as experience items into skills', () => {
      const malformedData = {
        firstName: 'Bob',
        lastName: 'Smith',
        email: 'bob@example.com',
        jobTitle: 'Full Stack Engineer',
        experience: [
          {
            company: 'Technical Skills',
            title: 'Languages & Tools',
            description: 'JavaScript, TypeScript, React, Go, Docker, AWS',
          },
          {
            company: 'Stripe',
            title: 'Backend Engineer',
            description: 'Maintained billing infrastructure.',
          },
        ],
        education: [],
        skills: ['Python'],
      };

      const sanitized = sanitizeParsedProfileData(malformedData);

      expect(sanitized.experience.length).toBe(1);
      expect(sanitized.experience[0].company).toBe('Stripe');
      expect(sanitized.skills).toContain('Docker');
      expect(sanitized.skills).toContain('AWS');
      expect(sanitized.skills).toContain('TypeScript');
    });

    it('reclassifies job titles mistakenly placed in education into experience', () => {
      const malformedData = {
        firstName: 'Alice',
        lastName: 'Wonder',
        email: 'alice@example.com',
        jobTitle: 'Engineering Manager',
        experience: [],
        education: [
          {
            school: 'Netflix',
            degree: 'Senior Software Engineer',
            start: '2020',
            end: '2023',
          },
          {
            school: 'UC Berkeley',
            degree: 'B.S. Electrical Engineering & Computer Science',
            start: '2014',
            end: '2018',
          },
        ],
        skills: ['Java'],
      };

      const sanitized = sanitizeParsedProfileData(malformedData);

      expect(sanitized.experience.length).toBe(1);
      expect(sanitized.experience[0].company).toBe('Netflix');
      expect(sanitized.experience[0].title).toBe('Senior Software Engineer');

      expect(sanitized.education.length).toBe(1);
      expect(sanitized.education[0].school).toBe('UC Berkeley');
    });
  });

  describe('Validation Resilience', () => {
    it('validates resume data containing domain URLs and email without failing', () => {
      const analyzed = {
        emails: ['user@domain.com'],
        phones: ['+1 (555) 019-2834'],
        urls: ['github.com/myusername', 'linkedin.com/in/myprofile'],
        skills: ['React', 'Next.js', 'PostgreSQL'],
        sections: [
          { heading: 'Experience', content: 'Acme Corp Senior Engineer' },
        ],
        structured: {
          summary: 'Experienced developer',
          experience: [],
          education: [],
          projects: [],
        },
        entities: {
          companies: ['Acme Corp'],
          titles: ['Senior Engineer'],
        },
      };

      const validated = validateParsedResume(analyzed);
      expect(validated).not.toBeNull();
      expect(validated?.emails).toContain('user@domain.com');
      expect(validated?.urls).toHaveLength(2);
    });
  });

  describe('extractPageLayoutLines Multi-Column Gutter Detection', () => {
    it('isolates 2-column resume layout without horizontally interleaving columns', async () => {
      const { extractPageLayoutLines } = await import('../utils/parsePdf');

      const mockItems = [
        // Top full-width Header
        { str: 'Alex Johnson', x: 50, y: 780, width: 120, height: 16, fontName: 'Helvetica-Bold' },
        { str: 'alex@example.com', x: 50, y: 760, width: 100, height: 10, fontName: 'Helvetica' },

        // Left Column (x: 40..160, y: 700..500) - Skills & Education
        { str: 'Skills', x: 40, y: 700, width: 40, height: 12, fontName: 'Helvetica-Bold' },
        { str: 'TypeScript', x: 40, y: 680, width: 60, height: 10, fontName: 'Helvetica' },
        { str: 'React', x: 40, y: 660, width: 40, height: 10, fontName: 'Helvetica' },
        { str: 'Node.js', x: 40, y: 640, width: 50, height: 10, fontName: 'Helvetica' },
        { str: 'Python', x: 40, y: 620, width: 40, height: 10, fontName: 'Helvetica' },
        { str: 'PostgreSQL', x: 40, y: 600, width: 60, height: 10, fontName: 'Helvetica' },
        { str: 'Docker', x: 40, y: 580, width: 40, height: 10, fontName: 'Helvetica' },
        { str: 'Education', x: 40, y: 540, width: 55, height: 12, fontName: 'Helvetica-Bold' },
        { str: 'MIT BS CS', x: 40, y: 520, width: 65, height: 10, fontName: 'Helvetica' },

        // Right Column (x: 240..520, y: 700..500) - Experience
        { str: 'Experience', x: 240, y: 700, width: 65, height: 12, fontName: 'Helvetica-Bold' },
        { str: 'Senior Engineer at Stripe', x: 240, y: 680, width: 150, height: 10, fontName: 'Helvetica-Bold' },
        { str: 'Built global payments engine', x: 240, y: 660, width: 160, height: 10, fontName: 'Helvetica' },
        { str: 'Scaled to 10k transactions/sec', x: 240, y: 640, width: 170, height: 10, fontName: 'Helvetica' },
        { str: 'Staff Engineer at Uber', x: 240, y: 600, width: 140, height: 10, fontName: 'Helvetica-Bold' },
        { str: 'Led dispatch optimization team', x: 240, y: 580, width: 160, height: 10, fontName: 'Helvetica' },
        { str: 'Reduced customer wait by 25%', x: 240, y: 560, width: 160, height: 10, fontName: 'Helvetica' },
      ];

      const lines = extractPageLayoutLines(mockItems);
      const renderedText = lines.map((l) => l.text).join('\n');

      // 1. Check that heading markers were inserted
      expect(renderedText).toContain('## Skills');
      expect(renderedText).toContain('## Experience');
      expect(renderedText).toContain('## Education');

      // 2. CRITICAL: Verify NO horizontal line interleaving!
      // In a naive Y-sorter, y=680 would have produced "TypeScript Senior Engineer at Stripe" on a single line!
      expect(renderedText).not.toMatch(/TypeScript.*Senior Engineer/);
      expect(renderedText).not.toMatch(/React.*payments engine/);

      // 3. Verify that left column skills stay together in a block
      const skillsIdx = renderedText.indexOf('## Skills');
      const tsIdx = renderedText.indexOf('TypeScript');
      const reactIdx = renderedText.indexOf('React');
      const expIdx = renderedText.indexOf('## Experience');

      expect(skillsIdx).toBeLessThan(tsIdx);
      expect(tsIdx).toBeLessThan(reactIdx);
      expect(reactIdx).toBeLessThan(expIdx);
    });

    it('does NOT falsely split a 1-column resume with right-aligned dates into columns', async () => {
      const { extractPageLayoutLines } = await import('../utils/parsePdf');

      // 1-column resume where each role has a title on the left and date on the right
      const mock1ColItems = [
        { str: 'Jane Doe', x: 50, y: 780, width: 100, height: 16, fontName: 'Helvetica-Bold' },
        { str: 'Experience', x: 50, y: 740, width: 70, height: 14, fontName: 'Helvetica-Bold' },
        
        { str: 'Senior Software Engineer', x: 50, y: 700, width: 150, height: 11, fontName: 'Helvetica-Bold' },
        { str: 'Google LLC', x: 210, y: 700, width: 60, height: 11, fontName: 'Helvetica' },
        { str: '2021 – Present', x: 480, y: 700, width: 70, height: 10, fontName: 'Helvetica' },
        { str: '- Architected distributed caching layer saving $2M annually', x: 50, y: 680, width: 300, height: 10, fontName: 'Helvetica' },
        
        { str: 'Software Engineer', x: 50, y: 640, width: 120, height: 11, fontName: 'Helvetica-Bold' },
        { str: 'Stripe', x: 180, y: 640, width: 40, height: 11, fontName: 'Helvetica' },
        { str: '2018 – 2021', x: 480, y: 640, width: 65, height: 10, fontName: 'Helvetica' },
        { str: '- Built real-time payment dispute handling workflows', x: 50, y: 620, width: 280, height: 10, fontName: 'Helvetica' },

        { str: 'Junior Developer', x: 50, y: 580, width: 100, height: 11, fontName: 'Helvetica-Bold' },
        { str: 'Acme Corp', x: 160, y: 580, width: 50, height: 11, fontName: 'Helvetica' },
        { str: '2016 – 2018', x: 480, y: 580, width: 65, height: 10, fontName: 'Helvetica' },
        { str: '- Implemented frontend UI components using React', x: 50, y: 560, width: 250, height: 10, fontName: 'Helvetica' },

        { str: 'Intern', x: 50, y: 520, width: 40, height: 11, fontName: 'Helvetica-Bold' },
        { str: 'Beta Inc', x: 100, y: 520, width: 50, height: 11, fontName: 'Helvetica' },
        { str: '2015 – 2016', x: 480, y: 520, width: 65, height: 10, fontName: 'Helvetica' },
        { str: '- Assisted in test automation', x: 50, y: 500, width: 200, height: 10, fontName: 'Helvetica' },

        { str: 'Apprentice', x: 50, y: 460, width: 60, height: 11, fontName: 'Helvetica-Bold' },
        { str: 'TechLab', x: 120, y: 460, width: 45, height: 11, fontName: 'Helvetica' },
        { str: '2014 – 2015', x: 480, y: 460, width: 65, height: 10, fontName: 'Helvetica' },
        { str: '- Maintained CI scripts', x: 50, y: 440, width: 180, height: 10, fontName: 'Helvetica' },

        { str: 'Trainee', x: 50, y: 400, width: 50, height: 11, fontName: 'Helvetica-Bold' },
        { str: 'StartupX', x: 110, y: 400, width: 50, height: 11, fontName: 'Helvetica' },
        { str: '2013 – 2014', x: 480, y: 400, width: 65, height: 10, fontName: 'Helvetica' },
        { str: '- Built landing pages', x: 50, y: 380, width: 160, height: 10, fontName: 'Helvetica' },
      ];

      const lines = extractPageLayoutLines(mock1ColItems);
      const renderedText = lines.map((l) => l.text).join('\n');

      // The dates should stay on the SAME line as their respective roles!
      // They should NOT be dumped at the end of the text.
      expect(renderedText).toMatch(/Senior Software Engineer.*Google LLC.*2021 – Present/);
      expect(renderedText).toMatch(/Software Engineer.*Stripe.*2018 – 2021/);
      expect(renderedText).toMatch(/Junior Developer.*Acme Corp.*2016 – 2018/);
    });
  });

  describe('Deep Anti-Absorption & Embedded Section Segmentation', () => {
    it('extracts education, skills, projects, and certifications leaked inside experience.description', () => {
      const contaminatedExperienceData = {
        firstName: 'Marcus',
        lastName: 'Vance',
        email: 'marcus@example.com',
        jobTitle: 'Senior Software Engineer',
        experience: [
          {
            company: 'Amazon',
            title: 'Software Development Engineer II',
            description: `- Designed high-throughput microservices handling 50k TPS.
- Mentored 4 junior engineers.

## Education
University of Washington
B.S. in Computer Science, 2016 - 2020

## Technical Skills
TypeScript, React, Python, Golang, Docker, Kubernetes, AWS, DynamoDB

## Projects
CloudWatch Log Viewer
Built full-stack React and Go web app to stream real-time AWS CloudWatch logs with 1.2k stars.

## Certifications & Licenses
AWS Certified Solutions Architect - Professional (2022)
Certified Kubernetes Administrator (CKA)`,
            startDate: '2020',
            endDate: 'Present',
          },
        ],
        education: [],
        skills: [],
        projects: [],
        certifications: [],
      };

      const cleaned = sanitizeParsedProfileData(contaminatedExperienceData);

      // 1. Experience description is truncated at the section boundary and clean
      expect(cleaned.experience.length).toBe(1);
      expect(cleaned.experience[0].company).toBe('Amazon');
      expect(cleaned.experience[0].description).toContain('Designed high-throughput microservices');
      expect(cleaned.experience[0].description).toContain('Mentored 4 junior engineers.');
      expect(cleaned.experience[0].description).not.toContain('## Education');
      expect(cleaned.experience[0].description).not.toContain('## Technical Skills');
      expect(cleaned.experience[0].description).not.toContain('## Projects');
      expect(cleaned.experience[0].description).not.toContain('## Certifications');

      // 2. Education was cleanly recovered
      expect(cleaned.education.length).toBeGreaterThan(0);
      expect(cleaned.education[0].school).toBe('University of Washington');
      expect(cleaned.education[0].degree).toContain('Computer Science');

      // 3. Skills were cleanly recovered
      expect(cleaned.skills).toContain('TypeScript');
      expect(cleaned.skills).toContain('React');
      expect(cleaned.skills).toContain('Golang');
      expect(cleaned.skills).toContain('Docker');
      expect(cleaned.skills).toContain('Kubernetes');

      // 4. Projects were cleanly recovered
      expect(cleaned.projects.length).toBeGreaterThan(0);
      expect(cleaned.projects[0].name).toBe('CloudWatch Log Viewer');
      expect(cleaned.projects[0].description).toContain('Built full-stack React and Go web app');

      // 5. Certifications were cleanly recovered
      expect(cleaned.certifications.length).toBeGreaterThan(0);
      const certNames = cleaned.certifications.map((c) => c.name);
      expect(certNames.some((c) => c.includes('Solutions Architect'))).toBe(true);
    });

    it('reclassifies projects and certifications mistakenly parsed as standalone experience items', () => {
      const mixedExperienceData = {
        firstName: 'Elena',
        lastName: 'Rostova',
        email: 'elena@example.com',
        jobTitle: 'Full Stack Engineer',
        experience: [
          {
            company: 'Meta',
            title: 'Staff Software Engineer',
            description: 'Built Instagram reel recommendations engine.',
            startDate: '2021',
            endDate: 'Present',
          },
          {
            company: 'Crypto Portfolio Tracker App',
            title: 'Creator & Lead Developer',
            description: 'Mobile application built with React Native and Supabase with 10k MAU.',
            startDate: '2023',
            endDate: '',
          },
          {
            company: 'Project: OpenSource CLI Tool',
            title: 'Developer',
            description: 'Rust CLI tool for developer productivity with github.com/elena/tool repository.',
            startDate: '2022',
            endDate: '',
          },
          {
            company: 'Amazon Web Services',
            title: 'AWS Certified Solutions Architect',
            description: 'Validation ID: AWS-10293847',
            startDate: '2023',
            endDate: '',
          },
        ],
        education: [],
        skills: ['React', 'Rust'],
        projects: [],
        certifications: [],
      };

      const cleaned = sanitizeParsedProfileData(mixedExperienceData);

      // Only the real job at Meta should remain in experience!
      expect(cleaned.experience.length).toBe(1);
      expect(cleaned.experience[0].company).toBe('Meta');
      expect(cleaned.experience[0].title).toBe('Staff Software Engineer');

      // The 2 projects should be in projects
      expect(cleaned.projects.length).toBe(2);
      const projectNames = cleaned.projects.map((p) => p.name);
      expect(projectNames.some((n) => n.includes('Crypto Portfolio Tracker') || n.includes('Creator'))).toBe(true);
      expect(projectNames.some((n) => n.includes('OpenSource CLI Tool') || n.includes('Developer'))).toBe(true);

      // The certification should be in certifications
      expect(cleaned.certifications.length).toBe(1);
      expect(cleaned.certifications[0].name).toContain('AWS Certified Solutions Architect');
      expect(cleaned.certifications[0].issuer).toBe('Amazon Web Services');
    });

    it('segments multiple jobs in fallback parsing rather than merging into a single entry', async () => {
      const { buildFallbackParsedProfileData } = await import('../services/ai/parseResumeProfile');

      const resumeText = `
Alexander Pierce
alexander.pierce@example.com

## Summary
Experienced engineering leader with deep expertise in distributed systems and cloud architecture.

## Experience
Senior Staff Engineer | Netflix | 2021 – Present
- Led playback streaming optimization across EMEA region.
- Decreased video buffering rate by 18%.

Lead Systems Architect | Spotify | 2018 – 2021
- Designed audio transcoding pipeline processing 100k tracks daily.
- Managed team of 12 backend engineers.

Senior Software Engineer | Twitter | 2015 – 2018
- Scaled tweet fanout queue to 500k events/second.

## Education
B.S. in Computer Science | Carnegie Mellon University | 2011 – 2015

## Skills
Go, Java, Python, Kafka, Cassandra, Kubernetes, AWS
`;

      const parsed = buildFallbackParsedProfileData(resumeText, 'Alexander Pierce');

      // MUST segment into 3 distinct jobs, NOT one massive blob!
      expect(parsed.experience.length).toBe(3);
      expect(parsed.experience[0].company).toContain('Netflix');
      expect(parsed.experience[0].title).toContain('Senior Staff Engineer');
      expect(parsed.experience[1].company).toContain('Spotify');
      expect(parsed.experience[1].title).toContain('Lead Systems Architect');
      expect(parsed.experience[2].company).toContain('Twitter');

      // Education and Skills should be populated cleanly
      expect(parsed.education.length).toBeGreaterThan(0);
      expect(parsed.skills.length).toBeGreaterThan(3);
    });
  });
});

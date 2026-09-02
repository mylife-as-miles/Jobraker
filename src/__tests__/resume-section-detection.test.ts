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
  });
});

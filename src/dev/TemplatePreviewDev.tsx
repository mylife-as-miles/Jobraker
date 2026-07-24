// TEMPORARY dev-only harness for visually verifying resume templates.
// Renders one template (via ?t=<id>) with realistic data AND the app's
// DEFAULT layout, to confirm placement is layout-independent.
import { ResumeTemplateRenderer } from "../templates/render-resume-template";
import type { ResumeData } from "../store/artboard";

const P = (t: string) => `<p>${t}</p>`;

const mockData: ResumeData = {
  title: "Rizka Dian Resume",
  slug: "rizka-dian",
  tags: [],
  basics: {
    name: "Rizka Dian",
    headline: "Human Resources",
    email: "youremail@gmail.com",
    phone: "+62 094 000 291",
    location: "Jakarta, Indonesia",
    website: { url: "instagram.com/username", label: "@username" },
    customFields: [],
    picture: {
      url: "https://i.pravatar.cc/400?img=47",
      size: 100,
      aspectRatio: 1,
      borderRadius: 0,
      effects: { hidden: false, border: false, grayscale: false },
    },
  },
  summary: {
    id: "summary",
    title: "Profile",
    columns: 1,
    hidden: false,
    type: "basic",
    items: [],
    content: P(
      "My Name is Rizka Dian, I have dedicated my career to fostering positive workplace environments, enhancing employee relations, and driving organizational success. My expertise spans various HR functions, including talent acquisition, employee development, performance management, and strategic planning.",
    ),
  },
  sections: {
    experience: {
      id: "experience",
      title: "Experience",
      columns: 1,
      hidden: false,
      type: "basic",
      items: [
        { id: "e1", hidden: false, position: "Assistant Manager", company: "PT. Sinar Jaya", location: "Tangerang Selatan - Full Time", date: "May 2022 - present" },
        { id: "e2", hidden: false, position: "Marketing Supervisor", company: "Apotek Sejahtera", location: "Surabaya - Full Time", date: "Jan 2021 - Sep 2022" },
        { id: "e3", hidden: false, position: "Content Creator", company: "Lifespan Agency", location: "Remote Work - Part Time", date: "Apr 2020 - present" },
        { id: "e4", hidden: false, position: "Human Resources", company: "PT. Jaya Abadi", location: "Bandung - Full Time", date: "Dec 2020 - Feb 2021" },
      ],
    },
    education: {
      id: "education",
      title: "Education",
      columns: 1,
      hidden: false,
      type: "basic",
      items: [
        { id: "ed1", hidden: false, school: "Universitas Indonesia", degree: "Bachelor of Economics", grade: "3.7/4.0", date: "2020 - 2024" },
      ],
    },
    languages: {
      id: "languages",
      title: "Language",
      columns: 1,
      hidden: false,
      type: "list",
      items: [
        { id: "lg1", hidden: false, name: "Bahasa", level: 5 },
        { id: "lg2", hidden: false, name: "English", level: 4 },
        { id: "lg3", hidden: false, name: "Spanish", level: 3 },
      ],
    },
    skills: {
      id: "skills",
      title: "Skills",
      columns: 1,
      hidden: false,
      type: "list",
      items: [
        { id: "sk1", hidden: false, name: "Negotiation" },
        { id: "sk2", hidden: false, name: "Digital Marketing" },
        { id: "sk3", hidden: false, name: "Market Analysis" },
        { id: "sk4", hidden: false, name: "SEO Optimization" },
        { id: "sk5", hidden: false, name: "Team Leading" },
        { id: "sk6", hidden: false, name: "Market Segmenting" },
        { id: "sk7", hidden: false, name: "Market Research" },
        { id: "sk8", hidden: false, name: "Communication" },
        { id: "sk9", hidden: false, name: "Finance Analysis" },
        { id: "sk10", hidden: false, name: "Data Analysis" },
      ],
    },
    interests: {
      id: "interests",
      title: "Tools",
      columns: 1,
      hidden: false,
      type: "list",
      items: [
        { id: "in1", hidden: false, name: "Illustrator" },
        { id: "in2", hidden: false, name: "Photoshop" },
        { id: "in3", hidden: false, name: "Premiere" },
        { id: "in4", hidden: false, name: "CapCut" },
      ],
    },
    projects: { id: "projects", title: "Projects", columns: 1, hidden: true, items: [], type: "basic" },
    awards: { id: "awards", title: "Awards", columns: 1, hidden: true, items: [], type: "basic" },
    certifications: { id: "certifications", title: "Certifications", columns: 1, hidden: true, items: [], type: "basic" },
    publications: { id: "publications", title: "Publications", columns: 1, hidden: true, items: [], type: "basic" },
    volunteer: { id: "volunteer", title: "Volunteer", columns: 1, hidden: true, items: [], type: "basic" },
    references: { id: "references", title: "References", columns: 1, hidden: true, items: [], type: "basic" },
  },
  metadata: {
    schemaVersion: 2,
    sourceType: "template",
    template: "dian",
    // The app's DEFAULT layout — deliberately NOT tailored per template.
    layout: {
      sidebarWidth: 30,
      pages: [
        {
          fullWidth: false,
          main: ["summary", "experience", "education", "projects", "certifications", "publications", "volunteer", "references", "awards"],
          sidebar: ["skills", "languages", "interests"],
        },
      ],
    },
    page: { format: "a4", margin: 18 },
    typography: {
      font: { family: "Inter", size: 14, lineHeight: 1.5, paragraphSpacing: 8 },
    },
  },
};

export function TemplatePreviewDev() {
  const params = new URLSearchParams(window.location.search);
  const templateId = params.get("t") || "dian";
  return (
    <div className='min-h-screen bg-neutral-300 p-8'>
      <div className='mx-auto shadow-2xl' style={{ width: 794, height: 1123 }}>
        <ResumeTemplateRenderer
          templateId={templateId}
          resumeDataOverride={mockData}
        />
      </div>
    </div>
  );
}

export default TemplatePreviewDev;


import { analyzeResumeText } from "@/utils/analyzeResume";
import { invokeProtectedFunction } from "../supabase/invokeProtectedFunction";

export interface ParsedProfileData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  location: string;
  jobTitle: string;
  experienceYears: number | null;
  about: string;
  website?: string;
  profiles?: Array<{
    network: string;
    url: string;
    username?: string;
  }>;
  urls?: string[];
  skills: string[];
  education: Array<{
    school: string;
    degree: string;
    start?: string;
    end?: string;
  }>;
  experience: Array<{
    company: string;
    title: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    description?: string;
  }>;
  projects: Array<{
    name: string;
    organization?: string;
    date?: string;
    description?: string;
  }>;
  certifications: Array<{
    name: string;
    issuer?: string;
    date?: string;
    description?: string;
  }>;
}

export function inferSocialProfileFromUrl(url: string): { network: string; url: string; username: string } {
  let cleanUrl = (url || "").trim().replace(/[.,;:)\]]+$/, "");
  if (!cleanUrl) return { network: "Website", url: "", username: "" };
  if (!/^https?:\/\//i.test(cleanUrl)) {
    cleanUrl = `https://${cleanUrl}`;
  }

  let network = "Website";
  let username = "";

  try {
    const parsed = new URL(cleanUrl);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.replace(/^\/+|\/+$/g, "");
    const parts = path.split("/").filter(Boolean);

    if (host.includes("linkedin.com")) {
      network = "LinkedIn";
      username = parts.length >= 2 && (parts[0] === "in" || parts[0] === "pub") ? parts[1] : (parts[0] || "");
    } else if (host.includes("github.com")) {
      network = "GitHub";
      username = parts[0] || "";
    } else if (host.includes("twitter.com") || host.includes("x.com")) {
      network = "X";
      username = parts[0] || "";
    } else if (host.includes("medium.com")) {
      network = "Medium";
      username = parts[0]?.replace(/^@/, "") || "";
    } else if (host.includes("behance.net")) {
      network = "Behance";
      username = parts[0] || "";
    } else if (host.includes("dribbble.com")) {
      network = "Dribbble";
      username = parts[0] || "";
    } else if (host.includes("instagram.com")) {
      network = "Instagram";
      username = parts[0] || "";
    } else if (host.includes("youtube.com")) {
      network = "YouTube";
      username = parts[0] || "";
    } else {
      network = "Portfolio";
      username = parsed.hostname.replace(/^www\./, "");
    }
  } catch {
    network = "Website";
  }

  return { network, url: cleanUrl, username };
}

function splitFullName(fullName: string) {
  const tokens = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return {
    firstName: tokens[0] || "",
    lastName: tokens.slice(1).join(" "),
  };
}

function parseLegacyRange(range: string) {
  const cleaned = range.trim();
  if (!cleaned) return { start: "", end: "" };

  const parts = cleaned
    .split(/\s+[—-]\s+|\s+to\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return { start: parts[0], end: parts.slice(1).join(" - ") };
  }

  return { start: cleaned, end: "" };
}

export interface ParseResumeRequest {
  resumeText?: string;
  pdfBase64?: string;
  apiKey?: string; // Deprecated/Unused but kept for signature compatibility if needed
  model?: string | null;
  baseURL?: string | null;
}

export async function parseResumeWithAI({
  resumeText,
  pdfBase64,
}: ParseResumeRequest): Promise<ParsedProfileData> {
  if ((!resumeText || !resumeText.trim()) && (!pdfBase64 || !pdfBase64.trim())) {
    throw new Error("Either resume text or PDF base64 is required");
  }

  try {
    const data = await invokeProtectedFunction<unknown>('parse-resume', {
      body: { resumeText, pdfBase64 }
    });

    if (!data) throw new Error("No data returned from AI");

    return sanitizeParsedProfileData(data);
  } catch (err: any) {
    throw new Error(`Failed to parse resume: ${err.message || err}`);
  }
}

function inferNameParts(fallbackName?: string, resumeText?: string) {
  const normalizedFallback = String(fallbackName || "")
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const fallbackTokens = normalizedFallback
    .split(" ")
    .filter(Boolean)
    .filter(
      (token) => !/^(resume|cv|cover|letter|draft|final|copy)$/i.test(token),
    );

  if (fallbackTokens.length >= 2) {
    return {
      firstName: fallbackTokens[0],
      lastName: fallbackTokens.slice(1).join(" "),
    };
  }

  const textTokens = String(resumeText || "")
    .split(/\s+/)
    .map((token) => token.replace(/[^\p{L}'-]/gu, "").trim())
    .filter((token) => /^[A-Z][\p{L}'-]+$/u.test(token))
    .slice(0, 3);

  return {
    firstName: textTokens[0] || "Imported",
    lastName: textTokens.slice(1).join(" ") || "Resume",
  };
}

function splitExperienceContentIntoJobs(
  content: string,
  entities: { companies: string[]; titles: string[] },
): Array<{
  company: string;
  title: string;
  location: string;
  startDate: string;
  endDate: string;
  description: string;
}> {
  const lines = content.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const dateRangeRegex = /\b((?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+)?\d{4}\s*[-—–]\s*(?:(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+)?\d{4}|Present|Current))\b/i;
  const pipeOrAtRegex = /^(.+?)\s+(?:\||at|@|–|-)\s+(.+)$/i;

  interface RawJob {
    company: string;
    title: string;
    date: string;
    descLines: string[];
  }

  const jobs: RawJob[] = [];
  let currentJob: RawJob | null = null;

  for (const line of lines) {
    const hasDate = dateRangeRegex.test(line);
    const dateMatch = line.match(dateRangeRegex);
    const lineWithoutDate = dateMatch ? line.replace(dateMatch[0], "").replace(/[,|\-—]+$/, "").trim() : line;
    const isBullet = /^[•*\-\d.]+\s*/.test(line);

    const isNewJobHeader =
      !isBullet &&
      (hasDate ||
        pipeOrAtRegex.test(lineWithoutDate) ||
        entities.companies.some((c) => line.includes(c)) ||
        entities.titles.some((t) => line.toLowerCase().includes(t.toLowerCase())));

    if (isNewJobHeader && line.length < 120) {
      if (currentJob) {
        jobs.push(currentJob);
      }

      let company = "";
      let title = "";
      const date = dateMatch ? dateMatch[0] : "";

      const pipeMatch = lineWithoutDate.match(pipeOrAtRegex);
      if (pipeMatch) {
        const part1 = pipeMatch[1].trim();
        const part2 = pipeMatch[2].trim();
        const part1IsTitle = entities.titles.some((t) => part1.toLowerCase().includes(t.toLowerCase()));
        if (part1IsTitle) {
          title = part1;
          company = part2;
        } else {
          company = part1;
          title = part2;
        }
      } else {
        const matchedComp = entities.companies.find((c) => lineWithoutDate.includes(c));
        const matchedTit = entities.titles.find((t) => lineWithoutDate.toLowerCase().includes(t.toLowerCase()));
        company = matchedComp || lineWithoutDate;
        title = matchedTit || "";
      }

      currentJob = {
        company: company || "Company",
        title: title || "Role",
        date,
        descLines: [],
      };
    } else if (currentJob) {
      currentJob.descLines.push(line);
    } else {
      currentJob = {
        company: lines[0] || "Company",
        title: entities.titles[0] || "Role",
        date: "",
        descLines: [],
      };
    }
  }

  if (currentJob) {
    jobs.push(currentJob);
  }

  return jobs.map((j) => {
    const dates = j.date ? j.date.split(/[-—–]/) : [];
    return {
      company: j.company,
      title: j.title,
      location: "",
      startDate: dates[0] ? dates[0].trim() : "",
      endDate: dates[1] ? dates[1].trim() : "",
      description: j.descLines.join("\n").trim(),
    };
  });
}

export function buildFallbackParsedProfileData(
  resumeText: string,
  fallbackName?: string,
): ParsedProfileData {
  const analyzed = analyzeResumeText(resumeText);
  const nameParts = inferNameParts(fallbackName, resumeText);
  const summary =
    typeof analyzed.structured?.summary === "string" &&
    analyzed.structured.summary.trim()
      ? analyzed.structured.summary.trim()
      : resumeText
          .split(/\n+/)
          .map((line) => line.trim())
          .filter(Boolean)
          .slice(0, 8)
          .join("\n")
          .slice(0, 1200)
          .trim();

  const education = Array.isArray(analyzed.structured?.education)
    ? analyzed.structured.education
        .map((entry: any) => {
          const lines = String(entry?.content || "")
            .split(/\n+/)
            .map((line) => line.trim())
            .filter(Boolean);

          return {
            school: lines[0] || "",
            degree: lines[1] || "",
            start: "",
            end: "",
          };
        })
        .filter((entry) => entry.school || entry.degree)
    : [];

  const experience = Array.isArray(analyzed.structured?.experience)
    ? analyzed.structured.experience.flatMap((entry: any) =>
        splitExperienceContentIntoJobs(String(entry?.content || ""), analyzed.entities),
      )
    : [];

  const projects = Array.isArray(analyzed.structured?.projects)
    ? analyzed.structured.projects
        .map((entry: any) => {
          const lines = String(entry?.content || "")
            .split(/\n+/)
            .map((line) => line.trim())
            .filter(Boolean);

          return {
            name: lines[0] || "",
            organization: "",
            date: "",
            description: lines.slice(1).join("\n"),
          };
        })
        .filter((entry) => entry.name || entry.description)
    : [];

  const certifications = Array.isArray(analyzed.structured?.certifications)
    ? analyzed.structured.certifications
        .flatMap((entry: any) =>
          String(entry?.content || "")
            .split(/\n+/)
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => ({
              name: line,
              issuer: "",
              date: "",
              description: "",
            })),
        )
        .filter((entry) => entry.name)
    : [];

  const fallbackProfiles = (analyzed.urls || []).map(inferSocialProfileFromUrl);
  const fallbackWebsite = fallbackProfiles.find((p) => p.network === "Portfolio" || p.network === "Website")?.url || analyzed.urls?.[0] || "";

  return postProcessSectionLeakage({
    firstName: nameParts.firstName,
    lastName: nameParts.lastName,
    email: analyzed.emails[0] || "",
    phone: analyzed.phones[0] || "",
    location: "",
    jobTitle: analyzed.entities.titles[0] || "",
    experienceYears: null,
    about: summary,
    website: fallbackWebsite,
    profiles: fallbackProfiles,
    urls: analyzed.urls,
    skills: analyzed.skills,
    education,
    experience,
    projects,
    certifications,
  });
}

function extractEmbeddedSectionsFromDescription(desc: string): {
  cleanDesc: string;
  leakedEducation: Array<{ school: string; degree: string; start: string; end: string }>;
  leakedSkills: string[];
  leakedProjects: Array<{ name: string; organization: string; date: string; description: string }>;
  leakedCertifications: Array<{ name: string; issuer: string; date: string; description: string }>;
  leakedSummary: string;
} {
  const lines = desc.split(/\n+/);
  const cleanLines: string[] = [];
  const leakedEducation: Array<{ school: string; degree: string; start: string; end: string }> = [];
  const leakedSkills: string[] = [];
  const leakedProjects: Array<{ name: string; organization: string; date: string; description: string }> = [];
  const leakedCertifications: Array<{ name: string; issuer: string; date: string; description: string }> = [];
  let leakedSummary = "";

  type ActiveSection = "none" | "education" | "skills" | "projects" | "certifications" | "summary";
  let activeSection: ActiveSection = "none";
  let currentSectionLines: string[] = [];

  const flushSection = (section: ActiveSection, sLines: string[]) => {
    if (sLines.length === 0) return;
    const text = sLines.join("\n").trim();
    if (!text) return;

    if (section === "education") {
      const eduLines = sLines.map((l) => l.replace(/^[•*\-\d.]+\s*/, "").trim()).filter(Boolean);
      const school = eduLines[0] || "University";
      const degree = eduLines[1] || "Degree";
      const dateMatch = text.match(/\b((?:19|20)\d{2}(?:\s*[-—–]\s*(?:(?:19|20)\d{2}|Present))?)\b/i);
      leakedEducation.push({
        school,
        degree,
        start: dateMatch ? dateMatch[1].split(/[-—–]/)[0].trim() : "",
        end: dateMatch && dateMatch[1].includes("-") ? dateMatch[1].split(/[-—–]/)[1].trim() : "",
      });
    } else if (section === "skills") {
      const tokens = text
        .split(/[,•|/;\n]+/)
        .map((t) => t.replace(/^[*\-•\d.]+\s*/, "").trim())
        .filter((t) => t.length > 1 && t.length < 40 && !/^(skills|technical skills|technologies|tools)$/i.test(t));
      leakedSkills.push(...tokens);
    } else if (section === "projects") {
      const pLines = sLines.map((l) => l.trim()).filter(Boolean);
      const name = pLines[0]?.replace(/^[•*\-\d.]+\s*/, "").replace(/[:\-—|]+$/, "").trim() || "Project";
      const pDesc = pLines.slice(1).join("\n");
      leakedProjects.push({
        name,
        organization: "",
        date: "",
        description: pDesc,
      });
    } else if (section === "certifications") {
      const certLines = sLines.map((l) => l.trim()).filter(Boolean);
      for (const cl of certLines) {
        const cleanName = cl.replace(/^[•*\-\d.]+\s*/, "").trim();
        if (cleanName.length > 3) {
          leakedCertifications.push({
            name: cleanName,
            issuer: "",
            date: "",
            description: "",
          });
        }
      }
    } else if (section === "summary") {
      if (!leakedSummary) {
        leakedSummary = text;
      }
    }
  };

  const eduHeadingRegex = /^(?:#{1,3}\s*)?(?:education|academic(?:\s+background|\s+history|\s+qualifications)?|degrees?|qualifications|academic credentials)\b/i;
  const skillsHeadingRegex = /^(?:#{1,3}\s*)?(?:technical\s+|core\s+|key\s+)?(?:skills|technologies|tools|competencies|areas of expertise|tech stack)\b/i;
  const projectsHeadingRegex = /^(?:#{1,3}\s*)?(?:selected\s+|key\s+|personal\s+|academic\s+|recent\s+)?projects?\b/i;
  const certsHeadingRegex = /^(?:#{1,3}\s*)?(?:certifications?|certificates?|licenses?(?:\s+and\s+certifications)?|accreditations?)\b/i;
  const summaryHeadingRegex = /^(?:#{1,3}\s*)?(?:professional\s+|career\s+|executive\s+)?(?:summary|profile|about(?:\s+me)?|objective)\b/i;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (activeSection === "none") {
        cleanLines.push(line);
      }
      continue;
    }

    const clean = trimmed
      .replace(/^#{1,3}\s*/, "")
      .replace(/^[•*\-\d.]+\s*/, "")
      .replace(/[:\-—|]+$/, "")
      .trim();

    let newSection: ActiveSection | null = null;
    if (eduHeadingRegex.test(trimmed) || eduHeadingRegex.test(clean)) {
      newSection = "education";
    } else if (skillsHeadingRegex.test(trimmed) || skillsHeadingRegex.test(clean)) {
      newSection = "skills";
    } else if (projectsHeadingRegex.test(trimmed) || projectsHeadingRegex.test(clean)) {
      newSection = "projects";
    } else if (certsHeadingRegex.test(trimmed) || certsHeadingRegex.test(clean)) {
      newSection = "certifications";
    } else if (summaryHeadingRegex.test(trimmed) || summaryHeadingRegex.test(clean)) {
      newSection = "summary";
    }

    if (newSection) {
      if (activeSection !== "none") {
        flushSection(activeSection, currentSectionLines);
      }
      activeSection = newSection;
      currentSectionLines = [];
    } else {
      if (activeSection === "none") {
        // Also check if line has inline tech stack at the end of job
        const techMatch = trimmed.match(/^(?:Technologies|Tech Stack|Environment|Tools Used|Skills Used|Stack):\s*(.+)$/i);
        if (techMatch) {
          const tokens = techMatch[1]
            .split(/[,•|/;\n]+/)
            .map((t) => t.trim())
            .filter((t) => t.length > 1 && t.length < 40);
          leakedSkills.push(...tokens);
        } else {
          cleanLines.push(line);
        }
      } else {
        currentSectionLines.push(line);
      }
    }
  }

  if (activeSection !== "none") {
    flushSection(activeSection, currentSectionLines);
  }

  return {
    cleanDesc: cleanLines.join("\n").trim(),
    leakedEducation,
    leakedSkills,
    leakedProjects,
    leakedCertifications,
    leakedSummary,
  };
}

function postProcessSectionLeakage(data: ParsedProfileData): ParsedProfileData {
  const finalSkills = new Set<string>(data.skills || []);
  const cleanExperience: ParsedProfileData["experience"] = [];
  const cleanEducation: ParsedProfileData["education"] = [...(data.education || [])];
  const cleanProjects: ParsedProfileData["projects"] = [...(data.projects || [])];
  const cleanCertifications: ParsedProfileData["certifications"] = [...(data.certifications || [])];
  let cleanAbout = data.about || "";

  const academicRegex = /\b(bachelor|master|b\.?s\.?|m\.?s\.?|b\.?a\.?|m\.?a\.?|b\.?tech|m\.?tech|ph\.?d|degree|university|college|polytechnic|institute of technology|school of|academy|diploma|bootcamp|high school)\b/i;
  const facultyRoleRegex = /\b(professor|lecturer|research assistant|teaching assistant|adjunct|faculty|dean|fellow)\b/i;
  const skillHeadingRegex = /\b(skills|technical skills|technologies|tools|competencies|languages & frameworks|tech stack|areas of expertise)\b/i;
  const projectKeywordRegex = /^(?:project|personal project|side project|academic project|open source project|portfolio project|independent project|capstone project|hackathon)\b/i;
  const projectSuffixRegex = /\b(app|system|platform|website|bot|tool|extension|dashboard|api|game)\b/i;
  const certKeywordRegex = /\b(certified|certification|certificate|license|accredited|credential|aws certified|solutions architect|pmp|scrum master|scrummaster|comptia|ccna|cissp|itil)\b/i;
  const certAuthorityRegex = /^(?:Amazon Web Services|AWS|Google Cloud|Microsoft|Cisco|Scrum Alliance|CompTIA|Project Management Institute|PMI|Coursera|Udemy|edX|HackerRank|freeCodeCamp)\b/i;
  const summaryHeadingRegex = /^(?:professional summary|summary|profile|about me|career objective|executive summary)\b/i;

  for (const rawExp of data.experience || []) {
    const comp = (rawExp.company || "").trim();
    const tit = (rawExp.title || "").trim();
    const origDesc = (rawExp.description || "").trim();

    // 1. Extract embedded sections inside description
    const {
      cleanDesc,
      leakedEducation,
      leakedSkills,
      leakedProjects,
      leakedCertifications,
      leakedSummary,
    } = extractEmbeddedSectionsFromDescription(origDesc);

    for (const edu of leakedEducation) cleanEducation.push(edu);
    for (const sk of leakedSkills) finalSkills.add(sk);
    for (const pr of leakedProjects) cleanProjects.push(pr);
    for (const cr of leakedCertifications) cleanCertifications.push(cr);
    if (!cleanAbout && leakedSummary) cleanAbout = leakedSummary;

    const exp = {
      ...rawExp,
      description: cleanDesc,
    };

    // 2. Check if skills list leaked into experience as an item
    if (skillHeadingRegex.test(comp) || skillHeadingRegex.test(tit)) {
      const tokens = `${tit}, ${origDesc}`
        .split(/[,•|/;\n]+/)
        .map((t) => t.replace(/^[*\-•\d.]+\s*/, "").trim())
        .filter((t) => t.length > 1 && t.length < 40 && !skillHeadingRegex.test(t));
      for (const t of tokens) finalSkills.add(t);
      continue;
    }

    // 3. Check if degree/education leaked into experience as an item
    const isCompAcademic = academicRegex.test(comp);
    const isTitAcademic = academicRegex.test(tit);
    const isFaculty = facultyRoleRegex.test(tit);

    if ((isCompAcademic || isTitAcademic) && !isFaculty) {
      const school = isCompAcademic ? comp : tit;
      const degree = isTitAcademic && isCompAcademic ? tit : (!isCompAcademic ? comp : tit);
      cleanEducation.push({
        school: school || "University",
        degree: degree || "Degree",
        start: exp.startDate || "",
        end: exp.endDate || "",
      });
      continue;
    }

    // 4. Check if project leaked into experience as an item
    const isRepo = /github\.com|gitlab\.com|\.github\.io/i.test(comp) || /github\.com|gitlab\.com|\.github\.io/i.test(tit);
    const isExplicitProject =
      projectKeywordRegex.test(comp) ||
      projectKeywordRegex.test(tit) ||
      comp.toLowerCase().startsWith("project:") ||
      tit.toLowerCase().startsWith("project:") ||
      isRepo;
    const isAppProject =
      projectSuffixRegex.test(comp) &&
      /\b(?:creator|developer|author|contributor|owner|personal project|project lead|lead developer|builder|architect)\b/i.test(tit);

    if (isExplicitProject || isAppProject) {
      const name = projectKeywordRegex.test(tit)
        ? comp
        : (tit && !projectKeywordRegex.test(tit) ? tit : comp);
      cleanProjects.push({
        name: name.replace(/^project:\s*/i, "").trim() || "Project",
        organization: comp !== tit && !projectKeywordRegex.test(comp) ? comp : "",
        date: exp.startDate || exp.endDate || "",
        description: exp.description || "",
      });
      continue;
    }

    // 5. Check if certification leaked into experience as an item
    const isCert =
      (certKeywordRegex.test(tit) || certKeywordRegex.test(comp) || certAuthorityRegex.test(comp)) &&
      !facultyRoleRegex.test(tit) &&
      !/^(?:Senior|Staff|Principal|Lead)?\s*(?:Software Engineer|Engineer|Developer|Manager|Director)\b/i.test(tit);

    if (isCert) {
      cleanCertifications.push({
        name: tit || comp,
        issuer: comp !== tit ? comp : "",
        date: exp.startDate || exp.endDate || "",
        description: exp.description || "",
      });
      continue;
    }

    // 6. Check if summary leaked into experience as an item
    if (summaryHeadingRegex.test(comp) || summaryHeadingRegex.test(tit)) {
      if (!cleanAbout) {
        cleanAbout = exp.description || comp;
      }
      continue;
    }

    // Only keep real professional employment entries that have substance
    if (exp.company || exp.title || exp.description) {
      cleanExperience.push(exp);
    }
  }

  const finalEducation: ParsedProfileData["education"] = [];
  const jobTitleRegex = /\b(software engineer|developer|manager|director|analyst|designer|consultant|architect|lead|administrator)\b/i;

  for (const edu of cleanEducation) {
    const deg = (edu.degree || "").trim();
    const sch = (edu.school || "").trim();

    if (jobTitleRegex.test(deg) && !academicRegex.test(deg) && !academicRegex.test(sch)) {
      cleanExperience.push({
        company: sch,
        title: deg,
        location: "",
        startDate: edu.start || "",
        endDate: edu.end || "",
        description: "",
      });
      continue;
    }

    finalEducation.push(edu);
  }

  return {
    ...data,
    about: cleanAbout,
    skills: Array.from(finalSkills).filter(Boolean),
    experience: cleanExperience,
    education: finalEducation,
    projects: cleanProjects,
    certifications: cleanCertifications,
  };
}

// Helper to ensure data matches the interface (sanitize nulls etc)
export function sanitizeParsedProfileData(raw: any): ParsedProfileData {
    const record = raw && typeof raw === "object" ? raw : {};
    const str = (v: any) => typeof v === 'string' ? v.trim() : "";
    const num = (v: any) => typeof v === 'number' ? v : null;
    const arr = (v: any) => Array.isArray(v) ? v.filter(i => typeof i === 'string') : [];

    const sanitizeProfiles = (items: any): Array<{ network: string; url: string; username?: string }> => {
      if (!Array.isArray(items)) return [];
      return items
        .map((it: any) => {
          if (!it || typeof it !== "object") return null;
          const url = str(it.url);
          if (!url) return null;
          const inferred = inferSocialProfileFromUrl(url);
          return {
            network: str(it.network) || inferred.network,
            url: inferred.url,
            username: str(it.username) || inferred.username,
          };
        })
        .filter(Boolean) as Array<{ network: string; url: string; username?: string }>;
    };

    const legacyBasics =
      record.basics && typeof record.basics === "object" ? record.basics : null;
    const legacySummary =
      record.summary && typeof record.summary === "object" ? record.summary : null;
    const legacySections =
      record.sections && typeof record.sections === "object" ? record.sections : null;

    if (legacyBasics || legacySections || legacySummary) {
        const { firstName, lastName } = splitFullName(str(legacyBasics?.name));
        const legacyExperience = Array.isArray(legacySections?.experience?.items)
          ? legacySections.experience.items
          : [];
        const legacyEducation = Array.isArray(legacySections?.education?.items)
          ? legacySections.education.items
          : [];
        const legacySkills = Array.isArray(legacySections?.skills?.items)
          ? legacySections.skills.items
          : [];

        const legacyProfiles = sanitizeProfiles(legacyBasics?.profiles);
        if (legacyProfiles.length === 0 && legacyBasics?.website?.url) {
          legacyProfiles.push(inferSocialProfileFromUrl(legacyBasics.website.url));
        }

        const legacyProfile: ParsedProfileData = {
            firstName,
            lastName,
            email: str(legacyBasics?.email),
            phone: str(legacyBasics?.phone),
            location: str(legacyBasics?.location),
            jobTitle: str(legacyBasics?.headline),
            experienceYears: null,
            about: str(legacySummary?.content),
            website: str(legacyBasics?.website?.url),
            profiles: legacyProfiles,
            urls: legacyProfiles.map((p) => p.url),
            skills: legacySkills
              .map((item: any) => str(item?.name))
              .filter(Boolean),
            education: legacyEducation.map((item: any) => {
              const { start, end } = parseLegacyRange(
                str(item?.date || item?.period),
              );
              return {
                school: str(item?.school || item?.company || item?.institution),
                degree: str(item?.degree || item?.title || item?.name),
                start,
                end,
              };
            }).filter((item: { school: string; degree: string }) => item.school || item.degree),
            experience: legacyExperience.map((item: any) => {
              const { start, end } = parseLegacyRange(
                str(item?.date || item?.period),
              );
              return {
                company: str(item?.company),
                title: str(item?.position || item?.title || item?.name),
                location: str(item?.location),
                startDate: start,
                endDate: end,
                description: str(item?.summary || item?.description),
              };
            }).filter((item: { company: string; title: string; description: string }) =>
              item.company || item.title || item.description,
            ),
            projects: Array.isArray(legacySections?.projects?.items)
              ? legacySections.projects.items.map((item: any) => ({
                  name: str(item?.name || item?.title),
                  organization: str(item?.company || item?.organization),
                  date: str(item?.date || item?.period),
                  description: str(item?.description),
                })).filter((item: any) => item.name || item.description)
              : [],
            certifications: Array.isArray(legacySections?.certifications?.items)
              ? legacySections.certifications.items.map((item: any) => ({
                  name: str(item?.name || item?.title),
                  issuer: str(item?.issuer || item?.company || item?.organization),
                  date: str(item?.date || item?.period),
                  description: str(item?.description),
                })).filter((item: any) => item.name)
              : [],
        };
        return postProcessSectionLeakage(legacyProfile);
    }

    let modernProfiles = sanitizeProfiles(raw.profiles);
    if (modernProfiles.length === 0 && Array.isArray(raw.urls)) {
      modernProfiles = raw.urls.map(str).filter(Boolean).map(inferSocialProfileFromUrl);
    }
    const modernWebsite = str(raw.website) || modernProfiles.find((p) => p.network === "Portfolio" || p.network === "Website")?.url || "";

    const modernProfile: ParsedProfileData = {
        firstName: str(raw.firstName || raw.first_name),
        lastName: str(raw.lastName || raw.last_name),
        email: str(raw.email),
        phone: str(raw.phone),
        location: str(raw.location),
        jobTitle: str(raw.jobTitle || raw.job_title),
        experienceYears: num(raw.experienceYears || raw.experience_years),
        about: str(raw.about),
        website: modernWebsite,
        profiles: modernProfiles,
        urls: modernProfiles.map((p) => p.url),
        skills: arr(raw.skills),
        education: Array.isArray(raw.education) ? raw.education.map((e: any) => ({
            school: str(e.school),
            degree: str(e.degree),
            start: str(e.start || e.start_date),
            end: str(e.end || e.end_date)
        })) : [],
        experience: Array.isArray(raw.experience) ? raw.experience.map((e: any) => ({
            company: str(e.company),
            title: str(e.title),
            location: str(e.location),
            startDate: str(e.startDate || e.start_date),
            endDate: str(e.endDate || e.end_date),
            description: str(e.description)
        })) : [],
        projects: Array.isArray(raw.projects) ? raw.projects.map((p: any) => ({
            name: str(p.name || p.title),
            organization: str(p.organization || p.company),
            date: str(p.date || p.period),
            description: str(p.description)
        })).filter((p: any) => p.name || p.description) : [],
        certifications: Array.isArray(raw.certifications) ? raw.certifications.map((c: any) => ({
            name: str(c.name || c.title),
            issuer: str(c.issuer || c.organization || c.company),
            date: str(c.date || c.period),
            description: str(c.description)
        })).filter((c: any) => c.name) : []
    };

    return postProcessSectionLeakage(modernProfile);
}

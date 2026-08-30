import type {
  Profile,
  ProfileEducationRecord,
  ProfileExperienceRecord,
  ProfileSkillRecord,
} from "@/hooks/useProfileSettings";
import type {
  CoverLetterState,
  ResumeData,
  ResumeProfile,
  ResumeSectionItem,
} from "@/store/artboard";
import { getResumeSourceType, withResumeSource } from "@/lib/resumeDocumentSchema";

export interface CandidateProfileSnapshot {
  name: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  summary: string;
  profiles: ResumeProfile[];
  experience: ResumeSectionItem[];
  education: ResumeSectionItem[];
  skills: ResumeSectionItem[];
  projects: ResumeSectionItem[];
  certifications: ResumeSectionItem[];
  languages: ResumeSectionItem[];
}

interface CandidateProfileSnapshotInput {
  profile: Profile | null;
  email?: string;
  experiences?: ProfileExperienceRecord[];
  education?: ProfileEducationRecord[];
  skills?: ProfileSkillRecord[];
}

const clean = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const formatPeriod = (start: unknown, end: unknown, current = false) => {
  const startValue = clean(start);
  const endValue = current ? "Present" : clean(end);
  return [startValue, endValue].filter(Boolean).join(" - ");
};

const skillLevel = (value: ProfileSkillRecord["level"] | null | undefined) => {
  if (!value) return 0;
  if (value === "Beginner") return 1;
  if (value === "Intermediate") return 2;
  if (value === "Advanced") return 4;
  if (value === "Expert") return 5;
  return 0;
};

const profileLink = (
  network: "GitHub" | "LinkedIn",
  url: unknown,
  username: unknown,
): ResumeProfile | null => {
  const cleanUrl = clean(url);
  if (!cleanUrl) return null;
  return {
    network,
    username: clean(username),
    url: cleanUrl,
    icon: network.toLowerCase(),
  };
};

export function buildCandidateProfileSnapshot({
  profile,
  email = "",
  experiences = [],
  education = [],
  skills = [],
}: CandidateProfileSnapshotInput): CandidateProfileSnapshot {
  const github = profile?.github_data ?? {};
  const linkedin = profile?.linkedin_data ?? {};
  const links = [
    profileLink(
      "GitHub",
      github.profile_url ?? profile?.github_url,
      github.username,
    ),
    profileLink(
      "LinkedIn",
      linkedin.profile_url ?? profile?.linkedin_url,
      linkedin.name,
    ),
  ].filter((item): item is ResumeProfile => Boolean(item));

  const currentTitle =
    experiences.find((item) => item.is_current)?.title ?? experiences[0]?.title;
  const repositories = Array.isArray(github.top_repositories)
    ? github.top_repositories
    : [];
  const topLanguages = Array.isArray(github.top_languages)
    ? github.top_languages
    : [];
  const skillNames = [...skills.map((item) => item.name), ...topLanguages]
    .map(clean)
    .filter(Boolean)
    .filter((value, index, values) =>
      values.findIndex((candidate) => candidate.toLowerCase() === value.toLowerCase()) === index
    );

  return {
    name: `${clean(profile?.first_name)} ${clean(profile?.last_name)}`.trim(),
    headline: clean(profile?.job_title) || clean(linkedin.headline) || clean(currentTitle),
    email: clean(email),
    phone: clean(profile?.phone),
    location: clean(profile?.location) || clean(linkedin.location),
    summary: clean(linkedin.summary) || clean(github.bio),
    profiles: links,
    experience: experiences.map((item) => ({
      id: `profile-experience-${item.id}`,
      hidden: false,
      company: clean(item.company),
      position: clean(item.title),
      title: clean(item.title),
      location: clean(item.location),
      period: formatPeriod(item.start_date, item.end_date, item.is_current),
      date: formatPeriod(item.start_date, item.end_date, item.is_current),
      description: clean(item.description),
    })),
    education: education.map((item) => ({
      id: `profile-education-${item.id}`,
      hidden: false,
      school: clean(item.school),
      degree: clean(item.degree),
      location: clean(item.location),
      period: formatPeriod(item.start_date, item.end_date),
      date: formatPeriod(item.start_date, item.end_date),
      gpa: clean(item.gpa),
    })),
    skills: skillNames.map((name) => ({
      id: `profile-skill-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      hidden: false,
      name,
      level: skillLevel(
        skills.find((item) => item.name.toLowerCase() === name.toLowerCase())?.level ?? null,
      ),
      keywords: [],
    })),
    projects: repositories.map((repository: Record<string, unknown>, index: number) => ({
      id: `github-project-${repository.id == null ? index : String(repository.id)}`,
      hidden: false,
      name: clean(repository.name),
      title: clean(repository.name),
      description: clean(repository.description),
      website: {
        url: clean(repository.url ?? repository.html_url),
        label: "GitHub",
      },
    })).filter((item: ResumeSectionItem) => Boolean(item.name)),
    certifications: [],
    languages: topLanguages.map((name: unknown) => ({
      id: `github-language-${clean(name).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      hidden: false,
      name: clean(name),
    })).filter((item: ResumeSectionItem) => Boolean(item.name)),
  };
}

const isBlankOrDefault = (value: string | undefined, fallback: string | undefined) => {
  const normalized = clean(value).toLowerCase();
  return !normalized || normalized === clean(fallback).toLowerCase();
};

const sectionIsUntouched = (
  current: ResumeSectionItem[],
  fallback: ResumeSectionItem[],
) => current.length === 0 || JSON.stringify(current) === JSON.stringify(fallback);

export function fillResumeFromCandidateProfile(
  current: ResumeData,
  defaults: ResumeData,
  snapshot: CandidateProfileSnapshot,
): ResumeData {
  const next = structuredClone(current);
  const basicFields = ["name", "headline", "email", "phone", "location"] as const;

  for (const field of basicFields) {
    if (
      snapshot[field] &&
      isBlankOrDefault(current.basics[field], defaults.basics[field])
    ) {
      next.basics[field] = snapshot[field];
    }
  }

  const existingNetworks = new Set(
    (current.basics.profiles ?? []).map((item) => item.network.toLowerCase()),
  );
  const missingProfiles = snapshot.profiles.filter(
    (item) => !existingNetworks.has(item.network.toLowerCase()),
  );
  if (missingProfiles.length) {
    next.basics.profiles = [...(current.basics.profiles ?? []), ...missingProfiles];
  }

  if (
    snapshot.summary &&
    isBlankOrDefault(current.summary.content, defaults.summary.content)
  ) {
    next.summary.content = snapshot.summary;
    next.summary.hidden = false;
  }

  const mappedSections = {
    experience: snapshot.experience,
    education: snapshot.education,
    skills: snapshot.skills,
    projects: snapshot.projects,
    certifications: snapshot.certifications,
    languages: snapshot.languages,
  };

  for (const [sectionId, items] of Object.entries(mappedSections)) {
    const currentSection = current.sections[sectionId];
    const defaultSection = defaults.sections[sectionId];
    if (
      items.length &&
      currentSection &&
      sectionIsUntouched(currentSection.items, defaultSection?.items ?? [])
    ) {
      next.sections[sectionId] = {
        ...next.sections[sectionId],
        hidden: false,
        items,
      };
    }
  }

  const changed = JSON.stringify(next) !== JSON.stringify(current);
  const currentSource = getResumeSourceType(current);
  return changed && (currentSource === "template" || currentSource === "legacy")
    ? withResumeSource(next, "profile")
    : next;
}

export function fillCoverLetterSenderFromCandidateProfile(
  current: CoverLetterState["sender"],
  snapshot: CandidateProfileSnapshot,
): CoverLetterState["sender"] {
  return {
    name: clean(current.name) || snapshot.name,
    email: clean(current.email) || snapshot.email,
    phone: clean(current.phone) || snapshot.phone,
    address: clean(current.address) || snapshot.location,
  };
}

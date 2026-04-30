import { parsePdfFile } from "@/utils/parsePdf";
import {
  buildFallbackParsedProfileData,
  parseResumeWithAI,
  type ParsedProfileData,
  sanitizeParsedProfileData,
} from "@/services/ai/parseResumeProfile";

type SupabaseLikeClient = any;

type PersistParsedResumeInput = {
  supabase: SupabaseLikeClient;
  resumeId: string;
  userId: string | null | undefined;
  rawText: string;
  json: Record<string, unknown>;
  structured?: unknown;
  skills?: string[];
  embedding?: unknown;
};

type LoadParsedResumeTextInput = {
  supabase: SupabaseLikeClient;
  resumeId: string;
  filePath?: string | null;
  fileExt?: string | null;
};

type ParsedResumeSnapshot = {
  id?: string;
  raw_text: string;
  json?: Record<string, unknown> | null;
  structured?: unknown;
  skills?: string[] | null;
  extracted_at?: string;
};

type LoadParsedResumeProfileInput = {
  supabase: SupabaseLikeClient;
  resumeId: string;
  fallbackName?: string | null;
};

let parsedResumesTableState: "unknown" | "available" | "missing" = "unknown";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mergeParsedProfileData(
  base: ParsedProfileData,
  incoming: ParsedProfileData,
): ParsedProfileData {
  return {
    ...base,
    firstName: incoming.firstName || base.firstName,
    lastName: incoming.lastName || base.lastName,
    email: incoming.email || base.email,
    phone: incoming.phone || base.phone,
    location: incoming.location || base.location,
    jobTitle: incoming.jobTitle || base.jobTitle,
    experienceYears:
      incoming.experienceYears ?? base.experienceYears ?? null,
    about: incoming.about || base.about,
    skills: incoming.skills.length > 0 ? incoming.skills : base.skills,
    education:
      incoming.education.length > 0 ? incoming.education : base.education,
    experience:
      incoming.experience.length > 0 ? incoming.experience : base.experience,
    projects:
      incoming.projects.length > 0 ? incoming.projects : base.projects,
    certifications:
      incoming.certifications.length > 0
        ? incoming.certifications
        : base.certifications,
  };
}

function coerceSkillList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function snapshotToParsedProfileData(
  snapshot: ParsedResumeSnapshot,
  fallbackName?: string | null,
): ParsedProfileData | null {
  const rawText = typeof snapshot.raw_text === "string" ? snapshot.raw_text : "";
  const fallback = buildFallbackParsedProfileData(rawText, fallbackName || undefined);
  const jsonRecord = isRecord(snapshot.json) ? snapshot.json : null;
  const aiParsedData = jsonRecord?.aiParsedData;

  let profileData = fallback;

  if (isRecord(aiParsedData)) {
    profileData = mergeParsedProfileData(
      fallback,
      sanitizeParsedProfileData(aiParsedData),
    );
  }

  if (!profileData.about) {
    const structuredRecord = isRecord(snapshot.structured)
      ? snapshot.structured
      : null;
    const summary = structuredRecord?.summary;
    if (typeof summary === "string" && summary.trim()) {
      profileData.about = summary.trim();
    }
  }

  if (profileData.skills.length === 0) {
    const skills = coerceSkillList(snapshot.skills);
    if (skills.length > 0) {
      profileData.skills = skills;
    }
  }

  const hasContent =
    Boolean(profileData.firstName || profileData.lastName) ||
    Boolean(profileData.email || profileData.phone || profileData.location) ||
    Boolean(profileData.jobTitle || profileData.about) ||
    profileData.skills.length > 0 ||
    profileData.education.length > 0 ||
    profileData.experience.length > 0;

  return hasContent ? profileData : null;
}

function hasStoredAiParsedData(snapshot: ParsedResumeSnapshot) {
  const jsonRecord = isRecord(snapshot.json) ? snapshot.json : null;
  return isRecord(jsonRecord?.aiParsedData);
}

export function isParsedResumesMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const record = error as Record<string, unknown>;
  const code = typeof record.code === "string" ? record.code : "";
  const message = typeof record.message === "string" ? record.message : "";
  const hint = typeof record.hint === "string" ? record.hint : "";

  return (
    code === "PGRST205" ||
    code === "42P01" ||
    /parsed_resumes/i.test(message) ||
    /parsed_resumes/i.test(hint)
  );
}

async function parseResumeFromStorage(
  supabase: SupabaseLikeClient,
  filePath?: string | null,
  fileExt?: string | null,
): Promise<string> {
  if (!filePath || fileExt?.toLowerCase() !== "pdf") {
    return "";
  }

  const { data, error } = await supabase.storage
    .from("resumes")
    .createSignedUrl(filePath, 60);

  if (error || !data?.signedUrl) {
    throw error || new Error("Failed to create a signed URL for the resume.");
  }

  const response = await fetch(data.signedUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch resume file (${response.status}).`);
  }

  const blob = await response.blob();
  const file = new File([blob], `resume.${fileExt}`, {
    type: response.headers.get("content-type") || "application/pdf",
  });
  const parsed = await parsePdfFile(file);
  return parsed.text;
}

export async function loadParsedResumeText({
  supabase,
  filePath,
  fileExt,
}: LoadParsedResumeTextInput): Promise<string> {
  try {
    return await parseResumeFromStorage(supabase, filePath, fileExt);
  } catch (error) {
    console.error("load resume text fallback failed", error);
    return "";
  }
}

export async function loadParsedResumeProfileData({
  supabase,
  resumeId,
  fallbackName,
}: LoadParsedResumeProfileInput): Promise<ParsedProfileData | null> {
  if (parsedResumesTableState === "missing") {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from("parsed_resumes")
      .select("id, raw_text, json, structured, skills, extracted_at")
      .eq("resume_id", resumeId)
      .order("extracted_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    parsedResumesTableState = "available";
    let parsedProfile = snapshotToParsedProfileData(
      data as ParsedResumeSnapshot,
      fallbackName,
    );

    const snapshot = data as ParsedResumeSnapshot;
    if (!hasStoredAiParsedData(snapshot) && snapshot.raw_text.trim()) {
      try {
        const aiParsedData = await parseResumeWithAI({
          resumeText: snapshot.raw_text,
        });

        parsedProfile = parsedProfile
          ? mergeParsedProfileData(parsedProfile, aiParsedData)
          : aiParsedData;

        if (snapshot.id) {
          const jsonRecord = isRecord(snapshot.json) ? snapshot.json : {};
          const nextJson = { ...jsonRecord, aiParsedData };
          await supabase
            .from("parsed_resumes")
            .update({
              json: nextJson,
              skills: aiParsedData.skills.length > 0
                ? aiParsedData.skills
                : snapshot.skills,
            })
            .eq("id", snapshot.id);
        }
      } catch (enrichmentError) {
        console.warn(
          "load parsed resume profile AI enrichment failed",
          enrichmentError,
        );
      }
    }

    return parsedProfile;
  } catch (error) {
    if (isParsedResumesMissingTableError(error)) {
      parsedResumesTableState = "missing";
      return null;
    }

    console.error("load parsed resume profile failed", error);
    return null;
  }
}

export async function persistParsedResume({
  supabase,
  resumeId,
  userId,
  rawText,
  json,
  structured,
  skills,
  embedding,
}: PersistParsedResumeInput): Promise<boolean> {
  if (!userId || parsedResumesTableState === "missing") {
    return false;
  }

  try {
    const { error } = await supabase.from("parsed_resumes").insert({
      resume_id: resumeId,
      user_id: userId,
      raw_text: rawText,
      json,
      structured,
      skills,
      embedding,
    });

    if (error) throw error;
    parsedResumesTableState = "available";
    return true;
  } catch (error) {
    if (isParsedResumesMissingTableError(error)) {
      parsedResumesTableState = "missing";
      return false;
    }
    throw error;
  }
}

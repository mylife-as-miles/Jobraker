import { parsePdfFile } from "@/utils/parsePdf";

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

let parsedResumesTableState: "unknown" | "available" | "missing" = "unknown";

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

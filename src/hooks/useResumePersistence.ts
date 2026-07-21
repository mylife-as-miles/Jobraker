import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ResumeData } from "@/store/artboard";
import { createClient } from "@/lib/supabaseClient";

export interface SavedResumeRecord {
  id: string;
  updated_at: string;
}

export async function updateResumeRecord(
  supabase: SupabaseClient,
  resumeId: string,
  data: ResumeData,
): Promise<SavedResumeRecord> {
  const updatedAt = new Date().toISOString();
  const { data: saved, error } = await supabase
    .from("resumes")
    .update({
      data,
      name: data.title,
      slug: data.slug,
      tags: data.tags,
      updated_at: updatedAt,
    })
    .eq("id", resumeId)
    .select("id, updated_at")
    .maybeSingle();

  if (error) throw error;
  if (!saved?.id) {
    throw new Error("Resume was not updated. Refresh the page and verify that you still have access.");
  }

  return {
    id: String(saved.id),
    updated_at: String(saved.updated_at || updatedAt),
  };
}

export function useResumePersistence(resumeId?: string | null) {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

  const save = useCallback(async (data: ResumeData) => {
    if (!resumeId) throw new Error("Save this resume to your library before editing it.");
    const saved = await updateResumeRecord(supabase, resumeId, data);
    await queryClient.invalidateQueries({ queryKey: ["resume", resumeId] });
    return saved;
  }, [queryClient, resumeId, supabase]);

  return { save } as const;
}

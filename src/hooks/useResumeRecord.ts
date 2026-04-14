import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabaseClient";

export interface ResumeRecordDetail {
  id: string;
  name: string | null;
  slug?: string | null;
  tags?: string[] | null;
  template?: string | null;
  updated_at?: string | null;
  public_share_enabled?: boolean | null;
  views?: number | null;
  downloads?: number | null;
  data?: Record<string, unknown> | null;
}

export function useResumeRecord(resumeId?: string | null) {
  const supabase = useMemo(() => createClient(), []);

  return useQuery({
    queryKey: ["resume", resumeId],
    enabled: Boolean(resumeId),
    staleTime: 60 * 1000,
    queryFn: async (): Promise<ResumeRecordDetail> => {
      const { data, error } = await (supabase as any)
        .from("resumes")
        .select("*")
        .eq("id", resumeId)
        .single();

      if (error) {
        throw error;
      }

      return data as ResumeRecordDetail;
    },
  });
}

import type { ResumeDto, UpdateResumeDto } from "@reactive-resume/dto";
import { useMutation } from "@tanstack/react-query";
import { createClient } from "@/lib/supabaseClient";

// Tiny debounce helper to avoid extra dependency
const debounce = <F extends (...args: any[]) => any>(fn: F, wait = 500) => {
  let t: any;
  return (...args: Parameters<F>) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
};

import { queryClient } from "@/client/libs/query-client";

export const updateResume = async (data: UpdateResumeDto) => {
  const supabase = createClient();

  const payload: any = {
    updated_at: new Date().toISOString(),
  };

  if (data.name) payload.name = data.name;
  if (data.slug) payload.slug = data.slug;
  if (data.data) payload.data = data.data;

  const { data: updatedResume, error } = await supabase
    .from("resumes")
    .update(payload)
    .eq("id", data.id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  const normalizedResponse = {
    ...updatedResume,
    data: updatedResume.data || data.data // Fallback to sent data if DB returns null, though select should return it
  } as ResumeDto;

  queryClient.setQueryData<ResumeDto>(["resume", { id: normalizedResponse.id }], normalizedResponse);

  queryClient.setQueryData<ResumeDto[]>(["resumes"], (cache) => {
    if (!cache) return [normalizedResponse];
    return cache.map((resume) => {
      if (resume.id === normalizedResponse.id) return normalizedResponse;
      return resume;
    });
  });

  return normalizedResponse;
};

export const debouncedUpdateResume = debounce(updateResume, 500);

export const useUpdateResume = () => {
  const {
    error,
    isPending: loading,
    mutateAsync: updateResumeFn,
  } = useMutation({
    mutationFn: updateResume,
  });

  return { updateResume: updateResumeFn, loading, error };
};

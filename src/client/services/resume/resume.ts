import type { ResumeDto } from "@reactive-resume/dto";
import { createClient } from "@/lib/supabaseClient";

export const findResumeById = async (data: { id: string }) => {
  const supabase = createClient();
  const { data: resume, error } = await supabase
    .from("resumes")
    .select("*")
    .eq("id", data.id)
    .single();

  if (error) throw new Error(error.message);

  // Ensure compatibility with ResumeDto
  // If the DB record doesn't have a 'data' column (flat structure), we wrap it or provide a default.
  // The builder expects a 'data' object with 'sections', 'basics', etc.
  return {
    ...resume,
    data: resume.data || {
      basics: { name: resume.name, email: "", phone: "", location: {}, profiles: [] },
      sections: {
        summary: { name: "Summary", columns: 1, visible: true, id: "summary" },
        education: { name: "Education", columns: 1, visible: true, id: "education", items: [] },
        experience: { name: "Experience", columns: 1, visible: true, id: "experience", items: [] },
        skills: { name: "Skills", columns: 1, visible: true, id: "skills", items: [] },
        projects: { name: "Projects", columns: 1, visible: true, id: "projects", items: [] },
        awards: { name: "Awards", columns: 1, visible: true, id: "awards", items: [] },
      },
      metadata: { template: resume.template || "pikachu", layout: {} }
    }
  } as unknown as ResumeDto;
};

export const findResumeByUsernameSlug = async (data: { username: string; slug: string }) => {
  // Keep placeholder or implement similar logic if needed
  throw new Error("Not implemented");
};

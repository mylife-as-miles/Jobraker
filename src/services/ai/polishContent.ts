import { createClient } from "@/lib/supabaseClient";

export interface Suggestion {
  id: string;
  type: 'enhancement' | 'correction' | 'professional';
  label: string;
  isRecommended?: boolean;
  content: string;
  original: string;
}

const supabase = createClient();

export async function polishContent(content: string, instruction?: string): Promise<Suggestion[]> {
  if (!content || !content.trim()) {
    throw new Error("Content is required");
  }

  try {
    const { data, error } = await supabase.functions.invoke('polish-content', {
      body: { content, instruction }
    });

    if (error) {
       console.error("Polish function error:", error);
       throw new Error(error.message || "Failed to polish content");
    }

    if (!data || !data.suggestions) throw new Error("No suggestions returned from AI");

    // Add original text back to suggestions for context
    return data.suggestions.map((s: any) => ({
        ...s,
        original: content
    }));

  } catch (err: any) {
    console.error("Polish service error:", err);
    throw new Error(`Failed to polish content: ${err.message || err}`);
  }
}

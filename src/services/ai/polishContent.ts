import { invokeProtectedFunction } from "../supabase/invokeProtectedFunction";

export interface Suggestion {
  id: string;
  type: 'enhancement' | 'correction' | 'professional';
  label: string;
  isRecommended?: boolean;
  content: string;
  original: string;
}

export async function polishContent(content: string, instruction?: string): Promise<Suggestion[]> {
  if (!content || !content.trim()) {
    throw new Error("Content is required");
  }

  try {
    const data = await invokeProtectedFunction<{ suggestions?: Suggestion[] }>('polish-content', {
      body: { content, instruction }
    });

    if (!data || !data.suggestions) throw new Error("No suggestions returned from AI");

    // Add original text back to suggestions for context
    return data.suggestions.map((s: any) => ({
        ...s,
        original: content
    }));

  } catch (err: any) {
    console.error("Polish service error:", err);
    const msg = err?.message || "Failed to polish content. Please try again.";
    throw new Error(msg);
  }
}

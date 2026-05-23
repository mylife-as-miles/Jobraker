import { invokeProtectedFunction } from "../supabase/invokeProtectedFunction";

export type ChatStarterIcon =
  | "resume"
  | "jobs"
  | "interview"
  | "cover-letter"
  | "applications"
  | "strategy";

export interface ChatStarterSuggestion {
  id: string;
  title: string;
  description: string;
  prompt: string;
  icon: ChatStarterIcon;
}

export async function generateChatStarters(): Promise<
  ChatStarterSuggestion[]
> {
  const data = await invokeProtectedFunction<{
    suggestions?: ChatStarterSuggestion[];
  }>("generate-chat-starters");

  if (!Array.isArray(data?.suggestions) || data.suggestions.length === 0) {
    throw new Error("No chat suggestions were returned.");
  }

  return data.suggestions;
}

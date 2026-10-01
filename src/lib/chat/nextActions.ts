// Next-step buttons shown under the latest assistant answer. The ai-chat
// function sends them as a `next_actions` stream event; each button sends its
// prompt as the user's next message. Mirrors normalizeNextActions in
// backend/supabase/functions/ai-chat/index.ts.

export interface NextAction {
  label: string;
  prompt: string;
}

export const MAX_NEXT_ACTIONS = 6;

const clean = (value: unknown) =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";

export function normalizeNextActions(value: unknown): NextAction[] {
  const items = Array.isArray(value)
    ? value
    : value && typeof value === "object" && Array.isArray((value as { actions?: unknown }).actions)
      ? (value as { actions: unknown[] }).actions
      : [];

  const seen = new Set<string>();
  const actions: NextAction[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const prompt = clean((item as { prompt?: unknown }).prompt);
    const label = (clean((item as { label?: unknown }).label) || prompt).replace(/[.!?:;,]+$/, "");
    if (label.length < 2 || label.length > 80) continue;
    if (prompt.length < 4 || prompt.length > 600) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    actions.push({ label, prompt });
    if (actions.length >= MAX_NEXT_ACTIONS) break;
  }
  return actions;
}

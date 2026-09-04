/**
 * Formats a follow-up question so that it is always phrased in the first person
 * from the USER'S perspective as a prompt or question to ask the AI assistant.
 *
 * Example transformations:
 * - "Would you like me to try sending this again in a few hours once the limit refreshes?"
 *   -> "Can you try sending this again in a few hours once the limit refreshes?"
 * - "Should I generate a more detailed cover letter tailored specifically to Startrz Ai's recent projects?"
 *   -> "Can you generate a more detailed cover letter tailored specifically to Startrz Ai's recent projects?"
 * - "Would you like me to draft a follow-up email for you?"
 *   -> "Can you draft a follow-up email for me?"
 * - "Shall I tailor your resume for this role?"
 *   -> "Can you tailor my resume for this role?"
 */
export function formatAsFirstPersonUserQuestion(raw: unknown): string {
  if (typeof raw !== "string") return "";
  let q = raw.trim().replace(/\s+/g, " ");

  // Remove leading bullet points, numbers, or dashes
  q = q.replace(/^[-*•\d.)\s]+/, "").trim();

  // Strip leading conditionals like "If you'd like, I can..." or "If you want, I can..."
  q = q.replace(/^if\s+you(?:'d|\s+would)?\s+like(?:,\s*|\s+)(?:i\s+can\s+)?/i, "Can you ");
  q = q.replace(/^if\s+you\s+want(?:,\s*|\s+)(?:i\s+can\s+)?/i, "Can you ");

  // 1. "Would you like me to [try sending/generate/etc.]..." -> "Can you [try sending/generate/etc.]..."
  const aiOfferMePattern = /^(?:would you like me to|would you like for me to|do you want me to|shall i|should i|can i|could i|may i)\s+/i;
  if (aiOfferMePattern.test(q)) {
    q = q.replace(aiOfferMePattern, "Can you ");
  }
  // 2. "Want me to [verb]..." -> "Can you [verb]..."
  else if (/^want me to\s+/i.test(q)) {
    q = q.replace(/^want me to\s+/i, "Can you ");
  }
  // 3. "Let me know if you('d| would)? like me to [verb]..." -> "Can you [verb]..."
  else if (/^let me know if you(?:'d| would)? like me to\s+/i.test(q)) {
    q = q.replace(/^let me know if you(?:'d| would)? like me to\s+/i, "Can you ");
  }
  // 4. "Let me [verb] for you..." -> "Can you [verb]..."
  else if (/^let me\s+/i.test(q)) {
    q = q.replace(/^let me\s+/i, "Can you ");
  }
  // 5. "Shall we [verb]..." -> "Can we [verb]..."
  else if (/^shall we\s+/i.test(q)) {
    q = q.replace(/^shall we\s+/i, "Can we ");
  }
  // 6. "I can (also )?help you [verb]..." -> "Can you help me [verb]..."
  else if (/^i can\s+(?:also\s+)?help you\s+(?:to\s+)?/i.test(q)) {
    q = q.replace(/^i can\s+(?:also\s+)?help you\s+(?:to\s+)?/i, "Can you help me ");
  }
  else if (/^i can\s+(?:also\s+)?(?:to\s+)?/i.test(q)) {
    q = q.replace(/^i can\s+(?:also\s+)?(?:to\s+)?/i, "Can you ");
  }
  // 7. "Would you like to see/view/know/explore..." -> "Can you show me..." / "Can we explore..."
  else if (/^(?:would you like to|do you want to)\s+see\s+/i.test(q)) {
    q = q.replace(/^(?:would you like to|do you want to)\s+see\s+/i, "Can you show me ");
  }
  else if (/^(?:would you like to|do you want to)\s+view\s+/i.test(q)) {
    q = q.replace(/^(?:would you like to|do you want to)\s+view\s+/i, "Can you show me ");
  }
  else if (/^(?:would you like to|do you want to)\s+know\s+/i.test(q)) {
    q = q.replace(/^(?:would you like to|do you want to)\s+know\s+/i, "Can you tell me ");
  }
  else if (/^(?:would you like to|do you want to)\s+explore\s+/i.test(q)) {
    q = q.replace(/^(?:would you like to|do you want to)\s+explore\s+/i, "Can we explore ");
  }
  else if (/^(?:would you like to|do you want to)\s+/i.test(q)) {
    q = q.replace(/^(?:would you like to|do you want to)\s+/i, "Can you help me ");
  }

  // Adjust object pronouns and possessives from the user's perspective
  // (e.g. "for you" -> "for me", "your resume" -> "my resume")
  q = q
    .replace(/\b(help|give|send|tell|show|email|message|alert|remind|assist|provide|notify)\s+you\b/gi, "$1 me")
    .replace(/\bfor you\b/gi, "for me")
    .replace(/\bwith you\b/gi, "with me")
    .replace(/\bto you\b/gi, "to me")
    .replace(/\byourself\b/gi, "myself")
    .replace(/\byours\b/gi, "mine")
    .replace(/\byour\b/gi, "my");

  // Ensure first letter is capitalized
  q = q.charAt(0).toUpperCase() + q.slice(1);

  // Ensure it ends with ? if it starts with an interrogative word
  if (/^(can|could|should|would|how|what|why|where|when|who|is|are|do|does|will)\b/i.test(q)) {
    if (!q.endsWith("?")) {
      q = q.replace(/[.!]+$/, "") + "?";
    }
  }

  return q;
}

export function normalizeFollowUpQuestions(
  value: unknown,
  maxCount = 2,
): string[] {
  const candidates = Array.isArray(value)
    ? value
    : value && typeof value === "object" && Array.isArray((value as any).questions)
      ? (value as any).questions
      : [];

  const seen = new Set<string>();
  return candidates
    .filter((item): item is string => typeof item === "string")
    .map((item) => formatAsFirstPersonUserQuestion(item))
    .filter((item) => item.length >= 10 && item.length <= 260)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, maxCount);
}

export function stripCodeFences(text: string): string {
  return text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

export function extractJsonCandidate(text: string): string {
  const cleaned = stripCodeFences(text);
  const objectStart = cleaned.indexOf("{");
  const objectEnd = cleaned.lastIndexOf("}");

  if (objectStart !== -1 && objectEnd > objectStart) {
    return cleaned.slice(objectStart, objectEnd + 1);
  }

  if (objectStart !== -1) {
    return cleaned.slice(objectStart);
  }

  return cleaned;
}

function removeTrailingCommas(text: string): string {
  return text.replace(/,\s*([}\]])/g, "$1");
}

function closeLikelyTruncatedJson(text: string): string {
  const cleaned = text.trim();
  if (!cleaned) return cleaned;

  const closers: string[] = [];
  let inString = false;
  let escaping = false;

  for (const char of cleaned) {
    if (escaping) {
      escaping = false;
      continue;
    }

    if (inString && char === "\\") {
      escaping = true;
      continue;
    }

    if (char === "\"") {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === "{") {
      closers.push("}");
      continue;
    }

    if (char === "[") {
      closers.push("]");
      continue;
    }

    if ((char === "}" || char === "]") && closers.length > 0) {
      const expected = closers[closers.length - 1];
      if (char === expected) {
        closers.pop();
      }
    }
  }

  let repaired = cleaned;
  if (inString) repaired += "\"";
  if (closers.length > 0) repaired += closers.reverse().join("");
  return repaired;
}

export function parseStructuredJson<T = Record<string, unknown>>(
  text: string,
): T {
  const base = stripCodeFences(text);
  const extracted = extractJsonCandidate(text);
  const candidates = [
    base,
    extracted,
    removeTrailingCommas(base),
    removeTrailingCommas(extracted),
    closeLikelyTruncatedJson(base),
    closeLikelyTruncatedJson(extracted),
    removeTrailingCommas(closeLikelyTruncatedJson(base)),
    removeTrailingCommas(closeLikelyTruncatedJson(extracted)),
  ];
  const tried = new Set<string>();
  const errors: string[] = [];

  for (const candidate of candidates) {
    if (!candidate || tried.has(candidate)) continue;
    tried.add(candidate);
    try {
      return JSON.parse(candidate) as T;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error || "Unknown error");
      errors.push(message);
    }
  }

  const uniqueErrors = [...new Set(errors)].slice(0, 3).join(" | ");
  throw new SyntaxError(
    uniqueErrors
      ? `Unable to parse structured JSON response. ${uniqueErrors}`
      : "Unable to parse structured JSON response.",
  );
}

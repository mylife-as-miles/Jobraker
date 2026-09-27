// Minimal HTML to text for job descriptions. Greenhouse returns HTML-escaped
// HTML, so entities are decoded before and after stripping tags.
const decode = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");

export function htmlToText(html: unknown): string {
  const raw = decode(String(html ?? ""));
  return decode(
    raw
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<\/(p|div|li|h[1-6])>|<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

// FNV-1a over the row's content (not its sync bookkeeping), used to skip
// writes for jobs that have not changed since the last sync.
export function contentHash(row: Record<string, unknown>): string {
  const { last_seen_at: _a, status: _b, closed_at: _c, ...content } = row;
  // Sort top-level keys only; a key list passed to JSON.stringify would also
  // drop nested keys (for example question labels) from the hash.
  const text = Object.keys(content).sort().map((k) => `${k}=${JSON.stringify(content[k])}`).join("|");
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `fnv1a:${h.toString(16)}:${text.length}`;
}

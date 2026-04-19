/**
 * Parse LinkedIn "Connections.csv" (or similar) export.
 * Handles quoted fields and common header variants.
 */

export type ParsedLinkedInConnection = {
  first_name: string;
  last_name: string;
  email: string;
  company: string;
  position: string;
  connected_on: string | null;
  profile_url: string;
  raw: Record<string, string>;
};

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((cell) => cell.trim().length > 0)) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  row.push(field);
  if (row.some((cell) => cell.trim().length > 0)) rows.push(row);
  return rows;
}

function normHeader(h: string): string {
  return h
    .trim()
    .replace(/^\ufeff/, "")
    .replace(/^"|"$/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function pick(row: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return "";
}

export function parseLinkedInConnectionsCsv(text: string): ParsedLinkedInConnection[] {
  const grid = parseCsvRows(text.replace(/\r\n/g, "\n").replace(/\r/g, "\n"));
  if (grid.length < 2) return [];

  const headerCells = grid[0].map((h) => normHeader(h));
  const headerMap: Record<string, number> = {};
  headerCells.forEach((h, idx) => {
    headerMap[h] = idx;
  });

  const get = (cells: string[], ...aliases: string[]): string => {
    for (const a of aliases) {
      const idx = headerMap[normHeader(a)];
      if (idx != null && cells[idx] != null) {
        const v = cells[idx].trim().replace(/^"|"$/g, "");
        if (v) return v;
      }
    }
    return "";
  };

  const out: ParsedLinkedInConnection[] = [];
  for (let r = 1; r < grid.length; r++) {
    const cells = grid[r];
    if (!cells.length) continue;
    const raw: Record<string, string> = {};
    headerCells.forEach((h, i) => {
      if (cells[i] != null) raw[h] = cells[i].trim();
    });

    const first_name = get(cells, "first name", "firstname");
    const last_name = get(cells, "last name", "lastname");
    const email = get(cells, "email address", "email");
    const company = get(cells, "company");
    const position = get(cells, "position", "title", "job title");
    const connected_raw = get(cells, "connected on");
    const profile_url = get(cells, "url", "profile url", "linkedin url");

    if (!first_name && !last_name && !email && !company && !position) continue;

    out.push({
      first_name,
      last_name,
      email,
      company,
      position,
      connected_on: connected_raw || null,
      profile_url,
      raw,
    });
  }
  return out;
}

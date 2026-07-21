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

export type LinkedInCsvInspection = {
  rows: ParsedLinkedInConnection[];
  headers: string[];
  mapping: LinkedInCsvColumnMap;
  headerRow: number;
  delimiter: "," | ";" | "\t";
  duplicateCount: number;
  invalidCount: number;
  warnings: string[];
};

export type LinkedInCsvField =
  | "first_name"
  | "last_name"
  | "email"
  | "company"
  | "position"
  | "connected_on"
  | "profile_url";

export type LinkedInCsvColumnMap = Partial<Record<LinkedInCsvField, string>>;

function parseCsvRows(text: string, delimiter: string): string[][] {
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
    } else if (c === delimiter) {
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

function detectDelimiter(text: string): LinkedInCsvInspection["delimiter"] {
  const sample = text.slice(0, 16_384);
  const counts = { ",": 0, ";": 0, "\t": 0 };
  let inQuotes = false;
  for (let i = 0; i < sample.length; i++) {
    if (sample[i] === '"') {
      if (inQuotes && sample[i + 1] === '"') i++;
      else inQuotes = !inQuotes;
    } else if (!inQuotes && sample[i] in counts) {
      counts[sample[i] as keyof typeof counts]++;
    }
  }
  return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || ",") as LinkedInCsvInspection["delimiter"];
}

function normHeader(h: string): string {
  return h
    .trim()
    .replace(/^\ufeff/, "")
    .replace(/^"|"$/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

const HEADER_ALIASES = new Set([
  "first name", "firstname", "last name", "lastname", "email address", "email",
  "company", "position", "title", "job title", "connected on", "url", "profile url", "linkedin url",
]);

const FIELD_ALIASES: Record<LinkedInCsvField, string[]> = {
  first_name: ["first name", "firstname"],
  last_name: ["last name", "lastname"],
  email: ["email address", "email"],
  company: ["company", "organization", "employer"],
  position: ["position", "title", "job title"],
  connected_on: ["connected on", "connection date"],
  profile_url: ["url", "profile url", "linkedin url"],
};

function connectionIdentity(row: ParsedLinkedInConnection) {
  const url = row.profile_url.trim().toLowerCase().replace(/\/+$/, "");
  if (url) return `url:${url}`;
  const email = row.email.trim().toLowerCase();
  if (email) return `email:${email}`;
  return `person:${[row.first_name, row.last_name, row.company, row.position]
    .map((value) => value.trim().toLowerCase()).join("|")}`;
}

export function inspectLinkedInConnectionsCsv(
  text: string,
  requestedMapping: LinkedInCsvColumnMap = {},
): LinkedInCsvInspection {
  const normalizedText = text.replace(/^\ufeff/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const delimiter = detectDelimiter(normalizedText);
  const grid = parseCsvRows(normalizedText, delimiter);
  const warnings: string[] = [];
  if (grid.length < 2) {
    return { rows: [], headers: [], mapping: {}, headerRow: -1, delimiter, duplicateCount: 0, invalidCount: 0, warnings: ["The file does not contain data rows."] };
  }

  let headerIndex = grid.slice(0, 15).findIndex((cells) =>
    cells.map(normHeader).filter((header) => HEADER_ALIASES.has(header)).length >= 2
  );
  if (headerIndex < 0) {
    headerIndex = grid.slice(0, 15).findIndex((cells) => cells.length >= 3);
    if (headerIndex >= 0) warnings.push("Header names were not recognized. Review the column mapping before importing.");
  }
  if (headerIndex < 0) {
    return { rows: [], headers: [], mapping: {}, headerRow: -1, delimiter, duplicateCount: 0, invalidCount: grid.length, warnings: ["Could not find a LinkedIn Connections header row."] };
  }
  if (headerIndex > 0) warnings.push(`Skipped ${headerIndex} introductory row(s) before the CSV header.`);

  const headerCells = grid[headerIndex].map((h) => normHeader(h));
  const headerMap: Record<string, number> = {};
  headerCells.forEach((h, idx) => {
    headerMap[h] = idx;
  });

  const mapping = (Object.keys(FIELD_ALIASES) as LinkedInCsvField[]).reduce(
    (result, field) => {
      const requested = normHeader(requestedMapping[field] || "");
      if (requested && headerMap[requested] != null) {
        result[field] = requested;
        return result;
      }
      const detected = FIELD_ALIASES[field].find((alias) => headerMap[normHeader(alias)] != null);
      if (detected) result[field] = normHeader(detected);
      return result;
    },
    {} as LinkedInCsvColumnMap,
  );

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

  const getField = (cells: string[], field: LinkedInCsvField) => {
    const mapped = mapping[field];
    return mapped ? get(cells, mapped) : get(cells, ...FIELD_ALIASES[field]);
  };

  const out: ParsedLinkedInConnection[] = [];
  let invalidCount = 0;
  let duplicateCount = 0;
  const identities = new Set<string>();
  for (let r = headerIndex + 1; r < grid.length; r++) {
    const cells = grid[r];
    if (!cells.length) continue;
    const raw: Record<string, string> = {};
    headerCells.forEach((h, i) => {
      if (cells[i] != null) raw[h] = cells[i].trim();
    });

    const first_name = getField(cells, "first_name");
    const last_name = getField(cells, "last_name");
    const email = getField(cells, "email");
    const company = getField(cells, "company");
    const position = getField(cells, "position");
    const connected_raw = getField(cells, "connected_on");
    const profile_url = getField(cells, "profile_url");

    if (!first_name && !last_name && !email && !company && !position && !profile_url) {
      invalidCount++;
      continue;
    }

    const connection = {
      first_name,
      last_name,
      email,
      company,
      position,
      connected_on: connected_raw || null,
      profile_url,
      raw,
    };
    const identity = connectionIdentity(connection);
    if (identities.has(identity)) {
      duplicateCount++;
      continue;
    }
    identities.add(identity);
    out.push(connection);
  }
  if (duplicateCount) warnings.push(`${duplicateCount} duplicate row(s) will be skipped.`);
  if (invalidCount) warnings.push(`${invalidCount} empty or invalid row(s) will be skipped.`);
  return { rows: out, headers: headerCells, mapping, headerRow: headerIndex, delimiter, duplicateCount, invalidCount, warnings };
}

export function parseLinkedInConnectionsCsv(text: string): ParsedLinkedInConnection[] {
  return inspectLinkedInConnectionsCsv(text).rows;
}

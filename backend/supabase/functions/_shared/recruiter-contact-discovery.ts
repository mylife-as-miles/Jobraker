export type RecruiterRoleKind =
  | "recruiter"
  | "hiring_manager"
  | "team_lead"
  | "director"
  | "employee"
  | "unknown";

export interface RecruiterSearchItem {
  url: string;
  title: string;
  description: string;
  markdown: string;
  sourceQuery: string;
}

export interface RecruiterDiscoveryContext {
  company: string;
  jobTitle: string;
  teamKeywords: string[];
  officialDomain: string;
}

export interface NormalizedRecruiterContact {
  fullName: string;
  title: string;
  roleKind: RecruiterRoleKind;
  linkedinUrl: string;
  linkedinSourceUrl: string;
  workEmail: string;
  emailStatus: "source_verified" | "provider_verified";
  emailConfidence: number;
  emailSourceUrl: string;
  relevanceScore: number;
  evidence: Array<Record<string, unknown>>;
  safeToContact: true;
}

const asString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const compact = (value: unknown, maxLength = 500) =>
  asString(value).replace(/\s+/g, " ").slice(0, maxLength);

const normalizeHost = (value: string) => {
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
};

const registrableDomain = (host: string) => {
  const parts = host.toLowerCase().split(".").filter(Boolean);
  if (parts.length <= 2) return parts.join(".");
  const lastTwo = parts.slice(-2).join(".");
  const countrySuffixes = new Set([
    "co.uk", "org.uk", "com.au", "net.au", "co.nz", "co.jp", "co.in",
    "com.br", "com.ng", "co.za",
  ]);
  return countrySuffixes.has(lastTwo)
    ? parts.slice(-3).join(".")
    : lastTwo;
};

const domainsCompatible = (left: string, right: string) =>
  Boolean(left && right && registrableDomain(left) === registrableDomain(right));

const companyTokens = (company: string) =>
  company.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(/\s+/)
    .filter((token) => token.length >= 3 && ![
      "inc", "llc", "ltd", "limited", "company", "group", "technologies",
    ].includes(token));

const sourceText = (item: RecruiterSearchItem) =>
  `${item.title}\n${item.description}\n${item.markdown}`.trim();

const extractEmails = (value: string) => Array.from(new Set(
  (value.match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+/gi) || [])
    .map((email) => email.toLowerCase().replace(/[),.;:]+$/, "")),
));

const isGenericRecruitmentInbox = (email: string) =>
  /^(?:jobs?|careers?|recruit(?:ing|ment)?|talent|hiring|hr|people)(?:[._+-].*)?@/i.test(email);

export function inferRecruiterRoleKind(title: string): RecruiterRoleKind {
  const value = title.toLowerCase();
  if (/hiring manager/.test(value)) return "hiring_manager";
  if (/recruit|talent acquisition|talent partner|people partner|sourcer/.test(value)) {
    return "recruiter";
  }
  if (/team lead|engineering manager|product manager|design manager| manager\b|lead\b/.test(value)) {
    return "team_lead";
  }
  if (/director|head of|vice president|\bvp\b|chief|founder/.test(value)) {
    return "director";
  }
  return title.trim() ? "employee" : "unknown";
}

const roleScore = (kind: RecruiterRoleKind) => ({
  hiring_manager: 98,
  recruiter: 94,
  team_lead: 88,
  director: 82,
  employee: 58,
  unknown: 0,
})[kind];

const calculateRelevance = (
  title: string,
  evidence: string,
  context: RecruiterDiscoveryContext,
) => {
  const roleKind = inferRecruiterRoleKind(title);
  const lower = evidence.toLowerCase();
  const teamMatches = context.teamKeywords.filter((keyword) =>
    keyword.toLowerCase().split(/\s+/).some((part) => part.length > 2 && lower.includes(part))
  ).length;
  return Math.min(100, roleScore(roleKind) + Math.min(8, teamMatches * 3));
};

const escapeQueryValue = (value: string) =>
  value.replace(/["\\]/g, " ").replace(/\s+/g, " ").trim();

export function buildRecruiterSearchQueries(context: RecruiterDiscoveryContext) {
  const company = escapeQueryValue(context.company);
  const role = escapeQueryValue(context.jobTitle);
  const domain = escapeQueryValue(context.officialDomain);
  const team = context.teamKeywords.map(escapeQueryValue).filter(Boolean).slice(0, 4)
    .map((value) => `"${value}"`).join(" OR ") || `"${role}"`;
  const peopleRoles = '(recruiter OR "talent acquisition" OR "talent partner" OR "hiring manager" OR "head of" OR director OR lead)';

  return {
    officialDiscovery: `"${company}" official website careers jobs`,
    linkedInRecruiters: `site:linkedin.com/in/ "${company}" (${team}) (recruiter OR "talent acquisition" OR "talent partner" OR sourcer)`,
    linkedInManagers: `site:linkedin.com/in/ "${company}" (${team}) ("hiring manager" OR founder OR manager OR lead OR director OR "head of")`,
    officialPeople: domain
      ? `site:${domain} ${peopleRoles} (${team})`
      : `"${company}" ${peopleRoles} (${team}) -site:linkedin.com`,
    publicPeople: `"${company}" ${peopleRoles} (${team}) -site:linkedin.com`,
    publicEmails: domain
      ? `"${company}" ${peopleRoles} "@${domain}" -site:linkedin.com`
      : `"${company}" ${peopleRoles} (email OR contact) -site:linkedin.com`,
  };
}

function parseNamedRole(item: RecruiterSearchItem) {
  const candidates = [item.title, compact(item.description, 300)];
  for (const candidate of candidates) {
    const match = candidate.match(
      /^\s*([A-Z][A-Za-z'’.-]+(?:\s+[A-Z][A-Za-z'’.-]+){1,3})\s*(?:[-–—|,]|\bis\b)\s*(?:an?\s+)?([^|\n.]{3,160})/,
    );
    if (!match) continue;
    const fullName = compact(match[1], 120);
    const title = compact(match[2]
      .replace(/\s+(?:at|for)\s+.+$/i, "")
      .replace(/\s*\|.*$/, ""), 160);
    const roleKind = inferRecruiterRoleKind(title);
    if (roleKind !== "employee" && roleKind !== "unknown") {
      return { fullName, title, roleKind };
    }
  }
  return null;
}

export function extractPublishedRecruiterContacts(
  items: RecruiterSearchItem[],
  context: RecruiterDiscoveryContext,
): NormalizedRecruiterContact[] {
  const contacts: NormalizedRecruiterContact[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const evidence = sourceText(item);
    if (!companyTokens(context.company).some((token) => evidence.toLowerCase().includes(token))) {
      continue;
    }
    const person = parseNamedRole(item);
    if (!person) continue;
    const email = extractEmails(evidence).find((candidate) => {
      const domain = candidate.split("@")[1] || "";
      return !isGenericRecruitmentInbox(candidate) &&
        domainsCompatible(domain, context.officialDomain);
    });
    if (!email || seen.has(email)) continue;
    seen.add(email);
    const sourceHost = normalizeHost(item.url);
    contacts.push({
      fullName: person.fullName,
      title: person.title,
      roleKind: person.roleKind,
      linkedinUrl: "",
      linkedinSourceUrl: "",
      workEmail: email,
      emailStatus: "source_verified",
      emailConfidence: domainsCompatible(sourceHost, context.officialDomain) ? 0.98 : 0.88,
      emailSourceUrl: item.url,
      relevanceScore: calculateRelevance(person.title, evidence, context),
      evidence: [{
        type: "published_public_work_email",
        sourceUrl: item.url,
        sourceQuery: item.sourceQuery,
        excerpt: compact(evidence, 450),
      }],
      safeToContact: true,
    });
  }
  return contacts.sort((left, right) => right.relevanceScore - left.relevanceScore);
}

const providerRows = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  for (const value of [record.contacts, record.people, record.results, record.data]) {
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") {
      const nested = value as Record<string, unknown>;
      for (const rows of [nested.contacts, nested.people, nested.results]) {
        if (Array.isArray(rows)) return rows;
      }
    }
  }
  return [];
};

export function normalizeContactProviderContacts(
  payload: unknown,
  context: RecruiterDiscoveryContext & { providerUrl: string },
): NormalizedRecruiterContact[] {
  const contacts: NormalizedRecruiterContact[] = [];
  const seen = new Set<string>();
  for (const raw of providerRows(payload)) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const email = asString(row.email || row.work_email || row.workEmail).toLowerCase();
    const fullName = asString(row.full_name || row.fullName || row.name);
    const title = asString(row.title || row.job_title || row.position);
    const status = asString(row.status || row.email_status || row.verdict).toLowerCase();
    const catchAll = row.catch_all === true || row.is_catch_all === true ||
      row.accept_all === true || /catch.?all|accept.?all/.test(status);
    const verified = row.valid === true || row.deliverable === true ||
      ["valid", "verified", "deliverable", "safe", "ok"].includes(status);
    const emailDomain = email.split("@")[1] || "";
    const roleKind = inferRecruiterRoleKind(title);
    if (!email || !fullName || !title || catchAll || !verified ||
      !domainsCompatible(emailDomain, context.officialDomain) ||
      roleKind === "employee" || roleKind === "unknown" || seen.has(email)) {
      continue;
    }
    seen.add(email);
    const rawConfidence = Number(row.confidence ?? row.score ?? 0.92);
    const confidence = Number.isFinite(rawConfidence)
      ? Math.min(0.99, Math.max(0.5, rawConfidence > 1 ? rawConfidence / 100 : rawConfidence))
      : 0.92;
    const profileUrl = asString(row.linkedin_url || row.linkedinUrl || row.profile_url || row.profileUrl);
    contacts.push({
      fullName,
      title,
      roleKind,
      linkedinUrl: /linkedin\.com\/in\//i.test(profileUrl) ? profileUrl : "",
      linkedinSourceUrl: /linkedin\.com\/in\//i.test(profileUrl) ? profileUrl : "",
      workEmail: email,
      emailStatus: "provider_verified",
      emailConfidence: confidence,
      emailSourceUrl: context.providerUrl,
      relevanceScore: calculateRelevance(title, `${fullName} ${title}`, context),
      evidence: [{
        type: "contact_provider_verified",
        provider: context.providerUrl,
        profileUrl: profileUrl || undefined,
      }],
      safeToContact: true,
    });
  }
  return contacts.sort((left, right) => right.relevanceScore - left.relevanceScore);
}

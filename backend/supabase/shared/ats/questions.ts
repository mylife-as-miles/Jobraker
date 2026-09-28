// Maps free-text application question labels to canonical profile keys.
// Rules come from the 149-form census (docs/ATS_PLATFORM_RESEARCH.md).
// Order matters: specific rules before general ones.

const RULES: Array<[string, RegExp]> = [
  ["first_name", /^(legal )?first name|^given name/],
  ["preferred_name", /preferred (first )?name|name you'?d prefer/],
  ["last_name", /^(legal )?last name|^surname|^family name/],
  ["email", /^e-?mail/],
  ["phone", /phone|mobile number/],
  ["resume", /resume|\bcv\b|curriculum/],
  ["cover_letter", /cover letter|motivation letter/],
  ["linkedin", /linkedin/],
  ["github", /github/],
  ["website_portfolio", /website|portfolio|personal site|blog/],
  ["work_authorization", /authori[sz]ed to work|legally (authori|eligible|permitted)|right to work|work permit|eligib\w* to work|work authori[sz]ation/],
  ["sponsorship", /sponsor/],
  ["current_salary", /current (salary|compensation|ctc|pay|base)|currently (earn|paid)|current and expected ctc/],
  ["expected_salary", /(expected|desired|target) (salary|compensation|pay|ctc)|salary (range|requirement|expectation)|compensation expectation/],
  ["notice_period", /notice period|how soon|earliest start|start date|when can you start|available to start/],
  ["relocation", /relocat/],
  ["onsite_hybrid", /in[- ]office|on[- ]?site|hybrid|commute|days (a|per) week in/],
  ["country_residence", /country (in which|where) you (are located|currently reside|reside)|country of residence|which country|currently located in/],
  ["work_country", /countr(y|ies) you (anticipate|intend|plan) (working|to work)|from where do you intend to work/],
  ["location_current", /where are you (currently )?(located|based)|current location|^city|^location\b|time ?zone|zip|postal code/],
  ["years_experience", /years of (professional |relevant )?experience|how many years/],
  ["how_heard", /how did you hear|hear about|where did you (find|see|learn)/],
  ["referred_by", /referred by|employee referral|who referred/],
  ["previously_employed", /previously (worked|employed)|former employee|ever (been employed|worked) (by|for)|worked for \w+ before|employed by \w+/],
  ["employee_relationship", /relationships? (with|to) (current )?\w* ?employees|personal\/familial relationship/],
  ["why_company", /why (are you interested|do you want|us\b|this (role|company))|what (interests|excites|draws) you/],
  ["pronouns", /pronoun/],
  ["language", /speak|language|fluen|english proficiency/],
  ["age_18", /18 years|over 18|age of 18|legal age/],
  ["background_check", /background check|criminal|convicted/],
  ["security_clearance", /clearance/],
  ["non_compete", /non-?compete|restrictive covenant/],
  ["accommodation", /accommodation|accessible and inclusive/],
  ["future_openings_optin", /email me about future|future (job )?openings/],
  ["truth_certification", /certify that|facts set forth|true and complete/],
  ["privacy_consent", /privacy|consent|gdpr|data (processing|retention)|acknowledg/],
  ["government_official", /government official|public official|politically exposed/],
  ["education", /degree|university|school|education|graduat/],
  ["employer_current", /current (or (most recent|previous) )?(employer|company)|most recent (employer|company)/],
  ["title_current", /current (or previous )?(job )?title|current role|current position/],
];

export const normalizeLabel = (label: unknown): string =>
  String(label ?? "")
    .replace(/<[^>]+>/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

export function classifyQuestion(label: unknown): string | null {
  const text = normalizeLabel(label);
  if (!text) return null;
  for (const [key, re] of RULES) {
    if (re.test(text)) return key;
  }
  return null;
}

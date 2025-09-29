# Agent Implementation Roadmap (Living Document)

_Last updated: 2025-09-29_

This document captures forward-looking implementation tracks, priorities, conventions, and actionable next steps for the development agent. Treat it as a living roadmap. Keep entries atomic and prune completed items instead of letting them accumulate.

---
## 1. Strategic Themes
| Theme | Goal | Examples |
|-------|------|----------|
| Conversion & Activation | Faster path to first successful auto apply | Onboarding clarity, resume parse success guardrails |
| Retention & Habit | Encourage repeat engagement & progress | Streaks, insights dashboard |
| Data Quality & Enrichment | Turn unstructured inputs into structured intelligence | Resume parsing validation, skill frequency mapping |
| Differentiation | Go beyond automation into augmentation | Tailored letter v2, role fit scoring |
| Operational Robustness | Avoid future fire drills | Migration linting, observability, validation layers |
| Growth & Virality | Organic loops & social proof | Shareable progress card, referrals |

---
## 2. Immediate Next Sprint (Suggested)
Balanced 10–12 day scope:
1. Core analytics event scaffold + log key funnel events. (IN PROGRESS)
2. Resume versioning (hashing + rollback UI skeleton).
3. Resume versioning (hashing + rollback UI skeleton).
4. Tailored Cover Letter Generator v2 (prompt + fact-check layer).
5. Supabase schema → generated TypeScript types + Zod validation for parsed resume object.
6. Migration filename & drift lint script + docs (`docs/migrations.md`).
7. Skill frequency insight card on profile (top extracted vs. underrepresented vs. target roles).

Stretch: Application outcome tagging + success ratio widget.

---
## 3. Quick Wins (≤ 1 Day Each)
- Add skeleton loaders: job list, resume parse preview.
- Optimistic auto-apply queue shrink (animate instead of sudden removal).
- Clipboard utility: copy application status summary.
- Last-used resume persisted (`localStorage:lastResumeId`).
- Focus & a11y polish: ensure actionable EmptyState buttons tabbable & ARIA labeled.
- Hidden debug toggle (`localStorage.debugParse = true`) to surface raw parse JSON.
- Timestamp footers per profile section (last edited).

---
## 4. Medium Impact (1–2 Days)
- Resume version ledger (store: id, sha256, created_at, diff metadata).
- Skill intelligence aggregation (global frequency across parsed resumes & job descriptions).
- Inline tailoring suggestions (heuristics: missing quantification, tense normalization).
- Smart job filtering heuristics (closed/outdated detection).
- Soft delete for applied jobs + undo toast (5s window).
- Feature flag JSON loader (`config/flags.json` + hook).
- Tests for parsing/analyzer modules (baseline regression suite).

---
## 5. High Leverage (1–2 Weeks)
1. Tailored Cover Letter Generator v2
   - Inputs: resume structured data, job description text, optional user tone preference.
   - Flow: derive key match points → prompt → generate → fact-check (reject hallucinated skills) → user edits → export.
2. Application Outcome Loop
   - User marks outcome (Interview / Rejected / No Response). Feed model/heuristics for improvement suggestions.
3. Semantic Job De-duplication
   - Similarity scoring (title + company + location + compensation tokens) → cluster & collapse duplicates.
4. Multi-Resume Strategy
   - Resume tags (e.g., "Data", "Frontend"). Auto-suggest best match based on skill overlap score.
5. AI Resume Gap Analyzer
   - Compare parsed resume vs. target role archetype (skills taxonomy). Suggest adding missing competencies / projects.
6. Notification Layer (digest & event-based). Weekly progress summary.

---
## 6. Growth & Virality Concepts
- Shareable job search progress card (OG image or PNG generation).
- Referral link: unlock a parsing enhancement both sides.
- Public mini profile (privacy-safe, optional) with skill cloud & application count.

---
## 7. Data & Insight Layer
| Insight | Inputs | Output | Surfacing |
|---------|--------|--------|-----------|
| Skill Frequency | Parsed resume tokens | Ranked list | Profile sidebar card |
| Gap Heatmap | Target role archetype vs. resume | Missing skills table | Gap analyzer page |
| Application Funnel | Applications table events | Conversion % & step times | Dashboard widget |
| Time Saved | (avg manual mins) * applied count | Hours saved metric | Marketing / hero |
| Next Best Action | Rules: incomplete sections, low skills count | Single CTA | Dashboard top |

---
## 8. Observability & Ops
- Analytics abstraction `analytics.ts` with no-op fallback.
- Error boundary wrapper on resume parsing & auto apply orchestration.
- Logging schema: { area, action, context, duration_ms?, error? }.
- Performance marks around parse pipeline (TTR – time-to-result).

---
## 9. Validation & Types
- Generate Supabase types command (documented in README snippet).
- Zod schemas: resumeParsed, experienceEntry, educationEntry, socials.
- Runtime guard before persisting parse results.

---
## 10. Migrations Governance
- Naming rule: `YYYYMMDDHHMMSS_description.sql`.
- Lint script checks:
  - Chronological ordering (timestamp > previous).
  - No gaps larger than configurable threshold (alert, not fail).
  - No duplicate description segments.
- Drift check: run `supabase db diff` in CI; fail if unexpected statements.
- Document recovery steps (already partially handled – expand into `docs/migrations.md`).

---
## 11. Component Extraction Plan
| Component | Source | Destination | Notes |
|-----------|--------|-------------|-------|
| (DONE) EmptyState | ProfilePage.tsx | `src/components/ui/empty-state.tsx` | Extracted & unified |
| SkeletonList | (create) | `src/components/ui/skeleton-list.tsx` | Generic rows placeholder |
| AnimatedQueue | (create) | `src/components/automation/animated-queue.tsx` | For auto-apply job progress |
| SkillTagCloud | (create) | `src/components/insights/skill-tag-cloud.tsx` | Highlight top vs. missing |

---
## 12. Cover Letter Generator v2 (Detailed Contract)
- Inputs: { resumeData, jobDescription, preferences?, existingDraft? }
- Steps:
  1. Extract job requirement clusters (regex + embeddings later).
  2. Map resume achievements to clusters.
  3. Build prompt with structured sections.
  4. Generate draft (AI or heuristic stub first).
  5. Fact-check pass: remove claims not present in resumeData.
  6. User edit session (local state diff tracked).
  7. Export (txt, pdf, docx, copy, share – reuse existing modal infra).
- Output: { draftHtml, sectionsMeta, removedUnsupportedClaims[] }.
- Error Modes: parse_failure, generation_timeout, fact_check_conflict.

---
## 13. Resume Versioning (Contract)
- Table: resume_versions (id, profile_id FK, storage_path, sha256, parsed_snapshot JSONB, created_at, parent_id nullable).
- On upload:
  - Compute sha256; if identical to latest → short-circuit.
  - Store new row; optional diff summary (lines added/removed approximated via text segmentation).
- Rollback Action: Set active_resume_id pointer on profile (or local selection state) without deleting history.

---
## 14. Skill Frequency Insight
- Aggregation: Count occurrences from parsed resume sections + job descriptions user viewed/applied.
- Classification buckets: Core (high frequency), Emerging (mid), Underrepresented (desired but absent), Missing (common in applied job set but absent).
- Visualization: segmented bar or tag clusters with intensity.

---
## 15. Analytics Event Catalog (Initial)
| Event | When | Properties |
|-------|------|------------|
| signup_started | Landing → onboarding start | referrer? experiment? |
| resume_uploaded | File accepted | size_kb, extension, hash_prefix |
| resume_parsed_success | Parse pipeline completes | duration_ms, skills_count, education_count |
| resume_parsed_failure | Exception thrown | error_type |
| profile_completed | onboarding_complete flips true | time_since_signup_ms |
| auto_apply_started | User initiates | job_count, resume_id |
| auto_apply_job_success | Per job | job_id, source, duration_ms |
| auto_apply_job_failed | Per job | job_id, source, error_type |
| auto_apply_finished | All processed | success_count, fail_count |
| cover_letter_generated | Generation completes | method=v2, factcheck_removed_count |
| outcome_tagged | User tags result | job_id, outcome |

---
## 16. Feature Flag Strategy
- File: `config/flags.json` (loaded at build + optionally refreshed client-side).
- Shape: `{ "tailoredCoverLetterV2": true, "skillFrequencyInsight": false }`.
- Hook: `useFlag(key)` with suspense fallback optional.

---
## 17. Risk & Mitigation
| Risk | Impact | Mitigation |
|------|--------|------------|
| Migration drift | Schema mismatch prod vs. local | Lint + CI diff |
| Parse false positives | Polluted insights | Zod validation + fact-check layer |
| AI hallucination in letters | User trust loss | Fact-check removal log & warnings |
| Rapid job source changes | Broken auto-apply | Abstraction & retry/backoff |
| Performance regressions | Slow onboarding | Perf marks + basic web vitals emit |

---
## 18. Testing Matrix
| Layer | Test Type | Tools |
|-------|-----------|-------|
| Parsing | Unit (happy + malformed PDF) | Jest / Vitest |
| Resume versioning | Unit + integration (rollback) | DB mocks / Supabase local |
| Auto apply | Orchestrator unit + mocked network | Vitest |
| Cover letter v2 | Prompt builder pure tests | Vitest |
| E2E critical path | Login → Onboard → Upload → Auto Apply | Playwright (future) |

---
## 19. Implementation Order Rationale
1. Foundational safety (types, validation, migrations) prevents compounding debt.
2. Analytics early ensures later experiments are measurable.
3. Differentiators (tailored letters, insights) drive retention and perceived value.
4. Versioning & rollback = trust & experimentation freedom.
5. Growth hooks layered after core value stable.

---
## 20. Operational Conventions
- All new modules: export barrel in nearest `index.ts`.
- Prefer functional pure builders + side-effect orchestrators separated.
- Add TODOs with owner + date (`// TODO(OWNER 2025-09-29): message`).
- Each migration: include brief header comment with intent + rollback notes.

---
## 21. Open Questions (Clarify Before Deep Investment)
- Target model/provider for generation (self-host vs. API)?
- Privacy posture for sharing/public profile features?
- Planned billing tier differentiation boundaries?

---
## 22. Next Action Checklist (If Sprint Starts Now)
[x] Extract `empty-state.tsx` & integrate.
[ ] (Optional) Add story/demo page for EmptyState.
[x] Add `analytics.ts` abstraction.
[x] Wire analytics events in resume parsing & profile completion.
[x] Introduce `scripts/lint-migrations.ts` (node) + CI hook placeholder.
[x] Generate Supabase types → `src/types/supabase.ts` (placeholder added, replace via CLI gen).
[x] Define `zod` schemas for parse result.
[x] Create `resume_versions` migration (initial table + policies) & DAO skeleton.
[ ] Scaffold cover letter v2 builder module.
[ ] Skill frequency aggregator prototype reading existing parsed fields.

---
## 23. Maintenance Guidance
Reassess this document each sprint kickoff. Remove completed tasks; avoid letting it become an unbounded backlog. Treat as a curated intent document.

---
## 24. Edit Log
- 2025-09-29: Initial creation (agent roadmap scaffold).

---
_Append future edits below with date + author context._

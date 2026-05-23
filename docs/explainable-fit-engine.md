# Explainable Fit Intelligence Engine

Jobraker's fit engine is designed as layered intelligence, not a single black-box AI ranker.

## Phase 1 Status

Implemented deterministic ranking for the Jobs page:

- Lead quality score
- Candidate fit score
- Profile evidence strength
- Strategic value score
- Feedback learning placeholder score
- Hard caps with visible explanations
- Duplicate/repost suspicion
- Recommended next action
- Compact visible reasons on job cards and detail panels

This phase works without embeddings, Kuzu, or LLM calls.

## Scoring Formula

Default opportunity score:

```txt
30% Lead Quality
40% Candidate Fit
15% Profile Evidence Strength
10% Strategic Value
5% Feedback Learning
```

Weights live in `src/services/intelligence/types.ts` and are normalized before scoring.

## Engines

- `leadQualityEngine.ts`: scores source trust, freshness, description quality, company credibility, salary transparency, location clarity, duplicate suspicion, application URL quality, and spam/scam signals.
- `candidateFitEngine.ts`: scores title alignment, skill coverage, required skills, seniority, location, and compensation visibility.
- `jobDedupeEngine.ts`: detects deterministic duplicates by external URL, source ID, company/title, company/title/location, and normalized description overlap.
- `opportunityScoreEngine.ts`: combines component scores, applies hard caps, ranks opportunities, and recommends next action.

## Caps

Caps are applied after weighted scoring. Current deterministic caps include:

- Expired job: max 20
- Suspicious source/spam signal: max 30
- Stale job older than 45 days: max 60
- Severe seniority mismatch: max 65
- Impossible location: max 50
- Missing explicit required skill evidence: max 75
- Duplicate/repost suspicion: max 82

Caps always include a visible reason.

## Runtime Behavior

Deterministic explainable ranking is core product behavior and is always on.
Phase 1 does not require environment flags, embeddings, Kuzu, or LLM calls.

Future expensive systems such as semantic matching, Kuzu graph reasoning, and
LLM-assisted explanations should introduce server-side controls when those
systems are implemented, while preserving deterministic ranking as the baseline.

## UI

The Jobs page now defaults to `Best opportunity` sorting and displays:

- Opportunity score
- Lead score
- Fit score
- Evidence score
- Top visible reasons
- Main cap or blocker
- Recommended action

## Tests

Focused tests live in:

```txt
src/services/intelligence/__tests__/explainableFitEngine.test.ts
```

Run:

```bash
npm test -- src/services/intelligence/__tests__/explainableFitEngine.test.ts
```

On Windows PowerShell with script execution restrictions:

```powershell
npm.cmd test -- src/services/intelligence/__tests__/explainableFitEngine.test.ts
```

## Later Phases

Semantic matching, Postgres profile evidence graph tables, pgvector chunk tables, Kuzu sync, CRM feedback learning, and LLM-assisted reasoning are intentionally deferred until deterministic ranking and visible reasons are stable.

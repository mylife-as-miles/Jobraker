# Explainable Fit Intelligence Engine

Jobraker's fit engine is layered intelligence, not a single black-box AI ranker. Deterministic explainable ranking is always on; semantic, graph, and feedback systems add evidence when their data is available.

## Implementation Status

- **Phase 1: Deterministic scoring MVP**: lead quality, candidate fit, seniority caps, dedupe, opportunity score, visible reasons.
- **Phase 2: Profile evidence graph**: Postgres graph tables plus `rebuildProfileEvidenceForUser(userId)` for structured profile evidence.
- **Phase 3: Semantic matching**: pgvector schema, authenticated embedding endpoint, similarity RPC, and heuristic fallback when chunks are unavailable.
- **Phase 4: Graph reasoning**: Postgres recursive proof paths are active. Kuzu sync is optional and adapter-backed.
- **Phase 5: Feedback learning**: candidate feedback events can boost or penalize future opportunity scores.

## Scoring Formula

```txt
30% Lead Quality
40% Candidate Fit
15% Profile Evidence Strength
10% Strategic Value
5% Feedback Learning
```

Weights live in `src/services/intelligence/types.ts` and are normalized before scoring. Hard caps are applied after weighting, and vector or feedback signals cannot override caps.

## Engines

### Lead Quality

`src/services/intelligence/leadQualityEngine.ts` scores source trust, freshness, description quality, company credibility, salary transparency, location clarity, duplicate suspicion, application URL quality, and spam/scam signals.

### Candidate Fit

`src/services/intelligence/candidateFitEngine.ts` scores title alignment, skill coverage, required skills, seniority, location, and compensation visibility.

### Profile Evidence

`src/services/intelligence/profileEvidenceEngine.ts` reads profile skills, experiences, and parsed resumes, then writes:

- `profile_entities`
- `profile_edges`
- `profile_evidence_items`
- `candidate_skill_signals`
- `candidate_role_preferences`

`getProfileEvidenceScore(userId)` is scoped to the requested user.

### Semantic Matching

`src/services/intelligence/semanticMatchEngine.ts` calls the `match_job_to_profile` RPC when vector chunks exist. If chunks are missing or the RPC fails, it returns a heuristic token-overlap result instead of breaking ranking.

`backend/supabase/functions/generate-embeddings` requires an authenticated Supabase user token and keeps Gemini API keys server-side. The default model is `gemini-embedding-2`.

### Graph Reasoning

`src/services/intelligence/graphReasoningEngine.ts` calls the Postgres `get_profile_proof_paths` RPC and returns proof paths plus missing-proof blockers.

`backend/supabase/functions/_shared/kuzu-sync.ts` does not fake sync counts. If `ENABLE_KUZU_GRAPH=true` but `KUZU_SYNC_ENDPOINT` is not configured, Postgres graph reasoning remains the active path.

### Feedback Learning

`src/services/intelligence/feedbackLearningEngine.ts` scores prior saved, ignored, applied, interviewed, and offer events from `candidate_feedback_events`.

## Database

Migrations:

- `backend/supabase/migrations/20260523060000_create_intelligence_engine_schema.sql`
- `backend/supabase/migrations/20260523070000_create_semantic_matching_schema.sql`
- `backend/supabase/migrations/20260523080000_graph_reasoning_tables.sql`

## Runtime Configuration

Deterministic explainable ranking does not require an environment flag.

Optional server-side config:

```env
GEMINI_API_KEY=
GEMINI_EMBEDDING_MODEL=gemini-embedding-2
ENABLE_KUZU_GRAPH=false
KUZU_SYNC_ENDPOINT=
```

## Testing

```powershell
npm.cmd test -- src/services/intelligence/__tests__/explainableFitEngine.test.ts
```

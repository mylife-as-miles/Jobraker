# Explainable Fit Intelligence Engine

Jobraker's fit engine is designed as layered intelligence, not a single black-box AI ranker.

---

## Completed Phases (Phases 1–5)

All core components for Phases 1 through 5 have been fully implemented, integrated, and verified.

- **Phase 1: Deterministic Scoring MVP** (Lead quality, fit rubric, seniority caps, deduplication)
- **Phase 2: Relational Profile Evidence Graph** (PostgreSQL-backed graph modeling)
- **Phase 3: pgvector Semantic Matching** (Cosine similarity search with Gemini embeddings)
- **Phase 4: Kuzu Graph Reasoning** (Node/edge sync with Postgres fallback recursive queries)
- **Phase 5: CRM Memory & Feedback Learning** (Interaction logs tracking and opportunity tuning)

---

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

---

## Architecture & Engines

### 1. Lead Quality Engine (`leadQualityEngine.ts`)
Scores source trust, freshness, description quality, company credibility, salary transparency, location clarity, duplicate suspicion, application URL quality, and spam/scam signals.

### 2. Candidate Fit Engine (`candidateFitEngine.ts`)
Scores title alignment, skill coverage, required skills, seniority, location, and compensation visibility.

### 3. Profile Evidence Engine (`profileEvidenceEngine.ts`)
Parses profile collection tables (skills, experiences, education, parsed resumes) and compiles them into PostgreSQL graph tables:
* `profile_entities` (Representing nodes of type: `candidate`, `skill`, `experience`, `education`, `resume`)
* `profile_edges` (Representing links: `HAS_SKILL`, `USED_IN`, `EVIDENCES`, `CONTAINS`)
* `profile_evidence_items` (Relational evidence records mapped back to source tables with confidence ratings)
* `candidate_skill_signals` (Calculates experience years, recency, frequency, and outcome confidence per skill)

Call `rebuildProfileEvidenceForUser(userId)` to rebuild a user's entire profile evidence graph.

### 4. pgvector Semantic Match Engine (`semanticMatchEngine.ts`)
Performs cosine similarity lookups of job chunks against user profile chunks:
* `job_chunks`, `profile_evidence_chunks`, `candidate_memory_chunks` (All using 768-dimension vectors for Google Gemini embeddings)
* Backend Edge Function `generate-embeddings` uses `text-embedding-004` to compute embeddings.
* Database RPC `match_job_to_profile` runs cross-similarity queries on the database side.
* If `VITE_ENABLE_SEMANTIC_MATCHING=false` or embeddings are unprimed, the engine falls back to heuristic token-overlap matches.

### 5. Graph Reasoning Engine (`graphReasoningEngine.ts`)
Traverses node-edge links to build proof paths (e.g. *Candidate -> Experience -> EVIDENCES -> React*) or flag missing links.
* Database RPC `get_profile_proof_paths` runs recursive joins on Postgres.
* Kuzu sync layer `kuzu-sync.ts` enables syncing nodes to a graph workspace if `VITE_ENABLE_KUZU_GRAPH=true`.

### 6. Feedback Learning Engine (`feedbackLearningEngine.ts`)
Logs interaction outcomes in `candidate_feedback_events` (saves, ignores, applications, interview flags) and applies boosts/penalties:
* Previously interviewed/saved roles: positive boost.
* Previously ignored/hidden roles: negative penalty.
* Successful stack conversions (e.g., React/Supabase): conversion boost.

---

## Database Schema (Postgres / pgvector)

* Migrations:
  * `20260523060000_create_intelligence_engine_schema.sql` (Creates graph nodes, edges, signals, and triggers)
  * `20260523070000_create_semantic_matching_schema.sql` (Enables vector extension, chunk tables, HNSW indexes, and RPC similarity functions)
  * `20260523080000_graph_reasoning_tables.sql` (Adds `get_profile_proof_paths` query function)

---

## Runtime Configuration (Feature Flags)

Add these to your local environment file (`.env` or `.env.local`):

```env
VITE_ENABLE_EXPLAINABLE_RANKING=true
VITE_ENABLE_SEMANTIC_MATCHING=false  # Set to true once pgvector/Gemini APIs are provisioned
VITE_ENABLE_KUZU_GRAPH=false         # Set to true once Kuzu graph server is provisioned
```

If expensive systems are disabled, the engine will run entirely on deterministic SQL and token overlap, ensuring zero downtime and fast load times.

---

## Running Tests

Focused tests live in:
```txt
src/services/intelligence/__tests__/explainableFitEngine.test.ts
```

Run tests on Windows:
```powershell
npx.cmd vitest run src/services/intelligence/__tests__/explainableFitEngine.test.ts
```

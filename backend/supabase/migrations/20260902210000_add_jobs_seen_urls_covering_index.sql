-- Scout search: make the per-search dedup preload index-only.
--
-- Every discovery run loads up to 5000 rows of already-seen jobs to skip URLs
-- the user has seen before (see discoverJobsFirecrawl in
-- _shared/discovery-hybrid.ts):
--
--   select apply_url, source_id from jobs where user_id = $1 limit 5000
--
-- The filter is satisfied by jobs_user_queue_idx (user_id, hidden,
-- canonical_status, created_at desc), but neither apply_url nor source_id is in
-- any existing index, so Postgres follows every matching index entry back to the
-- heap. That is up to 5000 random heap fetches on the critical path of a search.
--
-- INCLUDE puts both payload columns in the index leaves without adding them to
-- the b-tree key, so this query can be served index-only.

create index if not exists jobs_user_seen_urls_idx
  on public.jobs (user_id)
  include (apply_url, source_id);

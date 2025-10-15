-- Adds a unique composite index to prevent duplicate job entries per user/source pair.
-- Safe to run multiple times due to IF NOT EXISTS.
CREATE UNIQUE INDEX IF NOT EXISTS jobs_user_source_unique ON jobs(user_id, source_id);

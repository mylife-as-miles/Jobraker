-- Step 1: Rename the table from 'user_jobs' to 'jobs'
ALTER TABLE IF EXISTS public.user_jobs RENAME TO jobs;

-- Step 2: Rename the primary key constraint
-- The name is typically user_jobs_pkey, but we check for existence first.
ALTER INDEX IF EXISTS user_jobs_pkey RENAME TO jobs_pkey;

-- Step 3: Rename the sequence for the primary key
-- The name is typically user_jobs_id_seq.
ALTER SEQUENCE IF EXISTS public.user_jobs_id_seq RENAME TO jobs_id_seq;

-- Step 4: Rename the dependent view from 'user_job_stats' to 'job_stats'
ALTER VIEW IF EXISTS public.user_job_stats RENAME TO job_stats;

-- Step 5: Update any foreign key constraints that might reference the old table.
-- This is a precautionary step. If other tables have a foreign key to user_jobs,
-- the constraint name might need to be updated. This is often handled automatically by Postgres,
-- but it's good practice to be aware of it. No action is taken here unless specific constraints are known.

-- Step 6: It's good practice to re-grant permissions if they were specific to the old table name,
-- but Supabase's RLS policies are generally tied to the table's OID, so they should survive the rename.
-- No action needed here unless specific issues are found.

-- The migration is now complete.
-- Ensure the discovery ingestion RPC can resolve pgcrypto.digest() on Supabase.
-- Existing Supabase projects normally install extension functions in the
-- extensions schema, while this SECURITY DEFINER function previously searched
-- public only.

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER FUNCTION public.upsert_job_from_discovery(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  integer,
  integer,
  text,
  text,
  text[],
  jsonb,
  integer,
  text,
  text[],
  text,
  double precision,
  text,
  boolean
)
SET search_path = pg_catalog, public, extensions;

-- This SECURITY DEFINER RPC accepts a user id and is used exclusively by the
-- service-role discovery worker. Prevent authenticated clients from invoking
-- it for another user.
REVOKE ALL ON FUNCTION public.upsert_job_from_discovery(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  integer,
  integer,
  text,
  text,
  text[],
  jsonb,
  integer,
  text,
  text[],
  text,
  double precision,
  text,
  boolean
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.upsert_job_from_discovery(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  integer,
  integer,
  text,
  text,
  text[],
  jsonb,
  integer,
  text,
  text[],
  text,
  double precision,
  text,
  boolean
) TO service_role;

COMMENT ON FUNCTION public.upsert_job_from_discovery(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  integer,
  integer,
  text,
  text,
  text[],
  jsonb,
  integer,
  text,
  text[],
  text,
  double precision,
  text,
  boolean
) IS
  'Service-only discovery ingestion with protected application state and a search path that resolves pgcrypto digest functions.';

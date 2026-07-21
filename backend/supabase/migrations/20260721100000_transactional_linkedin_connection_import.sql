-- Make LinkedIn connection imports atomic and idempotent per user.

ALTER TABLE public.linkedin_connections
  ADD COLUMN IF NOT EXISTS identity_key text GENERATED ALWAYS AS (
    CASE
      WHEN nullif(trim(profile_url), '') IS NOT NULL
        THEN 'url:' || lower(regexp_replace(trim(profile_url), '/+$', ''))
      WHEN nullif(trim(email), '') IS NOT NULL
        THEN 'email:' || lower(trim(email))
      ELSE 'person:' || lower(
        coalesce(trim(first_name), '') || '|' ||
        coalesce(trim(last_name), '') || '|' ||
        coalesce(trim(company), '') || '|' ||
        coalesce(trim(position), '')
      )
    END
  ) STORED;

-- Existing duplicate imports are collapsed before enforcing uniqueness. Match
-- suggestions for duplicate rows are discarded because they can be regenerated.
WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY user_id, identity_key ORDER BY created_at, id) AS duplicate_rank
  FROM public.linkedin_connections
  WHERE identity_key <> '' AND identity_key <> 'person:'
)
DELETE FROM public.referral_match_suggestions suggestion
USING ranked
WHERE suggestion.connection_id = ranked.id
  AND ranked.duplicate_rank > 1;

WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY user_id, identity_key ORDER BY created_at, id) AS duplicate_rank
  FROM public.linkedin_connections
  WHERE identity_key <> '' AND identity_key <> 'person:'
)
DELETE FROM public.linkedin_connections connection
USING ranked
WHERE connection.id = ranked.id
  AND ranked.duplicate_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS linkedin_connections_user_identity_key
  ON public.linkedin_connections (user_id, identity_key)
  WHERE identity_key <> '' AND identity_key <> 'person:';

CREATE OR REPLACE FUNCTION public.import_linkedin_connections(
  p_source_filename text,
  p_replace boolean,
  p_connections jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  caller_id uuid := (SELECT auth.uid());
  import_id uuid;
  imported_count integer := 0;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  IF jsonb_typeof(p_connections) <> 'array' THEN
    RAISE EXCEPTION 'Connections must be a JSON array' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_connections) > 50000 THEN
    RAISE EXCEPTION 'A maximum of 50000 connections can be imported at once' USING ERRCODE = '22023';
  END IF;

  -- Serialize imports for one user so concurrent uploads cannot race the unique key.
  PERFORM pg_advisory_xact_lock(hashtextextended(caller_id::text, 0));

  IF p_replace THEN
    DELETE FROM public.linkedin_connection_imports WHERE user_id = caller_id;
  END IF;

  INSERT INTO public.linkedin_connection_imports (user_id, source_filename, row_count)
  VALUES (caller_id, left(coalesce(p_source_filename, 'Connections.csv'), 255), 0)
  RETURNING id INTO import_id;

  WITH parsed AS (
    SELECT row.*,
           CASE
             WHEN nullif(trim(row.profile_url), '') IS NOT NULL
               THEN 'url:' || lower(regexp_replace(trim(row.profile_url), '/+$', ''))
             WHEN nullif(trim(row.email), '') IS NOT NULL
               THEN 'email:' || lower(trim(row.email))
             ELSE 'person:' || lower(
               coalesce(trim(row.first_name), '') || '|' ||
               coalesce(trim(row.last_name), '') || '|' ||
               coalesce(trim(row.company), '') || '|' ||
               coalesce(trim(row.position), '')
             )
           END AS incoming_identity
    FROM jsonb_to_recordset(p_connections) AS row(
      first_name text, last_name text, email text, company text, position text,
      connected_on date, profile_url text, raw jsonb
    )
    WHERE coalesce(trim(row.first_name), trim(row.last_name), trim(row.email),
                   trim(row.company), trim(row.position), trim(row.profile_url), '') <> ''
  ), deduplicated AS (
    SELECT DISTINCT ON (incoming_identity) *
    FROM parsed
    ORDER BY incoming_identity
  )
  INSERT INTO public.linkedin_connections (
    user_id, import_id, first_name, last_name, email, company, position,
    connected_on, profile_url, raw, agent_scan_status
  )
  SELECT caller_id, import_id,
         nullif(trim(row.first_name), ''), nullif(trim(row.last_name), ''),
         nullif(trim(row.email), ''), nullif(trim(row.company), ''),
         nullif(trim(row.position), ''), row.connected_on,
         nullif(trim(row.profile_url), ''), coalesce(row.raw, '{}'::jsonb), 'pending'
  FROM deduplicated AS row
  ON CONFLICT (user_id, identity_key)
    WHERE identity_key <> '' AND identity_key <> 'person:'
  DO UPDATE SET
    import_id = EXCLUDED.import_id,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    email = EXCLUDED.email,
    company = EXCLUDED.company,
    position = EXCLUDED.position,
    connected_on = EXCLUDED.connected_on,
    profile_url = EXCLUDED.profile_url,
    raw = EXCLUDED.raw,
    agent_scan_status = 'pending';

  GET DIAGNOSTICS imported_count = ROW_COUNT;
  UPDATE public.linkedin_connection_imports
  SET row_count = imported_count
  WHERE id = import_id;

  RETURN jsonb_build_object(
    'import_id', import_id,
    'imported_count', imported_count,
    'replaced', p_replace
  );
END;
$$;

REVOKE ALL ON FUNCTION public.import_linkedin_connections(text, boolean, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_linkedin_connections(text, boolean, jsonb) TO authenticated;

COMMENT ON FUNCTION public.import_linkedin_connections(text, boolean, jsonb) IS
  'Atomically imports and deduplicates the authenticated user LinkedIn connections.';

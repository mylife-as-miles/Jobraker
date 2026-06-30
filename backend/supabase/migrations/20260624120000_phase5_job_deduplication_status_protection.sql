-- =============================================================================
-- Phase 5 — Duplicate Jobs and User Application-State Protection
-- =============================================================================

-- Ensure pgcrypto exists for digest() function
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA public;
SET search_path TO public, extensions;

-- Drop unique indexes if they exist to prevent duplicate key errors during backfill/deduplication
DROP INDEX IF EXISTS public.jobs_user_fingerprint_idx;
DROP INDEX IF EXISTS public.jobs_user_canonical_url_hash_idx;

-- ── 1. Add Columns to jobs ───────────────────────────────────────────────────

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS fingerprint varchar(64) NULL,
  ADD COLUMN IF NOT EXISTS canonical_url_hash varchar(64) NULL;

COMMENT ON COLUMN public.jobs.fingerprint IS
  'SHA-256 fingerprint from lowercase trimmed title, company, and location.';
COMMENT ON COLUMN public.jobs.canonical_url_hash IS
  'SHA-256 hash of normalized apply_url.';

-- ── 2. Backfill hashes & Deduplicate existing records ────────────────────────

-- Generate hashes for existing records where possible
UPDATE public.jobs
SET canonical_url_hash = encode(digest(lower(trim(apply_url)), 'sha256'), 'hex')
WHERE apply_url IS NOT NULL AND apply_url <> '' AND canonical_url_hash IS NULL;

UPDATE public.jobs
SET fingerprint = encode(digest(lower(trim(title)) || '|' || lower(trim(company)) || '|' || COALESCE(lower(trim(location)), ''), 'sha256'), 'hex')
WHERE fingerprint IS NULL;

-- Clean up duplicate rows per user to prevent unique index constraint violations.
-- Keep rows with protected status, otherwise keep the most recently updated one.
WITH cte_url AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY user_id, canonical_url_hash
           ORDER BY 
             CASE WHEN canonical_status IN ('submitted', 'applied', 'interview', 'assessment', 'offer', 'rejected', 'archived', 'withdrawn') THEN 0 ELSE 1 END,
             updated_at DESC
         ) as rn
  FROM public.jobs
  WHERE canonical_url_hash IS NOT NULL
),
cte_fingerprint AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY user_id, fingerprint
           ORDER BY 
             CASE WHEN canonical_status IN ('submitted', 'applied', 'interview', 'assessment', 'offer', 'rejected', 'archived', 'withdrawn') THEN 0 ELSE 1 END,
             updated_at DESC
         ) as rn
  FROM public.jobs
  WHERE fingerprint IS NOT NULL
)
DELETE FROM public.jobs
WHERE id IN (
  SELECT id FROM cte_url WHERE rn > 1
  UNION
  SELECT id FROM cte_fingerprint WHERE rn > 1
);

-- ── 3. Create Unique Indexes ──────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS jobs_user_fingerprint_idx 
  ON public.jobs (user_id, fingerprint);

CREATE UNIQUE INDEX IF NOT EXISTS jobs_user_canonical_url_hash_idx 
  ON public.jobs (user_id, canonical_url_hash);

-- ── 4. Create Status Protection Trigger ───────────────────────────────────────

CREATE OR REPLACE FUNCTION public.trg_protect_job_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_trusted_reason text;
    v_protected_statuses text[] := ARRAY['submitted', 'applied', 'interview', 'assessment', 'offer', 'rejected', 'archived', 'withdrawn'];
BEGIN
    -- Only check if status is being changed to 'discovered' when it was previously protected
    IF NEW.canonical_status = 'discovered' AND OLD.canonical_status = ANY(v_protected_statuses) THEN
        -- Check if a trusted reset reason is set in the session context
        BEGIN
            v_trusted_reason := current_setting('app.trusted_reset_reason', true);
        EXCEPTION WHEN OTHERS THEN
            v_trusted_reason := NULL;
        END;

        IF v_trusted_reason IS NULL OR v_trusted_reason = '' THEN
            -- Log a warning to notify admins/system logs
            RAISE WARNING 'Blocked status downgrade attempt for job % (user %): tried to change from % to discovered',
                OLD.id, OLD.user_id, OLD.canonical_status;
            
            -- Prevent the downgrade by keeping the old status
            NEW.canonical_status := OLD.canonical_status;
            NEW.status := OLD.status;
        ELSE
            -- Log the trusted change with reason inside metadata
            NEW.raw_data := COALESCE(NEW.raw_data, '{}'::jsonb) || jsonb_build_object(
                'status_reset_info', jsonb_build_object(
                    'reset_at', now(),
                    'reason', v_trusted_reason,
                    'previous_status', OLD.canonical_status
                )
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_job_status_before_update ON public.jobs;
CREATE TRIGGER trg_protect_job_status_before_update
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_protect_job_status();

-- ── 5. Create Ingestion RPC ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.upsert_job_from_discovery(
    p_user_id uuid,
    p_source_type text,
    p_source_id text,
    p_title text,
    p_company text,
    p_description text,
    p_location text,
    p_apply_url text,
    p_salary_min integer,
    p_salary_max integer,
    p_salary_currency text,
    p_experience_level text,
    p_tags text[],
    p_raw_data jsonb,
    p_lead_quality_score integer,
    p_lead_quality_reason text,
    p_lead_quality_tags text[],
    p_source_kind text,
    p_source_confidence double precision,
    p_verification_status text,
    p_is_tracked_company boolean
)
RETURNS TABLE (
    job_id uuid,
    is_new_to_user boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_job_id uuid;
    v_is_new boolean;
    v_current_status text;
    v_fingerprint varchar(64);
    v_url_hash varchar(64);
    v_protected_statuses text[] := ARRAY['submitted', 'applied', 'interview', 'assessment', 'offer', 'rejected', 'archived', 'withdrawn'];
BEGIN
    -- Compute hashes
    v_fingerprint := encode(digest(lower(trim(p_title)) || '|' || lower(trim(p_company)) || '|' || COALESCE(lower(trim(p_location)), ''), 'sha256'), 'hex');
    
    IF p_apply_url IS NOT NULL AND p_apply_url <> '' THEN
        v_url_hash := encode(digest(lower(trim(p_apply_url)), 'sha256'), 'hex');
    ELSE
        v_url_hash := NULL;
    END IF;

    -- 1. Try matching by source_type + source_id first
    IF p_source_id IS NOT NULL AND p_source_id <> '' THEN
        SELECT id, canonical_status INTO v_job_id, v_current_status
        FROM public.jobs
        WHERE user_id = p_user_id
          AND source_type = p_source_type
          AND source_id = p_source_id
        LIMIT 1;
    END IF;

    -- 2. Try matching by canonical_url_hash
    IF v_job_id IS NULL AND v_url_hash IS NOT NULL THEN
        SELECT id, canonical_status INTO v_job_id, v_current_status
        FROM public.jobs
        WHERE user_id = p_user_id
          AND canonical_url_hash = v_url_hash
        LIMIT 1;
    END IF;

    -- 3. Try matching by fingerprint
    IF v_job_id IS NULL THEN
        SELECT id, canonical_status INTO v_job_id, v_current_status
        FROM public.jobs
        WHERE user_id = p_user_id
          AND fingerprint = v_fingerprint
        LIMIT 1;
    END IF;

    -- Upsert logic
    IF v_job_id IS NULL THEN
        v_is_new := true;
        v_job_id := gen_random_uuid();
        
        INSERT INTO public.jobs (
            id, user_id, source_type, source_id, title, company, description, location,
            apply_url, salary_min, salary_max, salary_currency, experience_level, tags,
            raw_data, lead_quality_score, lead_quality_reason, lead_quality_tags,
            source_kind, source_confidence, verification_status, is_tracked_company,
            status, canonical_status, fingerprint, canonical_url_hash, discovered_at, last_verified_at
        ) VALUES (
            v_job_id, p_user_id, p_source_type, p_source_id, p_title, p_company, p_description, p_location,
            p_apply_url, p_salary_min, p_salary_max, p_salary_currency, p_experience_level, p_tags,
            p_raw_data, p_lead_quality_score, p_lead_quality_reason, p_lead_quality_tags,
            p_source_kind, p_source_confidence, p_verification_status, p_is_tracked_company,
            'active', 'discovered', v_fingerprint, v_url_hash, now(), now()
        );
    ELSE
        v_is_new := false;
        
        -- Update safe fields only; status fields will be filtered by CASE or trigger anyway
        UPDATE public.jobs
        SET title = p_title,
            company = p_company,
            description = p_description,
            location = p_location,
            apply_url = p_apply_url,
            salary_min = p_salary_min,
            salary_max = p_salary_max,
            salary_currency = p_salary_currency,
            experience_level = p_experience_level,
            tags = p_tags,
            raw_data = p_raw_data,
            lead_quality_score = p_lead_quality_score,
            lead_quality_reason = p_lead_quality_reason,
            lead_quality_tags = p_lead_quality_tags,
            source_kind = p_source_kind,
            source_confidence = p_source_confidence,
            verification_status = p_verification_status,
            is_tracked_company = p_is_tracked_company,
            fingerprint = v_fingerprint,
            canonical_url_hash = v_url_hash,
            last_verified_at = now(),
            -- Don't downgrade status if it's protected (trigger will also guard this)
            status = CASE WHEN v_current_status = ANY(v_protected_statuses) THEN status ELSE 'active' END,
            canonical_status = CASE WHEN v_current_status = ANY(v_protected_statuses) THEN canonical_status ELSE 'discovered' END
        WHERE id = v_job_id;
    END IF;

    RETURN QUERY SELECT v_job_id, v_is_new;
END;
$$;

-- ── 6. Grants & Permissions ──────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION public.upsert_job_from_discovery TO authenticated, service_role;

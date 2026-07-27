-- Fix race-condition unique key violations during batch job discovery ingestion.
-- Catches unique_violation (Postgres Error 23505) and updates existing job safely.

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
SET search_path = pg_catalog, public, extensions
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
        
        BEGIN
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
        EXCEPTION WHEN unique_violation THEN
            -- Race condition: another concurrent process inserted a job with matching fingerprint or url_hash
            v_is_new := false;
            SELECT id, canonical_status INTO v_job_id, v_current_status
            FROM public.jobs
            WHERE user_id = p_user_id
              AND (
                fingerprint = v_fingerprint 
                OR (v_url_hash IS NOT NULL AND canonical_url_hash = v_url_hash)
                OR (p_source_id IS NOT NULL AND p_source_id <> '' AND source_type = p_source_type AND source_id = p_source_id)
              )
            LIMIT 1;

            IF v_job_id IS NOT NULL THEN
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
                    status = CASE WHEN v_current_status = ANY(v_protected_statuses) THEN status ELSE 'active' END,
                    canonical_status = CASE WHEN v_current_status = ANY(v_protected_statuses) THEN canonical_status ELSE 'discovered' END
                WHERE id = v_job_id;
            END IF;
        END;
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

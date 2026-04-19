-- Full automation provider payload (Skyvern workflow outputs, block results, extracted_information, etc.)
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS provider_run_output jsonb;

COMMENT ON COLUMN public.applications.provider_run_output IS
  'JSON from the automation provider: webhook body and/or run API response, including workflow block outputs (resume, job extract, cover letter, apply confirmation).';

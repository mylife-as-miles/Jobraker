-- Replace the legacy Atelier presentation with the Hologram portfolio.
-- Remove Odyssey and migrate existing Odyssey portfolios to Navigator.
-- Keep the database-compatible renderer theme while migrating visible variants.
ALTER TABLE public.public_profile_sites
  ALTER COLUMN theme SET DEFAULT 'navigator';

UPDATE public.public_profile_sites
SET
  theme = 'navigator',
  design = jsonb_set(
    jsonb_set(
      COALESCE(design, '{}'::jsonb),
      '{templateVariant}',
      '"hologram"'::jsonb,
      true
    ),
    '{accent}',
    '"#63f3ff"'::jsonb,
    true
  ),
  updated_at = now()
WHERE theme = 'atelier'
   OR COALESCE(design->>'templateVariant', '') = 'atelier';

UPDATE public.public_profile_sites
SET
  theme = 'navigator',
  design = jsonb_set(
    jsonb_set(
      COALESCE(design, '{}'::jsonb),
      '{templateVariant}',
      '"navigator"'::jsonb,
      true
    ),
    '{accent}',
    '"#1dff00"'::jsonb,
    true
  ),
  updated_at = now()
WHERE COALESCE(design->>'templateVariant', '') = 'odyssey';

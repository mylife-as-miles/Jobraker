-- Retire the Obsidian, Prism, and Mono portfolio themes.
-- Navigator remains the renderer for both Navigator and Editorial variants.
ALTER TABLE public.public_profile_sites
  ALTER COLUMN theme SET DEFAULT 'atelier';

UPDATE public.public_profile_sites
SET
  theme = 'atelier',
  design = jsonb_set(
    COALESCE(design, '{}'::jsonb),
    '{templateVariant}',
    '"atelier"'::jsonb,
    true
  ),
  updated_at = now()
WHERE theme NOT IN ('atelier', 'navigator');

UPDATE public.public_profile_sites
SET
  design = jsonb_set(
    COALESCE(design, '{}'::jsonb),
    '{templateVariant}',
    '"atelier"'::jsonb,
    true
  ),
  updated_at = now()
WHERE theme = 'atelier'
  AND COALESCE(design->>'templateVariant', '') <> 'atelier';

UPDATE public.public_profile_sites
SET
  design = jsonb_set(
    COALESCE(design, '{}'::jsonb),
    '{templateVariant}',
    '"navigator"'::jsonb,
    true
  ),
  updated_at = now()
WHERE theme = 'navigator'
  AND COALESCE(design->>'templateVariant', '') NOT IN ('navigator', 'editorial');

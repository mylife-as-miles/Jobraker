CREATE TABLE IF NOT EXISTS public.public_profile_sites (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  is_public boolean NOT NULL DEFAULT false,
  theme text NOT NULL DEFAULT 'obsidian',
  headline text,
  intro text,
  cta_label text NOT NULL DEFAULT 'Start a conversation',
  contact_email text,
  links jsonb NOT NULL DEFAULT '[]'::jsonb,
  design jsonb NOT NULL DEFAULT '{
    "accent": "#1dff00",
    "density": "cinematic",
    "motion": "scroll-scrub",
    "texture": "shader-glass"
  }'::jsonb,
  section_order text[] NOT NULL DEFAULT ARRAY['hero', 'signal', 'experience', 'skills', 'education', 'contact'],
  views integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT public_profile_sites_user_unique UNIQUE (user_id),
  CONSTRAINT public_profile_sites_slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9-]{2,62}$'),
  CONSTRAINT public_profile_sites_links_array CHECK (jsonb_typeof(links) = 'array'),
  CONSTRAINT public_profile_sites_design_object CHECK (jsonb_typeof(design) = 'object')
);

CREATE INDEX IF NOT EXISTS public_profile_sites_slug_public_idx
  ON public.public_profile_sites(slug)
  WHERE is_public = true;

ALTER TABLE public.public_profile_sites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Select own public profile site" ON public.public_profile_sites;
CREATE POLICY "Select own public profile site"
  ON public.public_profile_sites
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Insert own public profile site" ON public.public_profile_sites;
CREATE POLICY "Insert own public profile site"
  ON public.public_profile_sites
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Update own public profile site" ON public.public_profile_sites;
CREATE POLICY "Update own public profile site"
  ON public.public_profile_sites
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Delete own public profile site" ON public.public_profile_sites;
CREATE POLICY "Delete own public profile site"
  ON public.public_profile_sites
  FOR DELETE
  USING (auth.uid() = user_id);

GRANT ALL ON TABLE public.public_profile_sites TO authenticated, service_role;

DROP TRIGGER IF EXISTS update_public_profile_sites_updated_at ON public.public_profile_sites;
CREATE TRIGGER update_public_profile_sites_updated_at
  BEFORE UPDATE ON public.public_profile_sites
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

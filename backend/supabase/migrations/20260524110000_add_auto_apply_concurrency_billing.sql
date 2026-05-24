CREATE TABLE IF NOT EXISTS public.concurrency_pack_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  parallel_slots integer NOT NULL CHECK (parallel_slots > 0),
  price_usd numeric(10,2) NOT NULL CHECK (price_usd > 0),
  currency text NOT NULL DEFAULT 'USD',
  is_popular boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.concurrency_pack_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view active concurrency packs" ON public.concurrency_pack_catalog;
CREATE POLICY "Authenticated users can view active concurrency packs"
  ON public.concurrency_pack_catalog
  FOR SELECT
  TO authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "Public can view active concurrency packs" ON public.concurrency_pack_catalog;
CREATE POLICY "Public can view active concurrency packs"
  ON public.concurrency_pack_catalog
  FOR SELECT
  TO anon
  USING (is_active = true);

DROP POLICY IF EXISTS "Service role can manage concurrency packs" ON public.concurrency_pack_catalog;
CREATE POLICY "Service role can manage concurrency packs"
  ON public.concurrency_pack_catalog
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

INSERT INTO public.concurrency_pack_catalog (
  sku,
  name,
  description,
  parallel_slots,
  price_usd,
  currency,
  is_popular,
  sort_order,
  is_active
)
VALUES
  (
    'parallel_1',
    'Starter Boost',
    'Add 1 extra parallel auto-apply slot for the current billing period.',
    1,
    19,
    'USD',
    false,
    10,
    true
  ),
  (
    'parallel_2',
    'Momentum Boost',
    'Add 2 extra parallel auto-apply slots for the current billing period.',
    2,
    35,
    'USD',
    true,
    20,
    true
  ),
  (
    'parallel_4',
    'Scale Boost',
    'Add 4 extra parallel auto-apply slots for the current billing period.',
    4,
    59,
    'USD',
    false,
    30,
    true
  ),
  (
    'parallel_8',
    'Sprint Boost',
    'Add 8 extra parallel auto-apply slots for the current billing period.',
    8,
    99,
    'USD',
    false,
    40,
    true
  )
ON CONFLICT (sku) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  parallel_slots = EXCLUDED.parallel_slots,
  price_usd = EXCLUDED.price_usd,
  currency = EXCLUDED.currency,
  is_popular = EXCLUDED.is_popular,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = now();

GRANT SELECT ON public.concurrency_pack_catalog TO authenticated, anon;

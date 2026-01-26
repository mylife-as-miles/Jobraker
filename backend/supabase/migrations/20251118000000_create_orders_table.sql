create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  plan_type text not null, -- 'credit_pack' or 'subscription'
  total_amount integer not null, -- Amount in cents/kobo (lowest currency unit)
  currency text default 'USD',
  payment_cycle text, -- 'monthly', 'yearly', 'one_time'
  total_credits_paid_for integer default 0,
  is_success boolean default false,
  tx_id text unique, -- Paystack reference
  metadata jsonb default '{}'::jsonb, -- Store extra details like plan_id, credits_bonus, etc.
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes
create index if not exists idx_orders_user_id on public.orders(user_id);
create index if not exists idx_orders_tx_id on public.orders(tx_id);

-- RLS
alter table public.orders enable row level security;

-- Policies
create policy "Users can view own orders"
  on public.orders for select
  using (auth.uid() = user_id);

create policy "Service role can manage orders"
  on public.orders for all
  using (true)
  with check (true);

-- Grant access to authenticated users (for insert via edge function if needed, but usually service role does it)
-- Actually, init-payment (service role) creates the order. User just reads.
-- But if we want user to be able to see it immediately? Yes, Select policy handles that.

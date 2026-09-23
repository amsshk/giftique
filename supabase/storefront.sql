create table if not exists public.storefront_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  category text not null default 'Gifts',
  price numeric(12,2) not null default 0 check (price >= 0),
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.storefront_products enable row level security;

create policy "anyone can view active storefront products"
on public.storefront_products for select
to anon, authenticated
using (active = true);

create policy "authenticated staff can manage storefront products"
on public.storefront_products for all
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('owner', 'staff'))
with check ((auth.jwt() -> 'app_metadata' ->> 'role') in ('owner', 'staff'));

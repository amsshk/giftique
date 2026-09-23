create extension if not exists pgcrypto;

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id),
  sku text not null unique,
  name text not null,
  category text not null,
  purchase_quantity integer not null default 0 check (purchase_quantity >= 0),
  bundle_quantity integer not null default 1 check (bundle_quantity > 0),
  purchase_price numeric(12,2) not null default 0 check (purchase_price >= 0),
  quantity_used integer not null default 0 check (quantity_used >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_price_history (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  changed_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  customer_id uuid references public.customers(id),
  status text not null default 'draft' check (status in ('draft','confirmed','preparing','ready','collected','shipped','delivered','cancelled')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','pending','paid','refunded')),
  delivery_status text not null default 'not_ready' check (delivery_status in ('not_ready','ready','pickup_requested','collected','handed_to_carrier','delivered')),
  subtotal numeric(12,2) not null default 0,
  delivery_fee numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  inventory_item_id uuid references public.inventory_items(id),
  product_name text not null,
  quantity integer not null check (quantity > 0),
  selling_price numeric(12,2) not null default 0,
  unit_cost numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  order_id uuid references public.orders(id),
  quantity integer not null check (quantity <> 0),
  movement_type text not null check (movement_type in ('purchase','usage','adjustment','return')),
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.delivery_shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  courier_name text,
  carrier_name text,
  tracking_number text,
  status text not null default 'pending',
  pickup_requested_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace view public.inventory_costs as
select
  i.id,
  i.sku,
  i.name,
  i.category,
  i.purchase_quantity,
  i.bundle_quantity,
  i.purchase_price,
  i.quantity_used,
  greatest(i.purchase_quantity - i.quantity_used, 0) as quantity_remaining,
  round(i.purchase_price / nullif(i.bundle_quantity, 0), 2) as unit_cost
from public.inventory_items i;

alter table public.suppliers enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_price_history enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.stock_movements enable row level security;
alter table public.delivery_shipments enable row level security;

create policy "authenticated users can manage suppliers" on public.suppliers for all to authenticated using (true) with check (true);
create policy "authenticated users can manage inventory" on public.inventory_items for all to authenticated using (true) with check (true);
create policy "authenticated users can manage price history" on public.inventory_price_history for all to authenticated using (true) with check (true);
create policy "authenticated users can manage customers" on public.customers for all to authenticated using (true) with check (true);
create policy "authenticated users can manage orders" on public.orders for all to authenticated using (true) with check (true);
create policy "authenticated users can manage order items" on public.order_items for all to authenticated using (true) with check (true);
create policy "authenticated users can manage stock movements" on public.stock_movements for all to authenticated using (true) with check (true);
create policy "authenticated users can manage shipments" on public.delivery_shipments for all to authenticated using (true) with check (true);

insert into public.suppliers (name) values ('Bookshop') on conflict (name) do nothing;

insert into public.inventory_items (supplier_id, sku, name, category, purchase_quantity, bundle_quantity, purchase_price)
select s.id, v.sku, v.name, v.category, v.purchase_quantity, v.bundle_quantity, v.purchase_price
from public.suppliers s
cross join (values
  ('BS-001','Bride card - cotton','Cards',1,1,15),
  ('BS-002','Bride card - standard','Cards',1,1,5),
  ('BS-003','Small proposal card','Cards',1,1,5),
  ('BS-004','Small message cards','Cards',5,5,10),
  ('BS-005','Large cotton message card','Cards',1,1,10),
  ('BS-006','Large proposal cards','Cards',10,10,10),
  ('BS-007','Bride Giftique robe tags','Cards',15,15,10),
  ('BS-008','Logo sticker for box','Printed items',1,1,5),
  ('BS-009','Candle sticker','Printed items',1,1,5),
  ('BS-010','Door hanger','Printed items',1,1,15),
  ('BS-011','Bridal-shower lace banner','Printed items',1,1,25),
  ('BS-012','Acrylic bride hanger','Bride hangers',1,1,10),
  ('BS-013','Personalized bride hanger with sticker','Bride hangers',1,1,5),
  ('BS-014','Bride hanger with the bride''s name','Bride hangers',1,1,15),
  ('BS-015','Letters to the Bride book','Books and boxes',1,1,90),
  ('BS-016','White bride gift box','Books and boxes',1,1,5),
  ('BS-017','Satin box','Books and boxes',1,1,20),
  ('BS-018','Happy Tears box','Books and boxes',1,1,15),
  ('BS-019','Pillow box','Books and boxes',1,1,15),
  ('BS-020','Small keepsake box','Books and boxes',1,1,8),
  ('BS-021','Large keepsake box','Books and boxes',1,1,8),
  ('BS-022','Med Khan item','Books and boxes',1,1,5),
  ('BS-023','White garment bag','Garment packaging',1,1,15),
  ('BS-024','Beige garment bag','Garment packaging',1,1,15)
) as v(sku, name, category, purchase_quantity, bundle_quantity, purchase_price) on s.name = 'Bookshop'
on conflict (sku) do nothing;

insert into public.inventory_price_history (inventory_item_id, unit_price)
select i.id, round(i.purchase_price / nullif(i.bundle_quantity, 0), 2)
from public.inventory_items i
where not exists (select 1 from public.inventory_price_history h where h.inventory_item_id = i.id);

alter table public.orders
add column if not exists created_by uuid references auth.users(id);

alter table public.order_items
add column if not exists storefront_product_id uuid references public.storefront_products(id);

create or replace function public.place_storefront_order(
  p_product_id uuid,
  p_quantity integer,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  product_record public.storefront_products;
  customer_id uuid;
  created_order public.orders;
  order_reference text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'client' then
    raise exception 'Only client accounts can place storefront orders';
  end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 50 then
    raise exception 'Quantity must be between 1 and 50';
  end if;

  select * into product_record
  from public.storefront_products
  where id = p_product_id and active = true;
  if not found then
    raise exception 'Product is not available';
  end if;

  insert into public.customers (name, email, phone)
  values (trim(p_customer_name), nullif(trim(p_customer_email), ''), nullif(trim(p_customer_phone), ''))
  returning id into customer_id;

  order_reference := 'WEB-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.orders (reference, created_by, customer_id, status, payment_status, delivery_status, subtotal, total)
  values (order_reference, auth.uid(), customer_id, 'draft', 'unpaid', 'not_ready', product_record.price * p_quantity, product_record.price * p_quantity)
  returning * into created_order;

  insert into public.order_items (order_id, storefront_product_id, product_name, quantity, selling_price, unit_cost)
  values (created_order.id, product_record.id, product_record.name, p_quantity, product_record.price, 0);

  return created_order;
end;
$$;

revoke all on function public.place_storefront_order(uuid, integer, text, text, text) from public;
grant execute on function public.place_storefront_order(uuid, integer, text, text, text) to authenticated;

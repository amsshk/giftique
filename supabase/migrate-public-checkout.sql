create or replace function public.place_public_order(
  p_items jsonb,
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
  item jsonb;
  product_record public.storefront_products;
  customer_id uuid;
  created_order public.orders;
  order_reference text;
  line_total numeric(12,2) := 0;
  item_quantity integer;
  item_count integer := 0;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Your bag is empty';
  end if;
  if length(trim(coalesce(p_customer_name, ''))) < 2 then
    raise exception 'Name is required';
  end if;
  if p_customer_email is null or p_customer_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'A valid email is required';
  end if;

  insert into public.customers (name, email, phone)
  values (trim(p_customer_name), lower(trim(p_customer_email)), nullif(trim(p_customer_phone), ''))
  returning id into customer_id;

  order_reference := 'WEB-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.orders (reference, customer_id, status, payment_status, delivery_status, subtotal, total)
  values (order_reference, customer_id, 'draft', 'unpaid', 'not_ready', 0, 0)
  returning * into created_order;

  for item in select * from jsonb_array_elements(p_items) loop
    item_quantity := (item ->> 'quantity')::integer;
    if item_quantity < 1 or item_quantity > 50 then
      raise exception 'Each quantity must be between 1 and 50';
    end if;

    select * into product_record
    from public.storefront_products
    where id = (item ->> 'product_id')::uuid and active = true;
    if not found then
      raise exception 'One of the selected products is no longer available';
    end if;

    item_count := item_count + item_quantity;
    if item_count > 100 then
      raise exception 'Order quantity is too large';
    end if;
    line_total := line_total + product_record.price * item_quantity;

    insert into public.order_items (order_id, storefront_product_id, product_name, quantity, selling_price, unit_cost)
    values (created_order.id, product_record.id, product_record.name, item_quantity, product_record.price, 0);
  end loop;

  update public.orders set subtotal = line_total, total = line_total where id = created_order.id returning * into created_order;
  return created_order;
end;
$$;

revoke all on function public.place_public_order(jsonb, text, text, text) from public;
grant execute on function public.place_public_order(jsonb, text, text, text) to anon, authenticated;

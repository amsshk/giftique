-- Run this after the original schema.sql if it was already applied.
-- Roles must be assigned server-side in auth.users.raw_app_meta_data.

drop policy if exists "authenticated users can manage suppliers" on public.suppliers;
drop policy if exists "authenticated users can manage inventory" on public.inventory_items;
drop policy if exists "authenticated users can manage price history" on public.inventory_price_history;
drop policy if exists "authenticated users can manage customers" on public.customers;
drop policy if exists "authenticated users can manage orders" on public.orders;
drop policy if exists "authenticated users can manage order items" on public.order_items;
drop policy if exists "authenticated users can manage stock movements" on public.stock_movements;
drop policy if exists "authenticated users can manage shipments" on public.delivery_shipments;
drop policy if exists "authenticated staff can manage storefront products" on public.storefront_products;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['suppliers','inventory_items','inventory_price_history','customers','orders','order_items','stock_movements','delivery_shipments'] loop
    execute format('create policy "owner and staff can manage %1$s" on public.%1$s for all to authenticated using ((auth.jwt() -> ''app_metadata'' ->> ''role'') in (''owner'', ''staff'')) with check ((auth.jwt() -> ''app_metadata'' ->> ''role'') in (''owner'', ''staff''))', table_name);
  end loop;
end $$;

create policy "owner and staff can manage storefront products"
on public.storefront_products for all
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('owner', 'staff'))
with check ((auth.jwt() -> 'app_metadata' ->> 'role') in ('owner', 'staff'));

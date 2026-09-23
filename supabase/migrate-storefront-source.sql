alter table public.storefront_products
add column if not exists source_handle text;

drop index if exists public.storefront_products_source_handle_key;

create unique index if not exists storefront_products_source_handle_key
on public.storefront_products(source_handle);
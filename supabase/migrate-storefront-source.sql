alter table public.storefront_products
add column if not exists source_handle text;

create unique index if not exists storefront_products_source_handle_key
on public.storefront_products(source_handle)
where source_handle is not null;
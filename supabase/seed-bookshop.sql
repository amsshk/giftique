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
+) as v(sku, name, category, purchase_quantity, bundle_quantity, purchase_price) on s.name = 'Bookshop'
on conflict (sku) do nothing;

insert into public.inventory_price_history (inventory_item_id, unit_price)
select i.id, round(i.purchase_price / nullif(i.bundle_quantity, 0), 2)
from public.inventory_items i
where not exists (select 1 from public.inventory_price_history h where h.inventory_item_id = i.id);

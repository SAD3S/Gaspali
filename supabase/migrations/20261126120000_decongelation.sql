-- Gaspalli — produits sortis du congélateur : ils ne se recongèlent pas.
alter table public.inventory_items add column if not exists thawed_at bigint;

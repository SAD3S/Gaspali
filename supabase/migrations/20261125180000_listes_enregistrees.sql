-- Gaspalli — listes de courses enregistrées (« Apéro », « Courses de base »), partagées par le foyer.

create table public.shopping_lists (
  id uuid primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  name text not null check (char_length(name) between 1 and 40),
  -- [{ name, quantity, unit, ingredientId }]
  items text not null check (char_length(items) <= 20000),
  position integer not null,
  field_ts jsonb not null default '{}',
  server_seq bigint not null default nextval('public.sync_seq')
);
create index shopping_lists_household_seq_idx on public.shopping_lists (household_id, server_seq);

create trigger shopping_lists_bump_seq before insert or update on public.shopping_lists
  for each row execute function public.bump_server_seq();

alter table public.shopping_lists enable row level security;
create policy shopping_lists_rw on public.shopping_lists for all to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
revoke all on public.shopping_lists from anon;
grant select, insert, update on public.shopping_lists to authenticated;

alter publication supabase_realtime add table public.shopping_lists;

create or replace function public.synced_tables() returns text[]
language sql immutable as $$
  select array['products', 'inventory_items', 'events', 'recipes', 'recipe_folders', 'recipe_links',
               'dietary_profiles', 'shopping_items', 'meal_plan', 'receipt_aliases', 'shopping_lists'];
$$;

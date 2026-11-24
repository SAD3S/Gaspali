-- Gaspalli — scan du ticket de caisse : correspondances « libellé de ticket → produit » apprises par foyer.

create table public.receipt_aliases (
  id uuid primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  -- Libellé normalisé (minuscules, sans accents, marques ni quantités).
  key text not null check (char_length(key) between 1 and 120),
  name text not null check (char_length(name) between 1 and 120),
  category text not null check (char_length(category) <= 40),
  location text check (location in ('frigo', 'congelo', 'placard')),
  unit text check (char_length(unit) <= 20),
  field_ts jsonb not null default '{}',
  server_seq bigint not null default nextval('public.sync_seq')
);
create index receipt_aliases_household_seq_idx on public.receipt_aliases (household_id, server_seq);
create index receipt_aliases_household_key_idx on public.receipt_aliases (household_id, key);

create trigger receipt_aliases_bump_seq before insert or update on public.receipt_aliases
  for each row execute function public.bump_server_seq();

alter table public.receipt_aliases enable row level security;
create policy receipt_aliases_rw on public.receipt_aliases for all to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
revoke all on public.receipt_aliases from anon;
grant select, insert, update on public.receipt_aliases to authenticated;

alter publication supabase_realtime add table public.receipt_aliases;

create or replace function public.synced_tables() returns text[]
language sql immutable as $$
  select array['products', 'inventory_items', 'events', 'recipes', 'recipe_folders', 'recipe_links',
               'dietary_profiles', 'shopping_items', 'meal_plan', 'receipt_aliases'];
$$;

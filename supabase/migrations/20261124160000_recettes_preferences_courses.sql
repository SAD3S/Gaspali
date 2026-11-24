-- Gaspalli — recettes perso, dossiers, favoris, préférences alimentaires, liste de courses.
-- Même principe que la migration précédente : tables miroir de la base locale, RLS par foyer,
-- synchronisation champ par champ via sync_push().

create table public.recipes (
  id uuid primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  title text not null check (char_length(title) between 1 and 120),
  minutes integer not null check (minutes between 0 and 1440),
  servings integer not null check (servings between 1 and 50),
  kind text not null,
  tags text not null default '[]',
  ingredients text not null default '[]',
  steps text not null default '[]',
  photo_uri text,
  source text not null check (source in ('perso', 'ia')),
  author_id uuid,
  field_ts jsonb not null default '{}',
  server_seq bigint not null default nextval('public.sync_seq')
);
create index recipes_household_seq_idx on public.recipes (household_id, server_seq);

create table public.recipe_folders (
  id uuid primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  name text not null check (char_length(name) between 1 and 40),
  position integer not null default 0,
  field_ts jsonb not null default '{}',
  server_seq bigint not null default nextval('public.sync_seq')
);
create index recipe_folders_household_seq_idx on public.recipe_folders (household_id, server_seq);

create table public.recipe_links (
  id uuid primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  -- Recette de la base (identifiant texte, ex. « gratin-poulet-epinards ») ou recette perso (UUID).
  recipe_id text not null,
  folder_id uuid,
  kind text not null check (kind in ('favori', 'dossier')),
  field_ts jsonb not null default '{}',
  server_seq bigint not null default nextval('public.sync_seq')
);
create index recipe_links_household_seq_idx on public.recipe_links (household_id, server_seq);

create table public.dietary_profiles (
  id uuid primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  user_id uuid not null references public.profiles (id) on delete cascade,
  diet text not null check (diet in ('omnivore', 'pescetarien', 'vegetarien', 'vegan')),
  allergens text not null default '[]',
  dislikes text not null default '[]',
  field_ts jsonb not null default '{}',
  server_seq bigint not null default nextval('public.sync_seq'),
  unique (household_id, user_id)
);
create index dietary_profiles_household_seq_idx on public.dietary_profiles (household_id, server_seq);

create table public.shopping_items (
  id uuid primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  name text not null check (char_length(name) between 1 and 120),
  quantity double precision,
  unit text,
  aisle text not null,
  checked boolean not null default false,
  ingredient_id text,
  recipe_id text,
  added_by uuid,
  field_ts jsonb not null default '{}',
  server_seq bigint not null default nextval('public.sync_seq')
);
create index shopping_items_household_seq_idx on public.shopping_items (household_id, server_seq);

create trigger recipes_bump_seq before insert or update on public.recipes for each row execute function public.bump_server_seq();
create trigger recipe_folders_bump_seq before insert or update on public.recipe_folders for each row execute function public.bump_server_seq();
create trigger recipe_links_bump_seq before insert or update on public.recipe_links for each row execute function public.bump_server_seq();
create trigger dietary_profiles_bump_seq before insert or update on public.dietary_profiles for each row execute function public.bump_server_seq();
create trigger shopping_items_bump_seq before insert or update on public.shopping_items for each row execute function public.bump_server_seq();

-- ─── RLS ─────────────────────────────────────────────────────────────────────
alter table public.recipes enable row level security;
alter table public.recipe_folders enable row level security;
alter table public.recipe_links enable row level security;
alter table public.dietary_profiles enable row level security;
alter table public.shopping_items enable row level security;

create policy recipes_rw on public.recipes for all to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy recipe_folders_rw on public.recipe_folders for all to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy recipe_links_rw on public.recipe_links for all to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy shopping_items_rw on public.shopping_items for all to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));

-- Préférences : tout le foyer les lit (le moteur de recettes en tient compte),
-- chacun ne modifie que les siennes.
create policy dietary_profiles_select on public.dietary_profiles for select to authenticated
  using (public.is_household_member(household_id));
create policy dietary_profiles_insert on public.dietary_profiles for insert to authenticated
  with check (public.is_household_member(household_id) and user_id = auth.uid());
create policy dietary_profiles_update on public.dietary_profiles for update to authenticated
  using (public.is_household_member(household_id) and user_id = auth.uid())
  with check (public.is_household_member(household_id) and user_id = auth.uid());

revoke all on public.recipes, public.recipe_folders, public.recipe_links, public.dietary_profiles, public.shopping_items from anon;
grant select, insert, update on public.recipes, public.recipe_folders, public.recipe_links, public.dietary_profiles, public.shopping_items to authenticated;

-- ─── sync_push v2 : nouvelles tables + une ligne refusée ne bloque plus les autres ──
drop function public.sync_push(text, jsonb);

/**
 * Applique des modifications champ par champ (dernière modification gagne).
 * Renvoie { "applied": n, "rejected": ["id", …] } : une ligne refusée (droits, contrainte)
 * est ignorée au lieu de faire échouer tout le lot, pour ne pas bloquer la file du téléphone.
 */
create function public.sync_push(p_table text, p_changes jsonb) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  protected constant text[] := array['id', 'household_id', 'field_ts', 'server_seq'];
  cols text;
  excluded_cols text;
  ch jsonb;
  v_id uuid;
  v_hid uuid;
  existing jsonb;
  merged jsonb;
  ts jsonb;
  k text;
  incoming bigint;
  applied integer := 0;
  rejected jsonb := '[]'::jsonb;
begin
  if p_table not in ('products', 'inventory_items', 'events', 'recipes', 'recipe_folders', 'recipe_links', 'dietary_profiles', 'shopping_items') then
    raise exception 'table non synchronisée : %', p_table using errcode = '42501';
  end if;

  select string_agg(quote_ident(column_name), ', ' order by ordinal_position),
         string_agg('excluded.' || quote_ident(column_name), ', ' order by ordinal_position)
    into cols, excluded_cols
  from information_schema.columns
  where table_schema = 'public' and table_name = p_table and column_name <> 'server_seq';

  for ch in select value from jsonb_array_elements(p_changes) loop
    begin
      v_id := (ch ->> 'id')::uuid;
      v_hid := (ch ->> 'household_id')::uuid;
      if v_id is null or v_hid is null then raise exception 'id et household_id sont obligatoires' using errcode = '22023'; end if;
      if jsonb_typeof(ch -> 'fields') <> 'object' or jsonb_typeof(coalesce(ch -> 'ts', '{}'::jsonb)) <> 'object' then
        raise exception 'fields et ts doivent être des objets JSON' using errcode = '22023';
      end if;
      if not is_household_member(v_hid) then raise exception 'accès refusé à ce foyer' using errcode = '42501'; end if;

      execute format('select to_jsonb(t) from public.%I t where id = $1 for update', p_table) into existing using v_id;

      if existing is null then
        merged := jsonb_build_object('id', v_id, 'household_id', v_hid);
        ts := '{}'::jsonb;
      else
        if (existing ->> 'household_id')::uuid <> v_hid then raise exception 'foyer incohérent' using errcode = '42501'; end if;
        merged := existing;
        ts := coalesce(existing -> 'field_ts', '{}'::jsonb);
      end if;

      for k in select jsonb_object_keys(ch -> 'fields') loop
        continue when k = any (protected);
        incoming := coalesce((ch -> 'ts' ->> k)::bigint, 0);
        if incoming >= coalesce((ts ->> k)::bigint, 0) then
          merged := jsonb_set(merged, array[k], ch -> 'fields' -> k, true);
          ts := jsonb_set(ts, array[k], to_jsonb(incoming), true);
        end if;
      end loop;
      merged := jsonb_set(merged, '{field_ts}', ts, true);

      execute format(
        'insert into public.%1$I (%2$s) select %2$s from jsonb_populate_record(null::public.%1$I, $1)
         on conflict (id) do update set (%2$s) = (%3$s)',
        p_table, cols, excluded_cols
      ) using merged;
      applied := applied + 1;
    exception
      when insufficient_privilege or check_violation or not_null_violation or foreign_key_violation
        or unique_violation or invalid_text_representation or invalid_parameter_value
        or numeric_value_out_of_range or string_data_right_truncation then
        rejected := rejected || to_jsonb(coalesce(ch ->> 'id', '?'));
    end;
  end loop;
  return jsonb_build_object('applied', applied, 'rejected', rejected);
end $$;

revoke execute on function public.sync_push(text, jsonb) from public, anon;
grant execute on function public.sync_push(text, jsonb) to authenticated;

alter publication supabase_realtime add table public.recipes, public.recipe_folders, public.recipe_links, public.dietary_profiles, public.shopping_items;

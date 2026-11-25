-- Gaspalli — schéma complet, à exécuter UNE fois dans un projet Supabase neuf
-- (Dashboard › SQL Editor › New query › coller › Run).
-- Fichier généré à partir de supabase/migrations/ : ne pas le modifier à la main
-- (UPDATE_SETUP=1 npx jest __tests__/supabaseSetup.test.ts pour le régénérer).

-- ═══ 20261124120000_foyers_et_inventaire.sql ═══

-- Gaspalli — foyers partagés, inventaire synchronisé, RLS.
--
-- Principes
-- * Toutes les données partagées portent un household_id ; un utilisateur ne voit que ses foyers (RLS).
-- * Les tables synchronisées reprennent les colonnes de la base locale (SQLite) : identifiants UUID
--   générés sur le téléphone, dates en millisecondes (bigint), suppression douce (deleted_at).
-- * Résolution des conflits « dernière modification gagne » PAR CHAMP : field_ts garde, pour chaque
--   champ, l'horodatage de sa dernière modification ; sync_push() n'applique un champ que s'il est plus récent.
-- * server_seq (séquence) sert de curseur pour la récupération incrémentale (indépendant des horloges).

-- ─────────────────────────────────────────────────────────────────────────────
-- Profils
-- ─────────────────────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 40),
  created_at timestamptz not null default now()
);

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(coalesce(new.email, ''), '@', 1),
      ''
    ), 40)
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- Foyers et membres
-- ─────────────────────────────────────────────────────────────────────────────
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  invite_code text not null unique,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'membre' check (role in ('admin', 'membre')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index household_members_user_idx on public.household_members (user_id);

/** Code d'invitation : 8 caractères sans ambiguïté (ni 0/O, ni 1/I/L), tirés d'un UUID v4 (aléa fort). */
create function public.gen_invite_code() returns text
language plpgsql volatile as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  raw bytea := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
  code text := '';
  -- Octets 6 et 8 contiennent la version / la variante (non aléatoires) : on les évite.
  idx int[] := array[0, 1, 2, 3, 4, 5, 10, 11];
  i int;
begin
  foreach i in array idx loop
    code := code || substr(alphabet, (get_byte(raw, i) % 31) + 1, 1);
  end loop;
  return code;
end $$;

create function public.is_household_member(hid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from household_members where household_id = hid and user_id = auth.uid());
$$;

create function public.is_household_admin(hid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from household_members where household_id = hid and user_id = auth.uid() and role = 'admin');
$$;

/** Crée un foyer ; l'appelant en devient administrateur. */
create function public.create_household(p_name text, p_display_name text default null)
returns public.households
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  h public.households;
begin
  if uid is null then raise exception 'non connecté' using errcode = '28000'; end if;
  if nullif(trim(p_display_name), '') is not null then
    update profiles set display_name = left(trim(p_display_name), 40) where id = uid;
  end if;
  loop
    begin
      insert into households (name, invite_code, created_by)
      values (left(trim(p_name), 60), gen_invite_code(), uid)
      returning * into h;
      exit;
    exception when unique_violation then
      -- collision de code (rarissime) : on retente
    end;
  end loop;
  insert into household_members (household_id, user_id, role) values (h.id, uid, 'admin');
  return h;
end $$;

/** Rejoint un foyer avec son code d'invitation (insensible à la casse, espaces ignorés). */
create function public.join_household(p_code text, p_display_name text default null)
returns public.households
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  h public.households;
begin
  if uid is null then raise exception 'non connecté' using errcode = '28000'; end if;
  select * into h from households where invite_code = upper(regexp_replace(p_code, '[\s-]', '', 'g'));
  if h.id is null then raise exception 'code d''invitation inconnu' using errcode = 'P0002'; end if;
  if nullif(trim(p_display_name), '') is not null then
    update profiles set display_name = left(trim(p_display_name), 40) where id = uid;
  end if;
  insert into household_members (household_id, user_id, role) values (h.id, uid, 'membre')
  on conflict do nothing;
  return h;
end $$;

/** Nouveau code d'invitation (l'ancien ne fonctionne plus). Administrateurs uniquement. */
create function public.regenerate_invite_code(p_household uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  code text;
begin
  if not is_household_admin(p_household) then raise exception 'réservé aux administrateurs' using errcode = '42501'; end if;
  loop
    begin
      update households set invite_code = gen_invite_code() where id = p_household returning invite_code into code;
      return code;
    exception when unique_violation then
    end;
  end loop;
end $$;

/**
 * Quitte un foyer. Dernier membre : le foyer et ses données sont supprimés.
 * Dernier administrateur : le membre le plus ancien devient administrateur.
 */
create function public.leave_household(p_household uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  delete from household_members where household_id = p_household and user_id = uid;
  if not found then return; end if;
  if not exists (select 1 from household_members where household_id = p_household) then
    delete from households where id = p_household;
  elsif not exists (select 1 from household_members where household_id = p_household and role = 'admin') then
    update household_members set role = 'admin'
    where household_id = p_household
      and user_id = (select user_id from household_members where household_id = p_household order by joined_at limit 1);
  end if;
end $$;

/** Retire un membre. Administrateurs uniquement (pour soi-même : leave_household). */
create function public.remove_member(p_household uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_household_admin(p_household) then raise exception 'réservé aux administrateurs' using errcode = '42501'; end if;
  if p_user = auth.uid() then raise exception 'utilise leave_household pour quitter le foyer'; end if;
  delete from household_members where household_id = p_household and user_id = p_user;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Tables synchronisées (miroir de la base locale)
-- ─────────────────────────────────────────────────────────────────────────────
create sequence public.sync_seq;

create table public.products (
  id uuid primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  barcode text,
  name text not null,
  brand text,
  category text not null,
  image_url text,
  default_quantity double precision,
  default_unit text,
  nutriscore text,
  allergens text,
  source text not null check (source in ('off', 'manuel')),
  field_ts jsonb not null default '{}',
  server_seq bigint not null default nextval('public.sync_seq')
);
create index products_household_seq_idx on public.products (household_id, server_seq);
create index products_household_barcode_idx on public.products (household_id, barcode);

create table public.inventory_items (
  id uuid primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  product_id uuid,
  name text not null,
  brand text,
  category text not null,
  image_url text,
  quantity double precision not null,
  unit text not null,
  location text not null check (location in ('frigo', 'congelo', 'placard')),
  date_type text not null check (date_type in ('DLC', 'DDM')),
  expires_at bigint not null,
  expiry_estimated boolean not null default false,
  opened_at bigint,
  status text not null check (status in ('en_stock', 'consomme', 'jete')),
  price double precision,
  added_by uuid,
  field_ts jsonb not null default '{}',
  server_seq bigint not null default nextval('public.sync_seq')
);
create index inventory_items_household_seq_idx on public.inventory_items (household_id, server_seq);

create table public.events (
  id uuid primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  item_id uuid not null,
  type text not null check (type in ('ajout', 'consomme', 'jete', 'entame', 'partiel', 'modif')),
  product_name text not null,
  category text not null,
  quantity double precision,
  unit text,
  value double precision,
  detail text,
  author_id uuid,
  field_ts jsonb not null default '{}',
  server_seq bigint not null default nextval('public.sync_seq')
);
create index events_household_seq_idx on public.events (household_id, server_seq);

/** Chaque écriture fait avancer le curseur de synchronisation. */
create function public.bump_server_seq() returns trigger
language plpgsql as $$
begin
  new.server_seq := nextval('public.sync_seq');
  return new;
end $$;

create trigger products_bump_seq before insert or update on public.products
  for each row execute function public.bump_server_seq();
create trigger inventory_items_bump_seq before insert or update on public.inventory_items
  for each row execute function public.bump_server_seq();
create trigger events_bump_seq before insert or update on public.events
  for each row execute function public.bump_server_seq();

/**
 * Applique des modifications venant d'un téléphone, champ par champ (dernière modification gagne).
 * p_changes : [{ "id", "household_id", "fields": { colonne: valeur }, "ts": { colonne: ms } }, …]
 * Exécutée avec les droits de l'appelant : la RLS s'applique à chaque lecture / écriture.
 */
create function public.sync_push(p_table text, p_changes jsonb) returns integer
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
begin
  if p_table not in ('products', 'inventory_items', 'events') then
    raise exception 'table non synchronisée : %', p_table using errcode = '42501';
  end if;

  select string_agg(quote_ident(column_name), ', ' order by ordinal_position),
         string_agg('excluded.' || quote_ident(column_name), ', ' order by ordinal_position)
    into cols, excluded_cols
  from information_schema.columns
  where table_schema = 'public' and table_name = p_table and column_name <> 'server_seq';

  for ch in select value from jsonb_array_elements(p_changes) loop
    v_id := (ch ->> 'id')::uuid;
    v_hid := (ch ->> 'household_id')::uuid;
    if v_id is null or v_hid is null then raise exception 'id et household_id sont obligatoires'; end if;
    if jsonb_typeof(ch -> 'fields') <> 'object' or jsonb_typeof(coalesce(ch -> 'ts', '{}'::jsonb)) <> 'object' then
      raise exception 'fields et ts doivent être des objets JSON';
    end if;
    if not is_household_member(v_hid) then raise exception 'accès refusé à ce foyer' using errcode = '42501'; end if;

    execute format('select to_jsonb(t) from public.%I t where id = $1 for update', p_table) into existing using v_id;

    if existing is null then
      merged := jsonb_build_object('id', v_id, 'household_id', v_hid);
      ts := '{}'::jsonb;
    else
      if (existing ->> 'household_id')::uuid <> v_hid then raise exception 'foyer incohérent pour %', v_id; end if;
      merged := existing;
      ts := coalesce(existing -> 'field_ts', '{}'::jsonb);
    end if;

    for k in select jsonb_object_keys(coalesce(ch -> 'fields', '{}'::jsonb)) loop
      continue when k = any (protected);
      incoming := coalesce((ch -> 'ts' ->> k)::bigint, 0);
      -- À égalité, la modification qui arrive en dernier l'emporte.
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
  end loop;
  return applied;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.products enable row level security;
alter table public.inventory_items enable row level security;
alter table public.events enable row level security;

-- Profils : le sien, et ceux des membres de ses foyers (pour « ajouté par Léa »).
create policy profiles_select on public.profiles for select to authenticated using (
  id = auth.uid() or exists (
    select 1 from public.household_members mine
    join public.household_members theirs on theirs.household_id = mine.household_id
    where mine.user_id = auth.uid() and theirs.user_id = profiles.id
  )
);
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Foyers : visibles par leurs membres, renommables par les administrateurs. Création via create_household().
create policy households_select on public.households for select to authenticated using (public.is_household_member(id));
create policy households_update on public.households for update to authenticated
  using (public.is_household_admin(id)) with check (public.is_household_admin(id));

-- Membres : visibles par les membres du même foyer. Ajout / départ via les fonctions ci-dessus.
create policy members_select on public.household_members for select to authenticated using (public.is_household_member(household_id));
create policy members_update_role on public.household_members for update to authenticated
  using (public.is_household_admin(household_id)) with check (public.is_household_admin(household_id));

-- Données synchronisées : tout membre du foyer lit et écrit.
create policy products_rw on public.products for all to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy inventory_items_rw on public.inventory_items for all to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy events_rw on public.events for all to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- Droits : rien pour anon, le strict nécessaire pour authenticated.
-- ─────────────────────────────────────────────────────────────────────────────
revoke all on public.profiles, public.households, public.household_members,
  public.products, public.inventory_items, public.events from anon;
grant select, update on public.profiles to authenticated;
grant select, update on public.households to authenticated;
grant select, update on public.household_members to authenticated;
grant select, insert, update on public.products, public.inventory_items, public.events to authenticated;
grant usage on sequence public.sync_seq to authenticated;

revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.create_household(text, text),
  public.join_household(text, text),
  public.regenerate_invite_code(uuid),
  public.leave_household(uuid),
  public.remove_member(uuid, uuid),
  public.sync_push(text, jsonb),
  -- Utilisées par les politiques RLS, donc évaluées avec les droits de l'appelant.
  public.is_household_member(uuid),
  public.is_household_admin(uuid)
to authenticated;
-- gen_invite_code() n'est appelée que par des fonctions « security definer » ;
-- bump_server_seq() est une fonction de trigger : ni l'une ni l'autre n'est exposée.

-- ─────────────────────────────────────────────────────────────────────────────
-- Realtime : les autres membres sont prévenus des changements.
-- ─────────────────────────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.products, public.inventory_items, public.events, public.household_members;

-- ═══ 20261124160000_recettes_preferences_courses.sql ═══

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

-- ═══ 20261124180000_recettes_ia.sql ═══

-- Gaspalli — recettes générées par IA : quota par foyer et par jour, cache des réponses.
-- Seule l'Edge Function generate-recipe (rôle service_role) réserve et enregistre les générations ;
-- les membres du foyer peuvent relire l'historique.

create table public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  status text not null check (status in ('pending', 'done', 'failed')),
  /** Empreinte SHA-256 de la demande normalisée (produits, contraintes, envie, variante). */
  cache_key text not null,
  recipe jsonb,
  model text,
  input_tokens integer,
  output_tokens integer,
  attempts integer
);
create index ai_generations_household_day_idx on public.ai_generations (household_id, created_at desc);
create index ai_generations_cache_idx on public.ai_generations (household_id, cache_key);

alter table public.ai_generations enable row level security;
create policy ai_generations_select on public.ai_generations for select to authenticated
  using (public.is_household_member(household_id));
revoke all on public.ai_generations from anon, authenticated;
grant select on public.ai_generations to authenticated;

/** Début du jour en cours, heure de Paris (le quota se renouvelle à minuit). */
create function public.ai_day_start() returns timestamptz
language sql stable as $$
  select date_trunc('day', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris';
$$;

/**
 * Réserve une génération pour le foyer, sous verrou (deux appels simultanés ne dépassent pas le quota).
 * - Réponse en cache (même demande, moins de 3 jours) : la renvoie, sans consommer de quota.
 * - Quota atteint : reservation = null.
 * Une réservation « pending » de plus de 10 minutes (fonction interrompue) ne compte plus.
 */
create function public.ai_reserve_generation(p_household uuid, p_user uuid, p_cache_key text, p_daily_limit integer)
returns table (reservation uuid, used integer, cached jsonb)
language plpgsql security definer set search_path = public as $$
declare
  n integer;
  c jsonb;
  r uuid;
begin
  perform pg_advisory_xact_lock(hashtext('ai:' || p_household::text));
  select g.recipe into c from ai_generations g
  where g.household_id = p_household and g.cache_key = p_cache_key and g.status = 'done' and g.created_at > now() - interval '3 days'
  order by g.created_at desc limit 1;
  select count(*) into n from ai_generations g
  where g.household_id = p_household and g.created_at >= ai_day_start()
    and (g.status = 'done' or (g.status = 'pending' and g.created_at > now() - interval '10 minutes'));
  if c is not null then
    return query select null::uuid, n, c;
    return;
  end if;
  if n >= p_daily_limit then
    return query select null::uuid, n, null::jsonb;
    return;
  end if;
  insert into ai_generations (household_id, user_id, status, cache_key) values (p_household, p_user, 'pending', p_cache_key)
  returning id into r;
  return query select r, n + 1, null::jsonb;
end $$;

create function public.ai_complete_generation(p_id uuid, p_recipe jsonb, p_model text, p_input_tokens integer, p_output_tokens integer, p_attempts integer)
returns void language sql security definer set search_path = public as $$
  update ai_generations set status = 'done', recipe = p_recipe, model = p_model,
    input_tokens = p_input_tokens, output_tokens = p_output_tokens, attempts = p_attempts
  where id = p_id;
$$;

/** Échec (erreur, refus, recette invalide) : la génération ne compte pas dans le quota. */
create function public.ai_fail_generation(p_id uuid, p_attempts integer)
returns void language sql security definer set search_path = public as $$
  update ai_generations set status = 'failed', attempts = p_attempts where id = p_id;
$$;

revoke execute on function public.ai_reserve_generation(uuid, uuid, text, integer),
  public.ai_complete_generation(uuid, jsonb, text, integer, integer, integer),
  public.ai_fail_generation(uuid, integer),
  public.ai_day_start()
from public, anon, authenticated;
grant execute on function public.ai_reserve_generation(uuid, uuid, text, integer),
  public.ai_complete_generation(uuid, jsonb, text, integer, integer, integer),
  public.ai_fail_generation(uuid, integer),
  public.ai_day_start()
to service_role;

-- ═══ 20261124200000_planning_repas.sql ═══

-- Gaspalli — planning des repas partagé par le foyer.

create table public.meal_plan (
  id uuid primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  date text not null check (date ~ '^\d{4}-\d{2}-\d{2}$'),
  slot text not null check (slot in ('midi', 'soir')),
  -- Recette de la base (identifiant texte) ou recette perso (UUID).
  recipe_id text not null,
  servings integer not null check (servings between 1 and 50),
  done boolean not null default false,
  field_ts jsonb not null default '{}',
  server_seq bigint not null default nextval('public.sync_seq')
);
create index meal_plan_household_seq_idx on public.meal_plan (household_id, server_seq);

create trigger meal_plan_bump_seq before insert or update on public.meal_plan
  for each row execute function public.bump_server_seq();

alter table public.meal_plan enable row level security;
create policy meal_plan_rw on public.meal_plan for all to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
revoke all on public.meal_plan from anon;
grant select, insert, update on public.meal_plan to authenticated;

alter publication supabase_realtime add table public.meal_plan;

/**
 * Tables acceptées par sync_push. Les prochaines migrations ajoutent une table en remplaçant
 * cette fonction (au lieu de recopier sync_push).
 */
create function public.synced_tables() returns text[]
language sql immutable as $$
  select array['products', 'inventory_items', 'events', 'recipes', 'recipe_folders', 'recipe_links',
               'dietary_profiles', 'shopping_items', 'meal_plan'];
$$;
grant execute on function public.synced_tables() to authenticated;

-- sync_push lit désormais la liste ci-dessus (corps identique à la migration précédente sinon).
create or replace function public.sync_push(p_table text, p_changes jsonb) returns jsonb
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
  if not (p_table = any (public.synced_tables())) then
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

-- ═══ 20261125090000_ticket_de_caisse.sql ═══

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

-- ═══ 20261125120000_suppression_compte.sql ═══

-- Gaspalli — suppression de compte (exigence Apple, droit à l'effacement RGPD).
-- Appelée uniquement par l'Edge Function « delete-account » (clé service role), avant la
-- suppression de l'utilisateur dans Supabase Auth.

create function public.delete_account_data(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  h uuid;
begin
  for h in select household_id from household_members where user_id = p_user loop
    delete from household_members where household_id = h and user_id = p_user;
    if not exists (select 1 from household_members where household_id = h) then
      -- Dernier membre : le foyer et toutes ses données disparaissent (cascade).
      delete from households where id = h;
    else
      if not exists (select 1 from household_members where household_id = h and role = 'admin') then
        update household_members set role = 'admin'
        where household_id = h
          and user_id = (select user_id from household_members where household_id = h order by joined_at limit 1);
      end if;
      -- Les données partagées restent au foyer, sans lien avec la personne.
      update inventory_items set added_by = null where household_id = h and added_by = p_user;
      update events set author_id = null where household_id = h and author_id = p_user;
      update recipes set author_id = null where household_id = h and author_id = p_user;
      update shopping_items set added_by = null where household_id = h and added_by = p_user;
    end if;
  end loop;
  -- Préférences alimentaires (allergies : donnée de santé) et profil ; ai_generations.user_id passe à null.
  delete from dietary_profiles where user_id = p_user;
  delete from profiles where id = p_user;
end $$;

revoke all on function public.delete_account_data(uuid) from public, anon, authenticated;
grant execute on function public.delete_account_data(uuid) to service_role;

-- ═══ 20261125150000_recettes_importees.sql ═══

-- Gaspalli — recettes importées d'un site : lien vers la page d'origine.
alter table public.recipes add column source_url text check (char_length(source_url) <= 2000);

-- ═══ 20261125180000_listes_enregistrees.sql ═══

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

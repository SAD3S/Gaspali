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
  public.is_household_member(uuid),
  public.is_household_admin(uuid),
  public.gen_invite_code(),
  public.bump_server_seq()
to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Realtime : les autres membres sont prévenus des changements.
-- ─────────────────────────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.products, public.inventory_items, public.events, public.household_members;

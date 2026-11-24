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

-- Tests de la migration « foyers et inventaire » (RLS, fonctions, synchro champ par champ).
-- Lancer : supabase/tests/run.sh  (Postgres nu + 00_supabase_stub.sql + migrations + ce fichier)
\set ON_ERROR_STOP on
\set alice '''a0000000-0000-4000-8000-000000000001'''
\set bob   '''b0000000-0000-4000-8000-000000000002'''
\set carol '''c0000000-0000-4000-8000-000000000003'''

insert into auth.users (id, email, raw_user_meta_data) values
  (:alice, 'alice@example.test', '{"full_name": "Alice"}'),
  (:bob,   'bob@example.test',   '{}'),
  (:carol, 'carol@example.test', '{}');

create function pg_temp.as_user(uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid, false);
  execute 'set role authenticated';
end $$;

-- Profils créés automatiquement
do $$ begin
  assert (select display_name from public.profiles where id = 'a0000000-0000-4000-8000-000000000001') = 'Alice', 'profil Alice (full_name)';
  assert (select display_name from public.profiles where id = 'b0000000-0000-4000-8000-000000000002') = 'bob', 'profil Bob (e-mail)';
end $$;

-- 1. Alice crée un foyer
select pg_temp.as_user(:alice);
create temp table t_h as select * from public.create_household('Chez nous', 'Alice');
grant select on t_h to authenticated, service_role;
do $$ declare h record; begin
  select * into h from t_h;
  assert h.invite_code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$', 'format du code : ' || h.invite_code;
  assert (select role from public.household_members where household_id = h.id and user_id = auth.uid()) = 'admin', 'Alice admin';
end $$;
reset role;

-- 2. Bob rejoint avec le code (minuscules, espaces)
select pg_temp.as_user(:bob);
select public.join_household(lower(substr(invite_code, 1, 4) || ' ' || substr(invite_code, 5)), 'Bob') from t_h;
do $$ begin
  assert (select count(*) from public.household_members) = 2, 'Bob voit les 2 membres';
  assert (select count(*) from public.profiles) = 2, 'Bob voit le profil d''Alice et le sien';
  assert (select display_name from public.profiles where id = auth.uid()) = 'Bob', 'prénom de Bob mis à jour';
end $$;
-- code inconnu
do $$ begin
  perform public.join_household('ZZZZZZZZ');
  raise exception 'aurait dû échouer';
exception when no_data_found then null;
end $$;
-- Bob n'est pas admin
do $$ begin
  perform public.regenerate_invite_code((select id from t_h));
  raise exception 'aurait dû échouer';
exception when insufficient_privilege then null;
end $$;
reset role;

-- 3. Alice crée un article via sync_push
select pg_temp.as_user(:alice);
select public.sync_push('inventory_items', jsonb_build_array(jsonb_build_object(
  'id', 'd0000000-0000-4000-8000-000000000010',
  'household_id', (select id from t_h),
  'fields', jsonb_build_object(
    'created_at', 1000, 'updated_at', 1000, 'name', 'Crème fraîche', 'category', 'laitier',
    'quantity', 20, 'unit', 'cl', 'location', 'frigo', 'date_type', 'DLC', 'expires_at', 1800000000000,
    'expiry_estimated', true, 'status', 'en_stock', 'added_by', 'a0000000-0000-4000-8000-000000000001'),
  'ts', jsonb_build_object(
    'created_at', 1000, 'updated_at', 1000, 'name', 1000, 'category', 1000, 'quantity', 1000, 'unit', 1000,
    'location', 1000, 'date_type', 1000, 'expires_at', 1000, 'expiry_estimated', 1000, 'status', 1000, 'added_by', 1000)
)));
reset role;

-- 4. Conflits champ par champ
select pg_temp.as_user(:alice);
create temp table t_seq as select server_seq from public.inventory_items;
grant select on t_seq to authenticated;
-- Alice (hors ligne) change la quantité à t=2000
select public.sync_push('inventory_items', jsonb_build_array(jsonb_build_object(
  'id', 'd0000000-0000-4000-8000-000000000010', 'household_id', (select id from t_h),
  'fields', '{"quantity": 10}'::jsonb, 'ts', '{"quantity": 2000}'::jsonb)));
reset role;
select pg_temp.as_user(:bob);
-- Bob change l'emplacement à t=1500 et la quantité à t=1200 (plus ancienne que celle d'Alice)
select public.sync_push('inventory_items', jsonb_build_array(jsonb_build_object(
  'id', 'd0000000-0000-4000-8000-000000000010', 'household_id', (select id from t_h),
  'fields', '{"location": "congelo", "quantity": 5, "household_id": "00000000-0000-4000-8000-000000000000"}'::jsonb,
  'ts', '{"location": 1500, "quantity": 1200, "household_id": 9999}'::jsonb)));
do $$ declare r record; begin
  select * into r from public.inventory_items;
  assert r.quantity = 10, 'quantité : la modif la plus récente (Alice) gagne, obtenu ' || r.quantity;
  assert r.location = 'congelo', 'emplacement : la modif de Bob est appliquée';
  assert r.household_id = (select id from t_h), 'household_id protégé';
  assert (r.field_ts ->> 'quantity')::bigint = 2000 and (r.field_ts ->> 'location')::bigint = 1500, 'field_ts';
  assert r.server_seq > (select server_seq from t_seq), 'server_seq avance à chaque écriture';
  assert r.expiry_estimated is true, 'booléen conservé';
end $$;
reset role;

-- 5. Carol (autre foyer) ne voit rien et ne peut rien écrire
select pg_temp.as_user(:carol);
do $$ begin
  assert (select count(*) from public.households) = 0, 'Carol ne voit pas le foyer';
  assert (select count(*) from public.household_members) = 0, 'Carol ne voit pas les membres';
  assert (select count(*) from public.inventory_items) = 0, 'Carol ne voit pas l''inventaire';
  assert (select count(*) from public.profiles) = 1, 'Carol ne voit que son profil';
end $$;
do $$ declare res jsonb; begin
  -- Carol connaît l'identifiant du foyer (fuite, devinette…) mais n'en est pas membre : ligne rejetée.
  res := public.sync_push('inventory_items', jsonb_build_array(jsonb_build_object(
    'id', 'd0000000-0000-4000-8000-000000000010', 'household_id', (select id from t_h),
    'fields', '{"quantity": 0}'::jsonb, 'ts', '{"quantity": 99999}'::jsonb)));
  assert (res ->> 'applied')::int = 0 and res -> 'rejected' = '["d0000000-0000-4000-8000-000000000010"]'::jsonb, 'rejet de Carol : ' || res::text;
end $$;
do $$ begin
  update public.inventory_items set quantity = 0;
  assert not found, 'Carol ne peut pas modifier l''inventaire';
end $$;
do $$ begin
  perform public.sync_push('autre_table', '[]');
  raise exception 'aurait dû échouer';
exception when insufficient_privilege then null;
end $$;
reset role;

-- 6. Anonyme : aucun accès
set role anon;
do $$ begin
  perform count(*) from public.inventory_items;
  raise exception 'aurait dû échouer';
exception when insufficient_privilege then null;
end $$;
reset role;

-- 6 bis. Recettes, préférences, courses (migration 2)
select pg_temp.as_user(:bob);
do $$ declare res jsonb; hid uuid := (select id from t_h); begin
  -- Un lot mêlant une ligne valide et une ligne invalide : la valide passe, l'autre est rejetée.
  res := public.sync_push('recipes', jsonb_build_array(
    jsonb_build_object('id', 'e0000000-0000-4000-8000-000000000020', 'household_id', hid,
      'fields', jsonb_build_object('created_at', 1, 'updated_at', 1, 'title', 'Tarte de Bob', 'minutes', 30, 'servings', 4,
        'kind', 'dessert', 'tags', '["dessert","sans gluten"]', 'ingredients', '[]', 'steps', '["Cuire"]', 'source', 'perso'),
      'ts', '{"title": 1, "minutes": 1, "servings": 1}'::jsonb),
    jsonb_build_object('id', 'e0000000-0000-4000-8000-000000000021', 'household_id', hid,
      'fields', jsonb_build_object('created_at', 1, 'updated_at', 1, 'title', 'Trop longue', 'minutes', 99999, 'servings', 4,
        'kind', 'plat', 'tags', '[]', 'ingredients', '[]', 'steps', '[]', 'source', 'perso'),
      'ts', '{}'::jsonb)));
  assert (res ->> 'applied')::int = 1, 'une recette appliquée : ' || res::text;
  assert res -> 'rejected' = '["e0000000-0000-4000-8000-000000000021"]'::jsonb, 'la recette invalide est rejetée';
  -- Favori sur une recette de la base (identifiant texte)
  res := public.sync_push('recipe_links', jsonb_build_array(jsonb_build_object('id', 'e0000000-0000-4000-8000-000000000030', 'household_id', hid,
    'fields', '{"created_at": 1, "updated_at": 1, "recipe_id": "gratin-poulet-epinards", "kind": "favori"}'::jsonb, 'ts', '{}'::jsonb)));
  assert (res ->> 'applied')::int = 1, 'favori';
  -- Préférences : Bob écrit les siennes…
  res := public.sync_push('dietary_profiles', jsonb_build_array(jsonb_build_object('id', 'e0000000-0000-4000-8000-000000000040', 'household_id', hid,
    'fields', jsonb_build_object('created_at', 1, 'updated_at', 1, 'user_id', 'b0000000-0000-4000-8000-000000000002', 'diet', 'vegetarien', 'allergens', '["lait"]', 'dislikes', '[]'),
    'ts', '{}'::jsonb)));
  assert (res ->> 'applied')::int = 1, 'préférences de Bob';
  -- … mais pas celles d'Alice.
  res := public.sync_push('dietary_profiles', jsonb_build_array(jsonb_build_object('id', 'e0000000-0000-4000-8000-000000000041', 'household_id', hid,
    'fields', jsonb_build_object('created_at', 1, 'updated_at', 1, 'user_id', 'a0000000-0000-4000-8000-000000000001', 'diet', 'vegan', 'allergens', '[]', 'dislikes', '[]'),
    'ts', '{}'::jsonb)));
  assert (res ->> 'applied')::int = 0, 'Bob ne peut pas écrire les préférences d''Alice';
  -- Courses
  res := public.sync_push('shopping_items', jsonb_build_array(jsonb_build_object('id', 'e0000000-0000-4000-8000-000000000050', 'household_id', hid,
    'fields', '{"created_at": 1, "updated_at": 1, "name": "Lait", "aisle": "Crèmerie", "checked": false}'::jsonb, 'ts', '{}'::jsonb)));
  assert (res ->> 'applied')::int = 1, 'article de courses';
end $$;
reset role;
select pg_temp.as_user(:alice);
do $$ begin
  assert (select count(*) from public.recipes) = 1, 'Alice voit la recette de Bob';
  assert (select diet from public.dietary_profiles) = 'vegetarien', 'Alice voit les préférences de Bob';
  assert (select count(*) from public.shopping_items) = 1, 'Alice voit la liste de courses';
end $$;
reset role;
select pg_temp.as_user(:carol);
do $$ begin
  assert (select count(*) from public.recipes) + (select count(*) from public.dietary_profiles) + (select count(*) from public.shopping_items) = 0,
    'Carol ne voit rien du foyer';
end $$;
reset role;

-- 6 ter. Recettes IA : quota, cache, droits (migration 3)
set role service_role;
do $$ declare hid uuid := (select id from t_h); r record; i int; begin
  -- 3 générations autorisées par jour
  for i in 1..3 loop
    select * into r from public.ai_reserve_generation(hid, 'a0000000-0000-4000-8000-000000000001', 'cle-' || i, 3);
    assert r.reservation is not null and r.used = i, 'réservation ' || i;
    perform public.ai_complete_generation(r.reservation, jsonb_build_object('title', 'Recette ' || i), 'claude-opus-5-5', 1000, 500, 1);
  end loop;
  select * into r from public.ai_reserve_generation(hid, 'a0000000-0000-4000-8000-000000000001', 'cle-4', 3);
  assert r.reservation is null and r.cached is null and r.used = 3, 'quota atteint';
  -- Même demande qu'avant : réponse en cache, même quota atteint
  select * into r from public.ai_reserve_generation(hid, 'a0000000-0000-4000-8000-000000000001', 'cle-2', 3);
  assert r.reservation is null and r.cached ->> 'title' = 'Recette 2', 'cache';
  -- Un échec ne consomme pas de quota
  select * into r from public.ai_reserve_generation(hid, null, 'cle-5', 4);
  assert r.reservation is not null, 'réservation avec quota 4';
  perform public.ai_fail_generation(r.reservation, 3);
  select * into r from public.ai_reserve_generation(hid, null, 'cle-6', 4);
  assert r.reservation is not null, 'l''échec a libéré la place';
end $$;
reset role;
select pg_temp.as_user(:bob);
do $$ begin
  assert (select count(*) from public.ai_generations) >= 4, 'les membres relisent l''historique';
  perform public.ai_reserve_generation((select id from t_h), auth.uid(), 'triche', 1000);
  raise exception 'aurait dû échouer';
exception when insufficient_privilege then null;
end $$;
reset role;
select pg_temp.as_user(:carol);
do $$ begin
  assert (select count(*) from public.ai_generations) = 0, 'Carol ne voit pas l''historique du foyer';
end $$;
reset role;

-- 6 quater. Planning des repas (migration 4)
select pg_temp.as_user(:alice);
do $$ declare res jsonb; hid uuid := (select id from t_h); begin
  res := public.sync_push('meal_plan', jsonb_build_array(
    jsonb_build_object('id', 'f0000000-0000-4000-8000-000000000060', 'household_id', hid,
      'fields', '{"created_at": 1, "updated_at": 1, "date": "2026-11-26", "slot": "soir", "recipe_id": "gratin-poulet-epinards", "servings": 4, "done": false}'::jsonb, 'ts', '{}'::jsonb),
    jsonb_build_object('id', 'f0000000-0000-4000-8000-000000000061', 'household_id', hid,
      'fields', '{"created_at": 1, "updated_at": 1, "date": "26/11", "slot": "soir", "recipe_id": "x", "servings": 4, "done": false}'::jsonb, 'ts', '{}'::jsonb)));
  assert (res ->> 'applied')::int = 1 and res -> 'rejected' = '["f0000000-0000-4000-8000-000000000061"]'::jsonb, 'planning : ' || res::text;
  begin
    perform public.sync_push('pas_une_table', '[]');
    raise exception 'aurait dû échouer';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select pg_temp.as_user(:bob);
do $$ begin
  assert (select recipe_id from public.meal_plan) = 'gratin-poulet-epinards', 'Bob voit le planning du foyer';
end $$;
reset role;

-- 7. Code régénéré par l'admin ; départs
select pg_temp.as_user(:alice);
do $$ declare old text; neu text; begin
  select invite_code into old from public.households;
  neu := public.regenerate_invite_code((select id from public.households));
  assert neu <> old and neu ~ '^[A-Z2-9]{8}$', 'nouveau code';
end $$;
select public.leave_household(id) from t_h;
reset role;
do $$ begin
  assert (select role from public.household_members where user_id = 'b0000000-0000-4000-8000-000000000002') = 'admin',
    'Bob devient admin après le départ d''Alice';
end $$;
select pg_temp.as_user(:bob);
select public.leave_household(id) from t_h;
reset role;
do $$ begin
  assert (select count(*) from public.households) = 0, 'dernier membre parti : foyer supprimé';
  assert (select count(*) from public.inventory_items) = 0, 'données supprimées avec le foyer';
end $$;

\echo '✔ Tous les tests SQL passent'

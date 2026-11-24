-- Reproduit le strict nécessaire de l'environnement Supabase pour tester les migrations
-- sur un Postgres nu (local ou CI). NE PAS exécuter sur un vrai projet Supabase.
-- Les rôles sont globaux au serveur : on ne les crée qu'une fois.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema auth;
grant usage on schema auth to authenticated, anon;
grant usage on schema public to authenticated, anon, service_role;

create table auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb not null default '{}'
);

-- Comme Supabase : l'identifiant de l'utilisateur vient du JWT (ici, un réglage de session).
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant execute on function auth.uid() to authenticated, anon;

create publication supabase_realtime;

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

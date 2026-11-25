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

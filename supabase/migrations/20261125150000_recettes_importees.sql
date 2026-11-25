-- Gaspalli — recettes importées d'un site : lien vers la page d'origine.
alter table public.recipes add column source_url text check (char_length(source_url) <= 2000);

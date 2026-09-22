-- ============================================================================
-- 0007_seed_cote_ivoire.sql
-- Amorçage du premier référentiel (Convention §8). Volontairement minimal :
-- un squelette (pays, système, année, cycle, niveaux, 2 matières) à enrichir
-- avec les programmes/guides/progressions officiels DPFC au fur et à mesure
-- qu'ils sont numérisés. Ne JAMAIS inventer un contenu de programme (§19).
-- ============================================================================

insert into countries (iso_code, name, default_locale)
values ('CI', 'Côte d''Ivoire', 'fr')
on conflict (iso_code) do nothing;

insert into education_systems (country_id, name, authority_name)
select id, 'Système éducatif ivoirien', 'MENA / DPFC'
from countries where iso_code = 'CI'
on conflict do nothing;

insert into school_years (country_id, label, starts_on, ends_on, is_current)
select c.id, '2026-2027', '2026-09-01', '2027-07-15', true
from countries c where c.iso_code = 'CI'
on conflict do nothing;

insert into education_cycles (education_system_id, name, ordering)
select es.id, v.name, v.ordering
from education_systems es
join countries c on c.id = es.country_id and c.iso_code = 'CI'
cross join (values ('Collège', 1), ('Lycée', 2)) as v(name, ordering);

insert into education_levels (cycle_id, name, ordering)
select ec.id, v.level_name, v.ordering
from education_cycles ec
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
cross join lateral (
  values
    ('Collège', '6e', 1), ('Collège', '5e', 2), ('Collège', '4e', 3), ('Collège', '3e', 4),
    ('Lycée', '2nde', 1), ('Lycée', '1ère', 2), ('Lycée', 'Terminale', 3)
) as v(cycle_name, level_name, ordering)
where ec.name = v.cycle_name
on conflict do nothing;

insert into subjects (education_system_id, name)
select es.id, v.name
from education_systems es
join countries c on c.id = es.country_id and c.iso_code = 'CI'
cross join (values ('Mathématiques'), ('Français'), ('SVT'), ('Physique-Chimie'), ('Histoire-Géographie'), ('Anglais')) as v(name)
on conflict do nothing;

-- Plans d'abonnement de départ (montants en FCFA, plus petite unité = 1 FCFA
-- donc pas de conversion nécessaire, mais toujours un entier — §32).
insert into plans (code, name, seats, price_minor_units, currency, billing_period)
values
  ('individual_monthly', 'Professeur individuel — mensuel', null, 3000, 'XOF', 'monthly'),
  ('individual_yearly', 'Professeur individuel — annuel', null, 27000, 'XOF', 'yearly'),
  ('establishment_25', 'Établissement — 25 licences', 25, 400000, 'XOF', 'yearly'),
  ('establishment_50', 'Établissement — 50 licences', 50, 700000, 'XOF', 'yearly')
on conflict (code) do nothing;

-- ============================================================================
-- Trigger : créer automatiquement un profil à l'inscription Supabase Auth.
-- ============================================================================
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

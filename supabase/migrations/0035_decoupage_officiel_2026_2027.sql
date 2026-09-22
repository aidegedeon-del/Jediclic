-- ============================================================================
-- 0035_decoupage_officiel_2026_2027.sql
-- Suite de 0032 (calendrier_scolaire) et du squelette de 0007 : le MENA/DELC
-- a publié le découpage officiel de l'année scolaire 2026-2027 le 4 septembre
-- 2026, lors de la réunion de rentrée au Lycée Sainte-Marie de Cocody
-- (annonce du directeur DELC, Zamblé Bi Zamblé Germain, source AIP).
--
-- Portée : enseignement général (préscolaire → secondaire) uniquement.
-- Les calendriers CAFOP (élèves-maîtres, 3 cohortes, périodes distinctes) ne
-- sont volontairement PAS chargés ici — hors scope, JedicliC s'adresse aux
-- enseignants de l'enseignement général.
--
-- 1) Corrige les dates placeholder de school_years posées par 0007
--    ('2026-09-01' / '2027-07-15', génériques, jamais officielles) par les
--    vraies dates : rentrée lundi 14 septembre 2026, fin vendredi 30 juillet
--    2027 (32 semaines 3 jours, 1304h au secondaire).
-- 2) Charge les 3 trimestres dans school_periods (jusqu'ici vide pour toute
--    année scolaire, cf. 0011 — cette migration ne pré-remplissait rien).
-- 3) Charge les congés dans school_calendar_events (0032), catégorie
--    'conge' uniquement : aucune date d'examen ni de journée pédagogique
--    n'a été communiquée dans cette annonce, donc rien n'est inventé pour
--    les catégories 'examen'/'pedagogique' (Convention §6/§54/§19).
-- ============================================================================

-- 1) Dates réelles de l'année scolaire 2026-2027
update school_years
set starts_on = '2026-09-14',
    ends_on = '2027-07-30'
where label = '2026-2027'
  and country_id = (select id from countries where iso_code = 'CI');

-- 2) Trimestres (enseignement général : préscolaire, primaire, secondaire)
insert into school_periods (school_year_id, label, ordering, starts_on, ends_on)
select sy.id, v.label, v.ordering, v.starts_on::date, v.ends_on::date
from school_years sy
join countries c on c.id = sy.country_id and c.iso_code = 'CI'
cross join (
  values
    ('Trimestre 1', 1, '2026-09-14', '2026-12-04'),
    ('Trimestre 2', 2, '2026-12-07', '2027-03-12'),
    ('Trimestre 3', 3, '2027-03-15', '2027-06-11')
) as v(label, ordering, starts_on, ends_on)
where sy.label = '2026-2027'
on conflict (school_year_id, label) do update
  set starts_on = excluded.starts_on,
      ends_on = excluded.ends_on;

-- 3) Congés officiels (catégorie 'conge' uniquement — pas d'examens/journées
--    pédagogiques communiqués à ce stade pour 2026-2027)
insert into school_calendar_events (school_year_id, category, label, starts_on, ends_on)
select sy.id, 'conge'::school_calendar_event_category, v.label, v.starts_on::date, v.ends_on::date
from school_years sy
join countries c on c.id = sy.country_id and c.iso_code = 'CI'
cross join (
  values
    ('Congés de la Toussaint', '2026-10-23', '2026-11-01'),
    ('Congés de Noël et du Nouvel An', '2026-12-18', '2027-01-03'),
    ('Congés de février', '2027-02-05', '2027-02-14'),
    ('Congés de Pâques', '2027-03-19', '2027-04-04'),
    ('Grandes vacances', '2027-07-30', '2027-09-12')
) as v(label, starts_on, ends_on)
where sy.label = '2026-2027';

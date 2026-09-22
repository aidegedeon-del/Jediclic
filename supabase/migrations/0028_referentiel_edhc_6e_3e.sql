-- ============================================================================
-- 0028_referentiel_edhc_6e_3e.sql
-- Référentiel EDHC (Éducation aux Droits de l'Homme et à la Citoyenneté)
-- niveaux 6e, 5e, 4e, 3e — premier cycle du secondaire uniquement.
--
-- CONTEXTE (décision explicite de l'utilisateur, 17 août 2026) :
-- L'EDHC n'existe pas au lycée (pas de programme DPFC après la 3e) et n'a
-- pas de "spécialiste" attitré — n'importe quel enseignant peut l'enseigner
-- selon son emploi du temps. Ce lot ajoute EDHC à la liste des disciplines
-- sélectionnables (table `subjects`) et charge son programme officiel sur les
-- 4 niveaux du collège.
--
-- SOURCE : Progressions annuelles EDHC 2024-2025, Ministère de l'Éducation
-- Nationale et de l'Alphabétisation / DPFC, Côte d'Ivoire.
-- URL : https://dpfc-ci.net/progressions/2024-2025/EDHC%20Progressions%202024-2025.pdf
-- Consultée le 17 août 2026.
--
-- Comme pour les autres matières (migrations 0012-0023) : aucun intitulé,
-- volume horaire ou découpage inventé — tout est recopié du document officiel.
-- `expected_week` = numéro de semaine tel que publié par la DPFC (1 à 30) ;
-- la dérivation semaine -> date réelle passe par drift.ts (même mécanisme
-- que le reste du référentiel).
--
-- Structure : chaque "COMPÉTENCE" officielle est modélisée comme une unité
-- parente (curriculum_units.parent_unit_id null) et chaque "Leçon" comme une
-- unité fille, exactement comme le fait la migration 0012 pour la SVT 6e.
-- Ce fichier utilisait auparavant des colonnes inexistantes
-- (`unit_order`, `competence_label`, `step_order`, `duration_hours` sur
-- `official_progression_steps`) : corrigé ici pour utiliser le schéma réel
-- défini en 0002_referentiel_educatif.sql (`ordering`, `recommended_hours`,
-- `parent_unit_id`, `expected_week`). Aucune donnée pédagogique n'a été
-- modifiée : mêmes intitulés de leçons, mêmes semaines, mêmes volumes
-- horaires que la version originale de ce fichier.
--
-- Non couvert : lycée (pas de programme EDHC officiel après la 3e), arts
-- plastiques, éducation musicale, EPS, TICE (décision utilisateur : hors
-- scope pour l'instant).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Ajout de la discipline EDHC dans la table subjects (CI uniquement)
-- ----------------------------------------------------------------------------
insert into subjects (education_system_id, name)
select es.id, 'EDHC'
from education_systems es
join countries c on c.id = es.country_id and c.iso_code = 'CI'
on conflict do nothing;

-- ============================================================================
-- 1. EDHC 6e
-- Volume officiel : 1H/semaine (30 séances, dont 5 devoirs + 1 révision)
-- Compétences : 5
-- ============================================================================

insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id,
  'DPFC 2024-2025',
  'https://dpfc-ci.net/progressions/2024-2025/EDHC%20Progressions%202024-2025.pdf',
  true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name = '6e'
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'EDHC'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

-- Compétences (unités parentes)
insert into curriculum_units (curriculum_id, title, ordering)
select cur.id, v.title, v.ordering
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'EDHC'
join education_levels el on el.id = cur.education_level_id and el.name = '6e'
cross join lateral (values
  ('COMPÉTENCE 1 : Traiter une situation relative aux droits de l''homme, aux droits de l''enfant et au droit international humanitaire (DIH)', 1),
  ('COMPÉTENCE 2 : Traiter une situation relative aux règles de vie communautaire et aux principes de la démocratie', 2),
  ('COMPÉTENCE 3 : Traiter une situation relative à l''entrepreneuriat et à l''éducation routière', 3),
  ('COMPÉTENCE 4 : Traiter une situation relative à la puberté', 4),
  ('COMPÉTENCE 5 : Traiter une situation relative à l''assainissement du cadre de vie', 5)
) as v(title, ordering)
where cur.version_label = 'DPFC 2024-2025';

-- Leçons (unités filles) — Compétence 1
insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'EDHC'
join education_levels el on el.id = cur.education_level_id and el.name = '6e'
cross join lateral (values
  ('Leçon 1 : Les droits à la survie et les droits à la protection de l''enfant', 1),
  ('Leçon 2 : Les droits humains', 2),
  ('Leçon 3 : Le droit international humanitaire (DIH)', 3)
) as v(title, ordering)
where p.title = 'COMPÉTENCE 1 : Traiter une situation relative aux droits de l''homme, aux droits de l''enfant et au droit international humanitaire (DIH)'
  and cur.version_label = 'DPFC 2024-2025';

-- Leçons — Compétence 2
insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'EDHC'
join education_levels el on el.id = cur.education_level_id and el.name = '6e'
cross join lateral (values
  ('Leçon 4 : La Constitution de la Côte d''Ivoire', 4),
  ('Leçon 5 : Le Président de la République', 5),
  ('Leçon 6 : Les règles de vie en famille et en communauté', 6),
  ('Leçon 7 : Les principes de la démocratie', 7)
) as v(title, ordering)
where p.title = 'COMPÉTENCE 2 : Traiter une situation relative aux règles de vie communautaire et aux principes de la démocratie'
  and cur.version_label = 'DPFC 2024-2025';

-- Leçons — Compétence 3
insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'EDHC'
join education_levels el on el.id = cur.education_level_id and el.name = '6e'
cross join lateral (values
  ('Leçon 8 : Les règles de la circulation routière', 8),
  ('Leçon 9 : Le secteur primaire', 9)
) as v(title, ordering)
where p.title = 'COMPÉTENCE 3 : Traiter une situation relative à l''entrepreneuriat et à l''éducation routière'
  and cur.version_label = 'DPFC 2024-2025';

-- Leçons — Compétence 4
insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'EDHC'
join education_levels el on el.id = cur.education_level_id and el.name = '6e'
cross join lateral (values
  ('Leçon 10 : La puberté', 10),
  ('Leçon 11 : L''abstinence sexuelle', 11)
) as v(title, ordering)
where p.title = 'COMPÉTENCE 4 : Traiter une situation relative à la puberté'
  and cur.version_label = 'DPFC 2024-2025';

-- Leçons — Compétence 5
insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'EDHC'
join education_levels el on el.id = cur.education_level_id and el.name = '6e'
cross join lateral (values
  ('Leçon 12 : L''entretien du cadre de vie', 12),
  ('Leçon 13 : L''entretien des latrines et des toilettes', 13)
) as v(title, ordering)
where p.title = 'COMPÉTENCE 5 : Traiter une situation relative à l''assainissement du cadre de vie'
  and cur.version_label = 'DPFC 2024-2025';

-- Progression officielle 6e (expected_week, recommended_hours reporté via update ciblé)
insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select cu.curriculum_id, cu.id, v.week, cu.ordering
from curriculum_units cu
join curricula cur on cur.id = cu.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'EDHC'
join education_levels el on el.id = cur.education_level_id and el.name = '6e'
join (values
  (1,2),(2,3),(3,4),(4,7),(5,9),(6,11),(7,13),(8,15),(9,17),
  (10,20),(11,22),(12,25),(13,26)
) as v(ordering, week) on v.ordering = cu.ordering
where cur.version_label = 'DPFC 2024-2025' and cu.parent_unit_id is not null;

update curriculum_units cu set recommended_hours = v.hours
from curricula cur, (values
  (1,1),(2,1),(3,2),(4,2),(5,2),(6,2),(7,2),(8,2),(9,1),
  (10,2),(11,2),(12,2),(13,2)
) as v(ordering, hours)
where cur.id = cu.curriculum_id
  and cur.subject_id = (select id from subjects where name = 'EDHC' limit 1)
  and cur.education_level_id = (select el.id from education_levels el where el.name = '6e' limit 1)
  and cur.version_label = 'DPFC 2024-2025'
  and cu.parent_unit_id is not null
  and cu.ordering = v.ordering;

-- ============================================================================
-- 2. EDHC 5e
-- Volume officiel : 1H/semaine (30 séances, dont 5 devoirs)
-- Compétences : 5
-- ============================================================================

insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id,
  'DPFC 2024-2025',
  'https://dpfc-ci.net/progressions/2024-2025/EDHC%20Progressions%202024-2025.pdf',
  true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name = '5e'
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'EDHC'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

insert into curriculum_units (curriculum_id, title, ordering)
select cur.id, v.title, v.ordering
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'EDHC'
join education_levels el on el.id = cur.education_level_id and el.name = '5e'
cross join lateral (values
  ('COMPÉTENCE 1 : Traiter une situation relative aux droits de l''homme, aux droits de l''enfant et au droit International Humanitaire (DIH)', 1),
  ('COMPÉTENCE 2 : Traiter une situation relative aux règles de vie communautaire et aux principes de la démocratie', 2),
  ('COMPÉTENCE 3 : Traiter une situation relative à l''entrepreneuriat et à l''éducation routière', 3),
  ('COMPÉTENCE 4 : Traiter une situation relative à la puberté', 4),
  ('COMPÉTENCE 5 : Traiter une situation relative à l''assainissement du cadre de vie', 5)
) as v(title, ordering)
where cur.version_label = 'DPFC 2024-2025';

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'EDHC'
join education_levels el on el.id = cur.education_level_id and el.name = '5e'
cross join lateral (values
  ('Leçon 1 : Les droits au développement et les droits à la participation de l''enfant', 1, 'COMPÉTENCE 1 : Traiter une situation relative aux droits de l''homme, aux droits de l''enfant et au droit International Humanitaire (DIH)'),
  ('Leçon 2 : Les principes des droits humains', 2, 'COMPÉTENCE 1 : Traiter une situation relative aux droits de l''homme, aux droits de l''enfant et au droit International Humanitaire (DIH)'),
  ('Leçon 3 : Les règles de protection des victimes de conflits armés', 3, 'COMPÉTENCE 1 : Traiter une situation relative aux droits de l''homme, aux droits de l''enfant et au droit International Humanitaire (DIH)'),
  ('Leçon 4 : Le Parlement de la Côte d''Ivoire', 4, 'COMPÉTENCE 2 : Traiter une situation relative aux règles de vie communautaire et aux principes de la démocratie'),
  ('Leçon 5 : Les droits et les devoirs du citoyen', 5, 'COMPÉTENCE 2 : Traiter une situation relative aux règles de vie communautaire et aux principes de la démocratie'),
  ('Leçon 6 : Les principes de la démocratie dans les clubs et les associations', 6, 'COMPÉTENCE 2 : Traiter une situation relative aux règles de vie communautaire et aux principes de la démocratie'),
  ('Leçon 7 : L''entente entre les peuples', 7, 'COMPÉTENCE 2 : Traiter une situation relative aux règles de vie communautaire et aux principes de la démocratie'),
  ('Leçon 8 : Les engins à deux roues, les tricycles et les automobiles', 8, 'COMPÉTENCE 3 : Traiter une situation relative à l''entrepreneuriat et à l''éducation routière'),
  ('Leçon 9 : Les activités génératrices de revenus (AGR)', 9, 'COMPÉTENCE 3 : Traiter une situation relative à l''entrepreneuriat et à l''éducation routière'),
  ('Leçon 10 : Les IST et le VIH/SIDA', 10, 'COMPÉTENCE 4 : Traiter une situation relative à la puberté'),
  ('Leçon 11 : Les grossesses précoces', 11, 'COMPÉTENCE 4 : Traiter une situation relative à la puberté'),
  ('Leçon 12 : La consommation de l''alcool et l''usage de la drogue', 12, 'COMPÉTENCE 4 : Traiter une situation relative à la puberté'),
  ('Leçon 13 : L''hygiène publique et l''assainissement', 13, 'COMPÉTENCE 5 : Traiter une situation relative à l''assainissement du cadre de vie'),
  ('Leçon 14 : La gestion des ordures ménagères', 14, 'COMPÉTENCE 5 : Traiter une situation relative à l''assainissement du cadre de vie')
) as v(title, ordering, competence_title)
where p.title = v.competence_title and cur.version_label = 'DPFC 2024-2025';

insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select cu.curriculum_id, cu.id, v.week, cu.ordering
from curriculum_units cu
join curricula cur on cur.id = cu.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'EDHC'
join education_levels el on el.id = cur.education_level_id and el.name = '5e'
join (values
  (1,2),(2,4),(3,6),(4,9),(5,11),(6,13),(7,15),(8,17),(9,18),
  (10,20),(11,22),(12,24),(13,27),(14,29)
) as v(ordering, week) on v.ordering = cu.ordering
where cur.version_label = 'DPFC 2024-2025' and cu.parent_unit_id is not null;

update curriculum_units cu set recommended_hours = v.hours
from curricula cur, (values
  (1,2),(2,2),(3,2),(4,2),(5,2),(6,2),(7,1),(8,1),(9,1),
  (10,2),(11,2),(12,2),(13,2),(14,1)
) as v(ordering, hours)
where cur.id = cu.curriculum_id
  and cur.subject_id = (select id from subjects where name = 'EDHC' limit 1)
  and cur.education_level_id = (select el.id from education_levels el where el.name = '5e' limit 1)
  and cur.version_label = 'DPFC 2024-2025'
  and cu.parent_unit_id is not null
  and cu.ordering = v.ordering;

-- ============================================================================
-- 3. EDHC 4e
-- Volume officiel : 1H/semaine (30 séances, dont 5 devoirs)
-- Compétences : 5
-- ============================================================================

insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id,
  'DPFC 2024-2025',
  'https://dpfc-ci.net/progressions/2024-2025/EDHC%20Progressions%202024-2025.pdf',
  true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name = '4e'
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'EDHC'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

insert into curriculum_units (curriculum_id, title, ordering)
select cur.id, v.title, v.ordering
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'EDHC'
join education_levels el on el.id = cur.education_level_id and el.name = '4e'
cross join lateral (values
  ('COMPÉTENCE 1 : Traiter une situation relative aux droits de l''homme, aux droits de l''enfant et au droit international humanitaire (DIH)', 1),
  ('COMPÉTENCE 2 : Traiter une situation relative aux droits et aux devoirs du citoyen et aux principes de la démocratie', 2),
  ('COMPÉTENCE 3 : Traiter une situation relative à la gestion des ressources, à l''entrepreneuriat et à la vie communautaire', 3),
  ('COMPÉTENCE 4 : Traiter une situation relative à la préservation de la santé', 4),
  ('COMPÉTENCE 5 : Traiter une situation relative à la préservation de l''environnement', 5)
) as v(title, ordering)
where cur.version_label = 'DPFC 2024-2025';

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'EDHC'
join education_levels el on el.id = cur.education_level_id and el.name = '4e'
cross join lateral (values
  ('Leçon 1 : La promotion des droits de l''enfant', 1, 'COMPÉTENCE 1 : Traiter une situation relative aux droits de l''homme, aux droits de l''enfant et au droit international humanitaire (DIH)'),
  ('Leçon 2 : La lutte contre le recrutement des enfants soldats', 2, 'COMPÉTENCE 1 : Traiter une situation relative aux droits de l''homme, aux droits de l''enfant et au droit international humanitaire (DIH)'),
  ('Leçon 3 : Les instruments et les mécanismes de protection contre les discriminations', 3, 'COMPÉTENCE 1 : Traiter une situation relative aux droits de l''homme, aux droits de l''enfant et au droit international humanitaire (DIH)'),
  ('Leçon 4 : Les institutions consultatives : Le CESEC, le Médiateur de la République et la CNRCTCI', 4, 'COMPÉTENCE 2 : Traiter une situation relative aux droits et aux devoirs du citoyen et aux principes de la démocratie'),
  ('Leçon 5 : Le paiement de l''impôt', 5, 'COMPÉTENCE 2 : Traiter une situation relative aux droits et aux devoirs du citoyen et aux principes de la démocratie'),
  ('Leçon 6 : Les organisations de la société civile', 6, 'COMPÉTENCE 2 : Traiter une situation relative aux droits et aux devoirs du citoyen et aux principes de la démocratie'),
  ('Leçon 7 : La gestion des ressources de la famille', 7, 'COMPÉTENCE 3 : Traiter une situation relative à la gestion des ressources, à l''entrepreneuriat et à la vie communautaire'),
  ('Leçon 8 : L''entrepreneuriat', 8, 'COMPÉTENCE 3 : Traiter une situation relative à la gestion des ressources, à l''entrepreneuriat et à la vie communautaire'),
  ('Leçon 9 : Les alliances interethniques : les Kwa et les Krou', 9, 'COMPÉTENCE 3 : Traiter une situation relative à la gestion des ressources, à l''entrepreneuriat et à la vie communautaire'),
  ('Leçon 10 : Les comportements sexuels à risques', 10, 'COMPÉTENCE 4 : Traiter une situation relative à la préservation de la santé'),
  ('Leçon 11 : L''adolescence', 11, 'COMPÉTENCE 4 : Traiter une situation relative à la préservation de la santé'),
  ('Leçon 12 : La protection de l''environnement', 12, 'COMPÉTENCE 5 : Traiter une situation relative à la préservation de l''environnement'),
  ('Leçon 13 : L''entretien des points d''eau', 13, 'COMPÉTENCE 5 : Traiter une situation relative à la préservation de l''environnement')
) as v(title, ordering, competence_title)
where p.title = v.competence_title and cur.version_label = 'DPFC 2024-2025';

insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select cu.curriculum_id, cu.id, v.week, cu.ordering
from curriculum_units cu
join curricula cur on cur.id = cu.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'EDHC'
join education_levels el on el.id = cur.education_level_id and el.name = '4e'
join (values
  (1,2),(2,4),(3,6),(4,9),(5,11),(6,13),(7,16),(8,17),(9,18),
  (10,21),(11,23),(12,26),(13,28)
) as v(ordering, week) on v.ordering = cu.ordering
where cur.version_label = 'DPFC 2024-2025' and cu.parent_unit_id is not null;

update curriculum_units cu set recommended_hours = v.hours
from curricula cur, (values
  (1,2),(2,2),(3,2),(4,2),(5,2),(6,2),(7,1),(8,1),(9,2),
  (10,2),(11,2),(12,2),(13,2)
) as v(ordering, hours)
where cur.id = cu.curriculum_id
  and cur.subject_id = (select id from subjects where name = 'EDHC' limit 1)
  and cur.education_level_id = (select el.id from education_levels el where el.name = '4e' limit 1)
  and cur.version_label = 'DPFC 2024-2025'
  and cu.parent_unit_id is not null
  and cu.ordering = v.ordering;

-- ============================================================================
-- 4. EDHC 3e
-- Volume officiel : 1H/semaine (30+ séances, dont 4 devoirs)
-- Compétences : 5
-- ============================================================================

insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id,
  'DPFC 2024-2025',
  'https://dpfc-ci.net/progressions/2024-2025/EDHC%20Progressions%202024-2025.pdf',
  true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name = '3e'
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'EDHC'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

insert into curriculum_units (curriculum_id, title, ordering)
select cur.id, v.title, v.ordering
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'EDHC'
join education_levels el on el.id = cur.education_level_id and el.name = '3e'
cross join lateral (values
  ('COMPÉTENCE 1 : Traiter une situation relative aux droits de l''homme, aux droits de l''enfant et au droit international humanitaire (DIH)', 1),
  ('COMPÉTENCE 2 : Traiter une situation relative aux droits et aux devoirs de citoyen et aux principes de la démocratie', 2),
  ('COMPÉTENCE 3 : Traiter une situation relative à la gestion des ressources, à l''entrepreneuriat et à la vie communautaire', 3),
  ('COMPÉTENCE 4 : Traiter une situation relative à la préservation de la santé', 4),
  ('COMPÉTENCE 5 : Traiter une situation relative à la préservation de l''environnement', 5)
) as v(title, ordering)
where cur.version_label = 'DPFC 2024-2025';

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'EDHC'
join education_levels el on el.id = cur.education_level_id and el.name = '3e'
cross join lateral (values
  ('Leçon 1 : Les devoirs de parents', 1, 'COMPÉTENCE 1 : Traiter une situation relative aux droits de l''homme, aux droits de l''enfant et au droit international humanitaire (DIH)'),
  ('Leçon 2 : Les organisations humanitaires', 2, 'COMPÉTENCE 1 : Traiter une situation relative aux droits de l''homme, aux droits de l''enfant et au droit international humanitaire (DIH)'),
  ('Leçon 3 : Les instruments et les mécanismes de protection contre les violences faites aux personnes vulnérables', 3, 'COMPÉTENCE 1 : Traiter une situation relative aux droits de l''homme, aux droits de l''enfant et au droit international humanitaire (DIH)'),
  ('Leçon 4 : Les partis politiques', 4, 'COMPÉTENCE 2 : Traiter une situation relative aux droits et aux devoirs de citoyen et aux principes de la démocratie'),
  ('Leçon 5 : Les institutions juridictionnelles', 5, 'COMPÉTENCE 2 : Traiter une situation relative aux droits et aux devoirs de citoyen et aux principes de la démocratie'),
  ('Leçon 6 : Le scrutin électoral', 6, 'COMPÉTENCE 2 : Traiter une situation relative aux droits et aux devoirs de citoyen et aux principes de la démocratie'),
  ('Leçon 7 : Le civisme fiscal', 7, 'COMPÉTENCE 2 : Traiter une situation relative aux droits et aux devoirs de citoyen et aux principes de la démocratie'),
  ('Leçon 8 : Les biens publics', 8, 'COMPÉTENCE 3 : Traiter une situation relative à la gestion des ressources, à l''entrepreneuriat et à la vie communautaire'),
  ('Leçon 9 : Le projet d''entreprise', 9, 'COMPÉTENCE 3 : Traiter une situation relative à la gestion des ressources, à l''entrepreneuriat et à la vie communautaire'),
  ('Leçon 10 : Les alliances interethniques : les Mandé et les Gour', 10, 'COMPÉTENCE 3 : Traiter une situation relative à la gestion des ressources, à l''entrepreneuriat et à la vie communautaire'),
  ('Leçon 11 : Les maladies endémiques, l''automédication et les centres de santé', 11, 'COMPÉTENCE 4 : Traiter une situation relative à la préservation de la santé'),
  ('Leçon 12 : Le test de dépistage du VIH', 12, 'COMPÉTENCE 4 : Traiter une situation relative à la préservation de la santé'),
  ('Leçon 13 : Les parcs nationaux et les réserves forestières', 13, 'COMPÉTENCE 5 : Traiter une situation relative à la préservation de l''environnement'),
  ('Leçon 14 : La gestion de l''eau', 14, 'COMPÉTENCE 5 : Traiter une situation relative à la préservation de l''environnement')
) as v(title, ordering, competence_title)
where p.title = v.competence_title and cur.version_label = 'DPFC 2024-2025';

insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select cu.curriculum_id, cu.id, v.week, cu.ordering
from curriculum_units cu
join curricula cur on cur.id = cu.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'EDHC'
join education_levels el on el.id = cur.education_level_id and el.name = '3e'
join (values
  (1,2),(2,3),(3,5),(4,8),(5,10),(6,12),(7,14),(8,17),(9,19),
  (10,21),(11,24),(12,26),(13,29),(14,31)
) as v(ordering, week) on v.ordering = cu.ordering
where cur.version_label = 'DPFC 2024-2025' and cu.parent_unit_id is not null;

update curriculum_units cu set recommended_hours = v.hours
from curricula cur, (values
  (1,1),(2,2),(3,2),(4,2),(5,2),(6,2),(7,2),(8,2),(9,2),
  (10,2),(11,2),(12,2),(13,2),(14,2)
) as v(ordering, hours)
where cur.id = cu.curriculum_id
  and cur.subject_id = (select id from subjects where name = 'EDHC' limit 1)
  and cur.education_level_id = (select el.id from education_levels el where el.name = '3e' limit 1)
  and cur.version_label = 'DPFC 2024-2025'
  and cu.parent_unit_id is not null
  and cu.ordering = v.ordering;

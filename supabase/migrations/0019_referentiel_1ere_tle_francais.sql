-- ============================================================================
-- 0019_referentiel_1ere_tle_francais.sql
-- Huitième enrichissement réel du référentiel (EF-REF-02), Français pour la
-- 1ère et la Terminale, à la demande explicite de l'utilisateur ("français").
--
-- SOURCE (consultée le 15 août 2026) : même document officiel DPFC déjà
-- utilisé pour le Français 2nde en 0016 — "Français, Progressions à usage
-- pédagogique 2nde cycle 2025-2026" (FRANCAIS_PROGRESSIONS_A%20USAGE%20
-- PEDAGOGIQUE_2025-2026-%202nd%20CYCLE%20DPFC.pdf) — ce document couvre en
-- réalité tout le second cycle (2nde A/C, 1ère A, 1ère C-D, Terminale A,
-- Terminale C-D) en un seul PDF ; seule la partie 2nde avait été dépouillée
-- en 0016, ce lot dépouille les parties 1ère et Terminale du même document.
--
-- MÊME SIMPLIFICATION ASSUMÉE que pour le Français 2nde (0016) et le
-- Français collège (0012-0015) : le document présente 3 colonnes parallèles
-- menées simultanément chaque semaine (Étude de l'œuvre intégrale /
-- Perfectionnement de la langue et savoir-faire / Expression écrite,
-- chacune avec ses propres leçons qui s'enchaînent à des rythmes différents
-- et se chevauchent dans le temps) — plutôt que de forcer un séquençage
-- artificiel par semaine qui déformerait la réalité du programme, seuls les
-- domaines parents sont créés, sans séquences filles ni
-- `official_progression_steps` (même principe exact que 0016, Convention
-- §19 : ne jamais inventer une structure séquentielle que la source ne
-- donne pas explicitement).
--
-- AUCUNE série E : conformément à la demande explicite de l'utilisateur
-- dans le lot précédent (0018), la série E (filières techniques) reste hors
-- périmètre pour toutes les matières, jusqu'à nouvel ordre.
--
-- Contenu dupliqué en base (choix déjà établi en 0016/0017 pour ce type de
-- regroupement) : "Classe de 1ère A" → 1èreA1 et 1èreA2 ; "Classes de 1ère
-- C et D" → 1èreC et 1èreD ; "Classe de Tle A" → TerminaleA1 et TerminaleA2 ;
-- "Classes de Tles C et D" → TerminaleC et TerminaleD.
--
-- NON COUVERT DANS CE LOT : Histoire-Géographie pour la 1ère/Terminale
-- (aucune progression Terminale DPFC identifiée à ce jour, et aucune
-- progression 1ère/Terminale dédiée trouvée non plus lors des recherches
-- précédentes — à reprendre avec une recherche dédiée plutôt que
-- d'improviser, Convention §19), matières secondaires. Pas testé en
-- conditions réelles (mêmes limites d'environnement que tous les lots
-- précédents — pas de `supabase db push` possible ici).
-- ============================================================================


-- 1. FRANÇAIS — 1èreA1 / 1èreA2 (contenu "Classe de 1ère A")
insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC 2025-2026',
  'https://dpfc-ci.net/dpfc/2026/progressions/FRANCAIS_PROGRESSIONS_A%20USAGE%20PEDAGOGIQUE_2025-2026-%202nd%20CYCLE%20DPFC.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name in ('1èreA1', '1èreA2')
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'Français'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

insert into curriculum_units (curriculum_id, title, ordering)
select cur.id, v.title, v.ordering
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'Français'
join education_levels el on el.id = cur.education_level_id and el.name in ('1èreA1', '1èreA2')
cross join lateral (values
  ('Étude de l''œuvre intégrale', 1),
  ('Perfectionnement de la langue', 2),
  ('Savoir-faire (méthodologie)', 3),
  ('Expression écrite', 4)
) as v(title, ordering)
where cur.version_label = 'DPFC 2025-2026' and cur.education_level_id = el.id;

-- 2. FRANÇAIS — 1èreC / 1èreD (contenu "Classes de 1ère C et D")
insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC 2025-2026',
  'https://dpfc-ci.net/dpfc/2026/progressions/FRANCAIS_PROGRESSIONS_A%20USAGE%20PEDAGOGIQUE_2025-2026-%202nd%20CYCLE%20DPFC.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name in ('1èreC', '1èreD')
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'Français'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

insert into curriculum_units (curriculum_id, title, ordering)
select cur.id, v.title, v.ordering
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'Français'
join education_levels el on el.id = cur.education_level_id and el.name in ('1èreC', '1èreD')
cross join lateral (values
  ('Étude de l''œuvre intégrale', 1),
  ('Perfectionnement de la langue', 2),
  ('Savoir-faire (méthodologie)', 3),
  ('Expression écrite', 4)
) as v(title, ordering)
where cur.version_label = 'DPFC 2025-2026' and cur.education_level_id = el.id;

-- 3. FRANÇAIS — TerminaleA1 / TerminaleA2 (contenu "Classe de Tle A")
insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC 2025-2026',
  'https://dpfc-ci.net/dpfc/2026/progressions/FRANCAIS_PROGRESSIONS_A%20USAGE%20PEDAGOGIQUE_2025-2026-%202nd%20CYCLE%20DPFC.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name in ('TerminaleA1', 'TerminaleA2')
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'Français'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

insert into curriculum_units (curriculum_id, title, ordering)
select cur.id, v.title, v.ordering
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'Français'
join education_levels el on el.id = cur.education_level_id and el.name in ('TerminaleA1', 'TerminaleA2')
cross join lateral (values
  ('Étude de l''œuvre intégrale', 1),
  ('Perfectionnement de la langue', 2),
  ('Savoir-faire (méthodologie)', 3),
  ('Expression écrite', 4)
) as v(title, ordering)
where cur.version_label = 'DPFC 2025-2026' and cur.education_level_id = el.id;

-- 4. FRANÇAIS — TerminaleC / TerminaleD (contenu "Classes de Tles C et D")
insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC 2025-2026',
  'https://dpfc-ci.net/dpfc/2026/progressions/FRANCAIS_PROGRESSIONS_A%20USAGE%20PEDAGOGIQUE_2025-2026-%202nd%20CYCLE%20DPFC.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name in ('TerminaleC', 'TerminaleD')
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'Français'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

insert into curriculum_units (curriculum_id, title, ordering)
select cur.id, v.title, v.ordering
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'Français'
join education_levels el on el.id = cur.education_level_id and el.name in ('TerminaleC', 'TerminaleD')
cross join lateral (values
  ('Étude de l''œuvre intégrale', 1),
  ('Perfectionnement de la langue', 2),
  ('Savoir-faire (méthodologie)', 3),
  ('Expression écrite', 4)
) as v(title, ordering)
where cur.version_label = 'DPFC 2025-2026' and cur.education_level_id = el.id;

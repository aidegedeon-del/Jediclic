-- ============================================================================
-- 0023_referentiel_hg_terminale_2025_2026.sql
-- Douzième enrichissement réel du référentiel (EF-REF-02), à la demande
-- explicite de l'utilisateur ("RESOURçONS HG TERMINALE"), suite à la
-- migration 0022 : le document combiné "Coordination Nationale Disciplinaire
-- Histoire-Géographie — Progressions annuelles (premier et second cycles)
-- 2025-2026" utilisé pour la 2nde et la 1ère couvre EN RÉALITÉ aussi la
-- Terminale (6e à Tle en un seul PDF) — seule la partie Terminale n'avait
-- pas encore été dépouillée, la migration 0021 s'appuyant jusqu'ici sur un
-- programme éducatif 2018-2019 faute d'avoir identifié ce document plus
-- récent à l'époque.
--
-- DÉCISION (Convention §59, validée par la demande explicite de ce lot) :
-- remplacer la source Terminale déjà chargée en 0021, maintenant qu'une
-- source 2025-2026 réelle est disponible pour ce même niveau. Convention
-- §15/§48 : rien n'est effacé — la ligne `curricula` 2018-2019 (migration
-- 0021) est désactivée (`is_active = false`, archivage) plutôt que
-- supprimée, et une nouvelle ligne 2025-2026 devient la version active.
-- Toutes les pages de l'application filtrent déjà sur `is_active = true`
-- (programme, génération IA, assistant, import fiche pédagogique) : aucun
-- changement de code nécessaire, la bascule est purement une donnée.
--
-- SOURCE (contenu chargé dans ce lot) :
--   "Coordination Nationale Disciplinaire Histoire-Géographie — Progressions
--   annuelles (premier et second cycles) 2025-2026", même document et même
--   republication que la migration 0022 (fomesoutra.com, republication
--   identique en format/signature aux éditions officielles dpfc-ci.net des
--   années précédentes — non trouvée hébergée directement sur le domaine
--   officiel au moment de la recherche, cf. note complète en 0022) :
--   https://www.fomesoutra.com/espace-prof/prof-histoire-geographique/progressions-hg/22662-hg-progression-2025-2026-by-tehua/file
--   Sections "PROGRESSION ANNUELLE D'HISTOIRE Tle" et
--   "PROGRESSION ANNUELLE DE GEOGRAPHIE Tle".
--
-- NIVEAUX CIBLÉS : TerminaleA1/A2/C/D (le document ne distingue aucune
-- série pour la Terminale, comme pour 2nde/1ère en 0022 — contenu unique
-- dupliqué vers les 4 niveaux, même principe que Français/Anglais/2nde).
--
-- CAS RÉSOLU — Géographie Thème 2 : la migration 0021 (source 2018-2019)
-- documentait une "leçon tournante" France/Corée du Sud dont le cycle en
-- vigueur pour 2026-2027 était indéterminé, faute de source récente. Le
-- document 2025-2026 lève cette ambiguïté : le Thème 2 y est intitulé sans
-- détour "LA COREE DU SUD : UN EXEMPLE DE PAYS EMERGENT" — un seul pays,
-- aucune alternance mentionnée cette année. Recopié tel quel, sans les deux
-- options — la source elle-même a tranché, ce n'est plus une devinette de
-- l'outil (Convention §19).
--
-- MODÉLISATION : identique à 0021/0022 — deux domaines parents (Histoire /
-- Géographie), chacun avec ses Thèmes parents de Leçons. `expected_week`
-- recopié directement du calendrier hebdomadaire du document (semaine de
-- première apparition de chaque leçon, pas d'interpolation) ; `recommended_hours`
-- recopié du volume horaire donné par le document pour chaque leçon.
--
-- NON COUVERT DANS CE LOT : EDHC/Arts Plastiques/Éducation Musicale/EPS/TICE
-- (toujours en attente, cf. migration 0020). Pas testé en conditions
-- réelles (mêmes limites d'environnement que tous les lots précédents — pas
-- de `supabase db push` possible ici).
-- ============================================================================

-- 0. Archivage de l'ancienne source (2018-2019) : Convention §15/§48, on
-- désactive plutôt que d'effacer. Les données restent consultables via
-- curricula.is_active = false si jamais besoin d'y revenir.
update curricula
set is_active = false
where version_label = 'DPFC 2018-2019 (programme éducatif, dernière version disponible)'
  and education_level_id in (
    select id from education_levels where name in ('TerminaleA1', 'TerminaleA2', 'TerminaleC', 'TerminaleD')
  );

-- 1. Nouvelle ligne curricula 2025-2026 (active)
insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'Coordination Nationale Disciplinaire HG 2025-2026 (via fomesoutra.com, republication)',
  'https://www.fomesoutra.com/espace-prof/prof-histoire-geographique/progressions-hg/22662-hg-progression-2025-2026-by-tehua/file', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id
  and el.name in ('TerminaleA1', 'TerminaleA2', 'TerminaleC', 'TerminaleD')
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'Histoire-Géographie'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

-- 2. Domaines parents (Histoire / Géographie, 3 thèmes chacun)
insert into curriculum_units (curriculum_id, title, ordering)
select cur.id, v.title, v.ordering
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'Histoire-Géographie'
join education_levels el on el.id = cur.education_level_id
  and el.name in ('TerminaleA1', 'TerminaleA2', 'TerminaleC', 'TerminaleD')
cross join lateral (values
  ('Histoire — Thème 1 : Les relations internationales de 1945 à nos jours', 1),
  ('Histoire — Thème 2 : De la décolonisation aux efforts d''organisation de l''Afrique', 2),
  ('Histoire — Thème 3 : Croyances et valeurs dans le monde d''aujourd''hui', 3),
  ('Géographie — Thème 1 : La Côte d''Ivoire, étude économique', 4),
  ('Géographie — Thème 2 : La Corée du Sud, un exemple de pays émergent', 5),
  ('Géographie — Thème 3 : Regroupement et coopération économique', 6)
) as v(title, ordering)
where cur.version_label = 'Coordination Nationale Disciplinaire HG 2025-2026 (via fomesoutra.com, republication)';

-- 3. Histoire — Thème 1
insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering, recommended_hours)
select p.curriculum_id, p.id, v.title, v.ordering, v.hours
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
cross join lateral (values
  ('Leçon 1 : L''ONU', 1, 3),
  ('Leçon 2 : L''ère de la bipolarisation de 1947 à 1991', 2, 7),
  ('Leçon 3 : De la fin de la guerre froide vers un monde multipolaire', 3, 3)
) as v(title, ordering, hours)
where p.title = 'Histoire — Thème 1 : Les relations internationales de 1945 à nos jours'
  and cur.version_label = 'Coordination Nationale Disciplinaire HG 2025-2026 (via fomesoutra.com, republication)';

-- 4. Histoire — Thème 2
insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering, recommended_hours)
select p.curriculum_id, p.id, v.title, v.ordering, v.hours
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
cross join lateral (values
  ('Leçon 1 : La montée des nationalismes en Afrique', 1, 3),
  ('Leçon 2 : L''accession de la Côte d''Ivoire à l''indépendance', 2, 4),
  ('Leçon 3 : L''accession de l''Algérie à l''indépendance', 3, 3),
  ('Leçon 4 : L''Union Africaine', 4, 3)
) as v(title, ordering, hours)
where p.title = 'Histoire — Thème 2 : De la décolonisation aux efforts d''organisation de l''Afrique'
  and cur.version_label = 'Coordination Nationale Disciplinaire HG 2025-2026 (via fomesoutra.com, republication)';

-- 5. Histoire — Thème 3
insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering, recommended_hours)
select p.curriculum_id, p.id, v.title, v.ordering, v.hours
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
cross join lateral (values
  ('Leçon 1 : Croyances et valeurs dominantes dans le monde occidental', 1, 3),
  ('Leçon 2 : Les mutations contemporaines de la civilisation négro-africaine', 2, 3)
) as v(title, ordering, hours)
where p.title = 'Histoire — Thème 3 : Croyances et valeurs dans le monde d''aujourd''hui'
  and cur.version_label = 'Coordination Nationale Disciplinaire HG 2025-2026 (via fomesoutra.com, republication)';

-- 6. Géographie — Thème 1
insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering, recommended_hours)
select p.curriculum_id, p.id, v.title, v.ordering, v.hours
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
cross join lateral (values
  ('Leçon 1 : Les fondements du développement économique de la Côte d''Ivoire', 1, 3),
  ('Leçon 2 : Les secteurs d''activités économiques de la Côte d''Ivoire', 2, 6),
  ('Leçon 3 : Les problèmes de développement économique de la Côte d''Ivoire', 3, 4)
) as v(title, ordering, hours)
where p.title = 'Géographie — Thème 1 : La Côte d''Ivoire, étude économique'
  and cur.version_label = 'Coordination Nationale Disciplinaire HG 2025-2026 (via fomesoutra.com, republication)';

-- 7. Géographie — Thème 2 (plus de leçon tournante : source 2025-2026 tranche sur la Corée du Sud)
insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering, recommended_hours)
select p.curriculum_id, p.id, v.title, v.ordering, v.hours
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
cross join lateral (values
  ('Leçon 1 : Les fondements du développement économique de la Corée du Sud', 1, 3),
  ('Leçon 2 : La Corée du Sud, une puissance économique émergente', 2, 3)
) as v(title, ordering, hours)
where p.title = 'Géographie — Thème 2 : La Corée du Sud, un exemple de pays émergent'
  and cur.version_label = 'Coordination Nationale Disciplinaire HG 2025-2026 (via fomesoutra.com, republication)';

-- 8. Géographie — Thème 3
insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering, recommended_hours)
select p.curriculum_id, p.id, v.title, v.ordering, v.hours
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
cross join lateral (values
  ('Leçon 1 : La CEDEAO, une organisation régionale à caractère économique', 1, 4),
  ('Leçon 2 : Les relations UE/ACP, une forme de coopération Nord-Sud', 2, 4)
) as v(title, ordering, hours)
where p.title = 'Géographie — Thème 3 : Regroupement et coopération économique'
  and cur.version_label = 'Coordination Nationale Disciplinaire HG 2025-2026 (via fomesoutra.com, republication)';

-- 9. Semaines officielles (recopiées telles quelles des deux tableaux
-- "PROGRESSION ANNUELLE" du document, semaine de première apparition de
-- chaque leçon)
insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select cu.curriculum_id, cu.id, v.week, v.ordering
from curriculum_units cu
join curricula cur on cur.id = cu.curriculum_id
join (values
  ('Histoire — Thème 1 : Les relations internationales de 1945 à nos jours', 1, 1),
  ('Histoire — Thème 1 : Les relations internationales de 1945 à nos jours', 2, 5),
  ('Histoire — Thème 1 : Les relations internationales de 1945 à nos jours', 3, 11),
  ('Histoire — Thème 2 : De la décolonisation aux efforts d''organisation de l''Afrique', 1, 15),
  ('Histoire — Thème 2 : De la décolonisation aux efforts d''organisation de l''Afrique', 2, 16),
  ('Histoire — Thème 2 : De la décolonisation aux efforts d''organisation de l''Afrique', 3, 19),
  ('Histoire — Thème 2 : De la décolonisation aux efforts d''organisation de l''Afrique', 4, 21),
  ('Histoire — Thème 3 : Croyances et valeurs dans le monde d''aujourd''hui', 1, 26),
  ('Histoire — Thème 3 : Croyances et valeurs dans le monde d''aujourd''hui', 2, 27),
  ('Géographie — Thème 1 : La Côte d''Ivoire, étude économique', 1, 1),
  ('Géographie — Thème 1 : La Côte d''Ivoire, étude économique', 2, 6),
  ('Géographie — Thème 1 : La Côte d''Ivoire, étude économique', 3, 13),
  ('Géographie — Thème 2 : La Corée du Sud, un exemple de pays émergent', 1, 18),
  ('Géographie — Thème 2 : La Corée du Sud, un exemple de pays émergent', 2, 20),
  ('Géographie — Thème 3 : Regroupement et coopération économique', 1, 24),
  ('Géographie — Thème 3 : Regroupement et coopération économique', 2, 26)
) as v(parent_title, ordering, week)
  on v.ordering = cu.ordering
  and v.parent_title = (select p.title from curriculum_units p where p.id = cu.parent_unit_id)
where cur.version_label = 'Coordination Nationale Disciplinaire HG 2025-2026 (via fomesoutra.com, republication)'
  and cu.parent_unit_id is not null;

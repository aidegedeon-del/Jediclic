-- ============================================================================
-- 0020_referentiel_allemand_espagnol.sql
-- Neuvième enrichissement réel du référentiel (EF-REF-02), à la demande
-- explicite de l'utilisateur ("Matières secondaires : Allemand, Espagnol,
-- EDHC, Arts Plastiques, Éducation Musicale, EPS, TICE").
--
-- PÉRIMÈTRE DE CE LOT : Allemand et Espagnol uniquement (4e à Terminale,
-- toutes séries), choisis en premier car ce sont les deux seules matières de
-- ce groupe pour lesquelles la DPFC publie, sur sa page officielle
-- (https://dpfc-ci.net/?page_id=5267), un document 2025-2026 unique et
-- réellement séquentiel (thèmes/leçons numérotés semaine par semaine),
-- directement exploitable sans retravail. EDHC n'a qu'un document
-- 2024-2025 (pas de version 2025-2026 publiée à ce jour) ; EPS est
-- explicitement présentée par la DPFC comme un "exemple de progression"
-- non contraignant (la coordination EPS précise que "les classes d'un même
-- niveau peuvent mener des activités sportives différentes") — modéliser
-- cela comme une progression officielle stricte aurait déformé la réalité
-- du document (Convention §19) ; Arts Plastiques et Éducation Musicale
-- distinguent un "nouveau programme" 6e et des "programmes actuels" pour le
-- reste sans détail hebdomadaire clair au premier examen ; TICE n'a été vu
-- que pour 6e/5e à ce stade. Ces cinq matières sont laissées à un lot
-- séparé, à retravailler une par une (Convention §19).
--
-- SOURCES (consultées le 15 août 2026, https://dpfc-ci.net/?page_id=5267) :
-- - Allemand (4e à Tle, un seul document, pas de distinction par série) :
--   https://dpfc-ci.net/dpfc/2026/progressions/ALLEMAND%20PROGRESSIONS%20NATIONALES%20ANNEE%20SCOLAIRE%202025%202026.pdf
-- - Espagnol (4e à Tle, un seul document, pas de distinction par série) :
--   https://dpfc-ci.net/dpfc/2026/progressions/ESPAGNOL-PROGRESSIONS%202025-2026_%20DPFC.pdf
--
-- PÉRIODICITÉ DES SÉRIES : ni l'Allemand ni l'Espagnol ne sont scindés par
-- série dans leur document source (contrairement à Philosophie/Anglais) —
-- une seule progression "SECONDE"/"PREMIERE"/"TERMINALE" couvre toutes les
-- séries. Même principe que Français/Anglais en 2nde (migration 0016) :
-- le contenu est dupliqué vers chaque ligne education_levels de série
-- existante (2ndeA/2ndeC, 1èreA1/A2/C/D, TerminaleA1/A2/C/D) plutôt que
-- rattaché à la ligne générique inutilisée, pour que ces niveaux
-- apparaissent bien dans le référentiel d'une classe réelle. Aucune série E
-- créée (filières techniques, chantier distinct — cf. migration 0018).
--
-- MÉTHODE : contenu (intitulés de Thèmes/Leçons) recopié tel quel des PDF.
-- Les deux documents donnent un nombre de séances par leçon mais pas une
-- date calendaire précise par leçon à l'intérieur d'un trimestre — comme en
-- 0017/0018, `expected_week` est donc interpolé à partir du volume horaire
-- hebdomadaire annoncé par le document (3h/semaine constaté sur les deux
-- matières et tous les niveaux) et de la semaine de départ du trimestre
-- donnée explicitement par le document ; jamais de date calendaire
-- inventée, jamais de contenu de leçon inventé. Les séances de
-- "régulation"/"évaluation-remédiation" ne sont volontairement pas
-- modélisées comme des curriculum_units séparées (ce sont des révisions,
-- pas du contenu nouveau), même principe que les lots précédents.
--
-- ALLEMAND : le document ne nomme les leçons que génériquement ("Thème 1 —
-- Leçon 1", "Thème 1 — Leçon 2", etc.), sans intitulé thématique détaillé
-- au-delà du nom de la méthode utilisée (Deutsch? Na klar! / Hallo
-- zusammen! / Vorwärts pour 4e-3e ; Ihr und Wir plus 3 pour 2nde-1ère-Tle) —
-- recopié tel quel plutôt que d'inventer un intitulé, Convention §19.
-- Contenu structurellement identique pour 4e et 3e (4 thèmes × 2 leçons),
-- et structurellement identique pour 2nde/1ère/Terminale (3 thèmes ×
-- [Einstiegsseite + 2 leçons]) — un seul jeu de curriculum_units est donc
-- injecté simultanément sur tous les niveaux de chaque groupe via un JOIN
-- sur plusieurs education_levels.name, pour éviter de dupliquer le SQL.
--
-- ESPAGNOL : leçons réellement nommées (ex. "La découverte du monde
-- hispanique", "L'expression de l'opinion"...). Contenu identique pour 4e
-- et 3e (mêmes intitulés de leçons, mêmes volumes horaires) — même
-- mutualisation SQL que pour l'Allemand. En revanche 2nde, 1ère et
-- Terminale ont chacune un contenu distinct (thèmes différents par
-- niveau) — trois jeux de curriculum_units séparés, mais chacun réutilisé
-- pour toutes les séries du niveau concerné (pas de distinction par série
-- dans le document source).
--
-- NON COUVERT DANS CE LOT (à sourcer plus tard, jamais improvisé) : EDHC,
-- Arts Plastiques, Éducation Musicale, EPS, TICE (toutes matières et tous
-- niveaux) ; Français et Histoire-Géographie pour la 1ère/Terminale
-- (aucune progression Terminale DPFC identifiée pour HG à ce jour).
-- Pas testé en conditions réelles (mêmes limites d'environnement que tous
-- les lots précédents — pas de `supabase db push` possible ici).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Nouvelles matières : Allemand, Espagnol
-- ----------------------------------------------------------------------------
insert into subjects (education_system_id, name)
select es.id, v.name
from education_systems es
join countries c on c.id = es.country_id and c.iso_code = 'CI'
cross join (values ('Allemand'), ('Espagnol')) as v(name)
on conflict do nothing;

-- ============================================================================
-- 1. ALLEMAND
-- ============================================================================

-- 1.1 Allemand — 4e et 3e (contenu identique, 4 thèmes × 2 leçons)
insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC 2025-2026',
  'https://dpfc-ci.net/dpfc/2026/progressions/ALLEMAND%20PROGRESSIONS%20NATIONALES%20ANNEE%20SCOLAIRE%202025%202026.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name in ('4e', '3e')
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'Allemand'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

insert into curriculum_units (curriculum_id, title, ordering, recommended_hours)
select cur.id, v.title, v.ordering, v.hours
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'Allemand'
join education_levels el on el.id = cur.education_level_id and el.name in ('4e', '3e')
cross join lateral (values
  ('Thème 1 — Leçon 1', 1, 9),
  ('Thème 1 — Leçon 2', 2, 9),
  ('Thème 2 — Leçon 1', 3, 9),
  ('Thème 2 — Leçon 2', 4, 9),
  ('Thème 3 — Leçon 1', 5, 9),
  ('Thème 3 — Leçon 2', 6, 9),
  ('Thème 4 — Leçon 1', 7, 9),
  ('Thème 4 — Leçon 2', 8, 9),
  ('Révision générale', 9, 6)
) as v(title, ordering, hours)
where cur.version_label = 'DPFC 2025-2026';

insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select cu.curriculum_id, cu.id, v.week, cu.ordering
from curriculum_units cu
join curricula cur on cur.id = cu.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Allemand'
join education_levels el on el.id = cur.education_level_id and el.name in ('4e', '3e')
join (values (1,1),(2,4),(3,8),(4,11),(5,15),(6,18),(7,22),(8,25),(9,29)) as v(ordering, week) on v.ordering = cu.ordering
where cur.version_label = 'DPFC 2025-2026';

-- 1.2 Allemand — 2nde/1ère/Terminale, toutes séries (contenu identique,
-- 3 thèmes × [Einstiegsseite + 2 leçons])
insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC 2025-2026',
  'https://dpfc-ci.net/dpfc/2026/progressions/ALLEMAND%20PROGRESSIONS%20NATIONALES%20ANNEE%20SCOLAIRE%202025%202026.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id
  and el.name in ('2ndeA', '2ndeC', '1èreA1', '1èreA2', '1èreC', '1èreD', 'TerminaleA1', 'TerminaleA2', 'TerminaleC', 'TerminaleD')
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'Allemand'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

insert into curriculum_units (curriculum_id, title, ordering, recommended_hours)
select cur.id, v.title, v.ordering, v.hours
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'Allemand'
join education_levels el on el.id = cur.education_level_id
  and el.name in ('2ndeA', '2ndeC', '1èreA1', '1èreA2', '1èreC', '1èreD', 'TerminaleA1', 'TerminaleA2', 'TerminaleC', 'TerminaleD')
cross join lateral (values
  ('Thème 1 — Einstiegsseite', 1, 1),
  ('Thème 1 — Leçon 1', 2, 12),
  ('Thème 1 — Leçon 2', 3, 12),
  ('Thème 2 — Einstiegsseite', 4, 1),
  ('Thème 2 — Leçon 1', 5, 12),
  ('Thème 2 — Leçon 2', 6, 12),
  ('Thème 3 — Einstiegsseite', 7, 1),
  ('Thème 3 — Leçon 1', 8, 12),
  ('Thème 3 — Leçon 2', 9, 12),
  ('Révision générale', 10, 6)
) as v(title, ordering, hours)
where cur.version_label = 'DPFC 2025-2026';

insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select cu.curriculum_id, cu.id, v.week, cu.ordering
from curriculum_units cu
join curricula cur on cur.id = cu.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Allemand'
join education_levels el on el.id = cur.education_level_id
  and el.name in ('2ndeA', '2ndeC', '1èreA1', '1èreA2', '1èreC', '1èreD', 'TerminaleA1', 'TerminaleA2', 'TerminaleC', 'TerminaleD')
join (values (1,1),(2,2),(3,6),(4,10),(5,11),(6,15),(7,19),(8,20),(9,24),(10,29)) as v(ordering, week) on v.ordering = cu.ordering
where cur.version_label = 'DPFC 2025-2026';

-- ============================================================================
-- 2. ESPAGNOL
-- ============================================================================

-- 2.1 Espagnol — 4e et 3e (contenu identique)
insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC 2025-2026',
  'https://dpfc-ci.net/dpfc/2026/progressions/ESPAGNOL-PROGRESSIONS%202025-2026_%20DPFC.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name in ('4e', '3e')
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'Espagnol'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

insert into curriculum_units (curriculum_id, title, ordering, recommended_hours)
select cur.id, v.title, v.ordering, v.hours
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'Espagnol'
join education_levels el on el.id = cur.education_level_id and el.name in ('4e', '3e')
cross join lateral (values
  ('Imprégnation / révision (notions de base)', 1, 3),
  ('Leçon 1 — La découverte du monde hispanique', 2, 6),
  ('Leçon 2 — La présentation des civilités', 3, 12),
  ('Leçon 3 — L''échange d''information', 4, 6),
  ('Leçon 4 — L''expression de l''opinion', 5, 6),
  ('Leçon 5 — L''expression des goûts et des préférences', 6, 6),
  ('Leçon 6 — L''expression des sentiments', 7, 6),
  ('Leçon 7 — L''expression de l''ordre', 8, 6),
  ('Révision générale', 9, 6)
) as v(title, ordering, hours)
where cur.version_label = 'DPFC 2025-2026';

insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select cu.curriculum_id, cu.id, v.week, cu.ordering
from curriculum_units cu
join curricula cur on cur.id = cu.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Espagnol'
join education_levels el on el.id = cur.education_level_id and el.name in ('4e', '3e')
join (values (1,1),(2,2),(3,5),(4,10),(5,16),(6,19),(7,22),(8,25),(9,28)) as v(ordering, week) on v.ordering = cu.ordering
where cur.version_label = 'DPFC 2025-2026';

-- 2.2 Espagnol — 2nde, toutes séries
insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC 2025-2026',
  'https://dpfc-ci.net/dpfc/2026/progressions/ESPAGNOL-PROGRESSIONS%202025-2026_%20DPFC.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name in ('2ndeA', '2ndeC')
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'Espagnol'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

insert into curriculum_units (curriculum_id, title, ordering, recommended_hours)
select cur.id, v.title, v.ordering, v.hours
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'Espagnol'
join education_levels el on el.id = cur.education_level_id and el.name in ('2ndeA', '2ndeC')
cross join lateral (values
  ('Révision (notions de base)', 1, 6),
  ('Leçon 1 — La connaissance des réalités du monde hispanique et de l''Afrique', 2, 6),
  ('Leçon 2 — L''échange des civilités', 3, 9),
  ('Leçon 3 — L''échange d''information', 4, 6),
  ('Leçon 4 — L''expression de l''opinion', 5, 9),
  ('Leçon 5 — L''expression des états d''âme', 6, 9),
  ('Leçon 6 — L''expression de l''ordre', 7, 9),
  ('Révision générale', 8, 6)
) as v(title, ordering, hours)
where cur.version_label = 'DPFC 2025-2026';

insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select cu.curriculum_id, cu.id, v.week, cu.ordering
from curriculum_units cu
join curricula cur on cur.id = cu.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Espagnol'
join education_levels el on el.id = cur.education_level_id and el.name in ('2ndeA', '2ndeC')
join (values (1,1),(2,3),(3,6),(4,10),(5,16),(6,20),(7,24),(8,28)) as v(ordering, week) on v.ordering = cu.ordering
where cur.version_label = 'DPFC 2025-2026';

-- 2.3 Espagnol — 1ère, toutes séries
insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC 2025-2026',
  'https://dpfc-ci.net/dpfc/2026/progressions/ESPAGNOL-PROGRESSIONS%202025-2026_%20DPFC.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name in ('1èreA1', '1èreA2', '1èreC', '1èreD')
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'Espagnol'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

insert into curriculum_units (curriculum_id, title, ordering, recommended_hours)
select cur.id, v.title, v.ordering, v.hours
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'Espagnol'
join education_levels el on el.id = cur.education_level_id and el.name in ('1èreA1', '1èreA2', '1èreC', '1èreD')
cross join lateral (values
  ('Révision (notions de base)', 1, 6),
  ('Leçon 1 — La connaissance des réalités du monde hispanique et de l''Afrique', 2, 6),
  ('Leçon 2 — L''échange d''information', 3, 12),
  ('Leçon 3 — L''expression de l''opinion', 4, 12),
  ('Leçon 4 — L''expression des états d''âme', 5, 9),
  ('Leçon 5 — L''expression de l''ordre', 6, 9),
  ('Leçon 6 — La technique d''expression orale ou écrite', 7, 9),
  ('Révision générale', 8, 6)
) as v(title, ordering, hours)
where cur.version_label = 'DPFC 2025-2026';

insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select cu.curriculum_id, cu.id, v.week, cu.ordering
from curriculum_units cu
join curricula cur on cur.id = cu.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Espagnol'
join education_levels el on el.id = cur.education_level_id and el.name in ('1èreA1', '1èreA2', '1èreC', '1èreD')
join (values (1,1),(2,3),(3,6),(4,11),(5,16),(6,20),(7,24),(8,28)) as v(ordering, week) on v.ordering = cu.ordering
where cur.version_label = 'DPFC 2025-2026';

-- 2.4 Espagnol — Terminale, toutes séries
insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC 2025-2026',
  'https://dpfc-ci.net/dpfc/2026/progressions/ESPAGNOL-PROGRESSIONS%202025-2026_%20DPFC.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name in ('TerminaleA1', 'TerminaleA2', 'TerminaleC', 'TerminaleD')
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'Espagnol'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

insert into curriculum_units (curriculum_id, title, ordering, recommended_hours)
select cur.id, v.title, v.ordering, v.hours
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'Espagnol'
join education_levels el on el.id = cur.education_level_id and el.name in ('TerminaleA1', 'TerminaleA2', 'TerminaleC', 'TerminaleD')
cross join lateral (values
  ('Révision (notions de base)', 1, 6),
  ('Leçon 1 — La connaissance des réalités du monde hispanique et de l''Afrique', 2, 6),
  ('Leçon 2 — L''échange d''information', 3, 12),
  ('Les épreuves du BAC (présentation méthodologique)', 4, 3),
  ('Leçon 3 — L''expression de l''opinion', 5, 9),
  ('Leçon 4 — L''expression des états d''âme', 6, 9),
  ('Leçon 5 — L''expression de l''ordre', 7, 9),
  ('Leçon 6 — La technique d''expression orale ou écrite', 8, 9),
  ('Révision générale', 9, 6)
) as v(title, ordering, hours)
where cur.version_label = 'DPFC 2025-2026';

insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select cu.curriculum_id, cu.id, v.week, cu.ordering
from curriculum_units cu
join curricula cur on cur.id = cu.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Espagnol'
join education_levels el on el.id = cur.education_level_id and el.name in ('TerminaleA1', 'TerminaleA2', 'TerminaleC', 'TerminaleD')
join (values (1,1),(2,3),(3,6),(4,11),(5,12),(6,16),(7,20),(8,24),(9,28)) as v(ordering, week) on v.ordering = cu.ordering
where cur.version_label = 'DPFC 2025-2026';

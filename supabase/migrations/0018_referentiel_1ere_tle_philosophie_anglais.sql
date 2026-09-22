-- ============================================================================
-- 0018_referentiel_1ere_tle_philosophie_anglais.sql
-- Septième enrichissement réel du référentiel (EF-REF-02), à la demande
-- explicite de l'utilisateur ("Référentiel DPFC (1ère/Tle restants)").
--
-- PÉRIMÈTRE DE CE LOT : Philosophie (nouvelle matière, 1ère ET Terminale,
-- toutes séries) + Anglais (1ère et Terminale, séries manquantes). Choisi en
-- priorité car ce sont les deux seules matières pour lesquelles la DPFC
-- publie une source 2025-2026 réellement dédiée à la fois à la 1ère et à la
-- Terminale sur sa page officielle (https://dpfc-ci.net/?page_id=5267) :
-- toutes les autres matières restantes (Français, Histoire-Géographie) n'ont
-- aucune progression Terminale publiée à ce jour et le Français lycée n'a
-- qu'un document "2nd cycle" non encore dépouillé — laissés pour un lot
-- séparé plutôt que d'improviser (Convention §19).
--
-- SOURCES (consultées le 15 août 2026, https://dpfc-ci.net/?page_id=5267) :
-- - Philosophie 1ères A1-A2 : PHILOSOPHIE%20PROGRESSIONS%201%C3%A8res%20A1-A2%202025-2026.pdf
-- - Philosophie 1ère C-D-E  : PHILOSOPHIE%20PROGRESSIONS%201%C3%A8res%20CDE%202025-2026.pdf
-- - Philosophie Tles A1-A2  : PHILOSOPHIE%20PROGRESSIONS%20Tles%20A1-A2%202025-2026.pdf
-- - Philosophie Tles C-D-E  : PHILOSOPHIE%20PROGRESSIONS%20Tles%20C-D-E%202025-2026.pdf
-- - Anglais 1ère A          : Anglais%20Progression%201%C3%A8re%20A%202025-2026.pdf
-- - Anglais 1ère C-D        : Anglais%20Progression%20Premi%C3%A8re%20C%20et%20D%202025-2026.pdf
-- - Anglais Terminale A     : Anglais%20Progression%20Terminale%20A%202025-2026.pdf
-- - Anglais Terminale C-D   : Anglais%20Progression%20Terminale%20C%20et%20D%202025-2026.pdf
--
-- DÉCISION PRISE DANS CE LOT, CORRIGÉE À LA DEMANDE DE L'UTILISATEUR :
-- aucune série E n'est créée ('1èreE'/'TerminaleE' NE sont PAS ajoutées).
-- Bien que la Philosophie DPFC regroupe nommément "C-D-E" dans l'intitulé de
-- son document source, l'utilisateur a précisé que la série E correspond aux
-- filières techniques, un chantier distinct volontairement hors périmètre
-- pour l'instant — à reprendre le jour où les filières techniques seront
-- attaquées (probablement avec leur propre référentiel dédié plutôt qu'un
-- simple rattachement au contenu C-D de Philosophie). Le contenu "C-D-E" de
-- Philosophie est donc chargé uniquement pour les séries C et D.
--
-- Nouveaux education_levels : 'TerminaleA1'/'TerminaleA2'/'TerminaleC'/
-- 'TerminaleD' (même mécanisme que 2ndeA/2ndeC en 0016 et 1èreA1..D en 0017,
-- aucun changement de schéma). La ligne 'Terminale' générique du seed (0007)
-- est laissée telle quelle, simplement inutilisée (Convention §15 : rien
-- n'est effacé) — conséquence produit identique à 2nde/1ère : un professeur
-- de Terminale devra choisir sa série à la création de sa classe.
--
-- MÉTHODE : contenu recopié tel quel des PDF officiels. `expected_week` =
-- semaine officielle de première apparition de chaque leçon/unité dans le
-- document (jamais de date calendaire inventée), rattaché à l'année scolaire
-- courante (2026-2027, déjà seedée) via le mécanisme existant de
-- src/lib/progress/drift.ts (EF-PROG-03) — même méthode que tous les lots
-- précédents (0012 à 0017). `recommended_hours` = nombre de semaines de la
-- leçon × volume horaire hebdomadaire indiqué par le document (vérifié : la
-- somme concorde avec les totaux "DUREE"/"Total horaire" annoncés par chaque
-- document source pour Philosophie comme pour Anglais).
--
-- PHILOSOPHIE : modélisée en unités plates (pas de parent/enfant) — contrai-
-- rement aux matières scientifiques, la progression officielle de Philosophie
-- est déjà une simple liste séquentielle de leçons (pas de thèmes parallèles
-- comme HG/Français), donc pas de `parent_unit_id` nécessaire ici.
-- ANGLAIS : même principe, une unité (UNIT) = une curriculum_unit, séquence
-- simple.
--
-- NON COUVERT DANS CE LOT (à sourcer plus tard, jamais improvisé) :
-- - Français, Histoire-Géographie pour la 1ère (aucune progression Terminale
--   trouvée à ce jour pour aucune des deux, à réexaminer) ; Français a un
--   document "2nd cycle" (2nde/1ère/Tle) non encore dépouillé.
-- - Allemand, Espagnol, EDHC, Arts Plastiques, Éducation Musicale, EPS, TICE
--   pour la 1ère et la Terminale (matières secondaires, jamais commencées).
-- Pas testé en conditions réelles (mêmes limites d'environnement que tous
-- les lots précédents — pas de `supabase db push` possible ici).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Niveaux TerminaleA1 / TerminaleA2 / TerminaleC / TerminaleD
-- ----------------------------------------------------------------------------
insert into education_levels (cycle_id, name, ordering)
select ec.id, v.name, v.ordering
from education_cycles ec
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
cross join lateral (values
  ('TerminaleA1', 7), ('TerminaleA2', 8), ('TerminaleC', 9), ('TerminaleD', 10)
) as v(name, ordering)
where ec.name = 'Lycée'
on conflict do nothing;

-- ----------------------------------------------------------------------------
-- 0bis. Nouvelle matière : Philosophie
-- ----------------------------------------------------------------------------
insert into subjects (education_system_id, name)
select es.id, 'Philosophie'
from education_systems es
join countries c on c.id = es.country_id and c.iso_code = 'CI'
on conflict do nothing;


-- ============================================================================
-- 1. PHILOSOPHIE
-- ============================================================================

-- 1.1 Philosophie — 1èreA1 (03H/semaine)
insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC 2025-2026',
  'https://dpfc-ci.net/dpfc/2026/progressions/PHILOSOPHIE%20PROGRESSIONS%201%C3%A8res%20A1-A2%202025-2026.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name = '1èreA1'
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'Philosophie'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

insert into curriculum_units (curriculum_id, title, ordering, recommended_hours)
select cur.id, v.title, v.ordering, v.hours
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'Philosophie'
join education_levels el on el.id = cur.education_level_id and el.name = '1èreA1'
cross join lateral (values
  ('La méthode de lecture de texte', 1, 21),
  ('La rédaction de l''introduction', 2, 3),
  ('La rédaction de la conclusion', 3, 3),
  ('L''essai de problématisation', 4, 15),
  ('La rédaction de l''introduction (essai de problématisation)', 5, 3),
  ('La rédaction de la conclusion (essai de problématisation)', 6, 3),
  ('La période antique', 7, 9),
  ('Le Moyen-Âge et la Renaissance', 8, 6),
  ('La période moderne', 9, 9),
  ('La période contemporaine', 10, 12)
) as v(title, ordering, hours)
where cur.version_label = 'DPFC 2025-2026' and el.name = '1èreA1' and s.name = 'Philosophie';

insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select cu.curriculum_id, cu.id, v.week, cu.ordering
from curriculum_units cu
join curricula cur on cur.id = cu.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Philosophie'
join education_levels el on el.id = cur.education_level_id and el.name = '1èreA1'
join (values (1,1),(2,8),(3,9),(4,11),(5,16),(6,17),(7,19),(8,22),(9,24),(10,27)) as v(ordering, week) on v.ordering = cu.ordering
where cur.version_label = 'DPFC 2025-2026' and el.name = '1èreA1' and s.name = 'Philosophie';

-- 1.2 Philosophie — 1èreA2 (03H/semaine)
insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC 2025-2026',
  'https://dpfc-ci.net/dpfc/2026/progressions/PHILOSOPHIE%20PROGRESSIONS%201%C3%A8res%20A1-A2%202025-2026.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name = '1èreA2'
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'Philosophie'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

insert into curriculum_units (curriculum_id, title, ordering, recommended_hours)
select cur.id, v.title, v.ordering, v.hours
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'Philosophie'
join education_levels el on el.id = cur.education_level_id and el.name = '1èreA2'
cross join lateral (values
  ('La méthode de lecture de texte', 1, 21),
  ('La rédaction de l''introduction', 2, 3),
  ('La rédaction de la conclusion', 3, 3),
  ('L''essai de problématisation', 4, 15),
  ('La rédaction de l''introduction (essai de problématisation)', 5, 3),
  ('La rédaction de la conclusion (essai de problématisation)', 6, 3),
  ('La période antique', 7, 9),
  ('Le Moyen-Âge et la Renaissance', 8, 6),
  ('La période moderne', 9, 9),
  ('La période contemporaine', 10, 12)
) as v(title, ordering, hours)
where cur.version_label = 'DPFC 2025-2026' and el.name = '1èreA2' and s.name = 'Philosophie';

insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select cu.curriculum_id, cu.id, v.week, cu.ordering
from curriculum_units cu
join curricula cur on cur.id = cu.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Philosophie'
join education_levels el on el.id = cur.education_level_id and el.name = '1èreA2'
join (values (1,1),(2,8),(3,9),(4,11),(5,16),(6,17),(7,19),(8,22),(9,24),(10,27)) as v(ordering, week) on v.ordering = cu.ordering
where cur.version_label = 'DPFC 2025-2026' and el.name = '1èreA2' and s.name = 'Philosophie';

-- 1.x Philosophie — 1èreC (02H/semaine, contenu C-D-E)
insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC 2025-2026',
  'https://dpfc-ci.net/dpfc/2026/progressions/PHILOSOPHIE%20PROGRESSIONS%201%C3%A8res%20CDE%202025-2026.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name = '1èreC'
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'Philosophie'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

insert into curriculum_units (curriculum_id, title, ordering, recommended_hours)
select cur.id, v.title, v.ordering, v.hours
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'Philosophie'
join education_levels el on el.id = cur.education_level_id and el.name = '1èreC'
cross join lateral (values
  ('La méthode de lecture de texte', 1, 14),
  ('La rédaction de l''introduction', 2, 2),
  ('La rédaction de la conclusion', 3, 2),
  ('L''essai de problématisation', 4, 10),
  ('La rédaction de l''introduction (essai de problématisation)', 5, 2),
  ('La rédaction de la conclusion (essai de problématisation)', 6, 2),
  ('La période antique', 7, 6),
  ('Le Moyen-Âge et la Renaissance', 8, 4),
  ('La période moderne', 9, 6),
  ('La période contemporaine', 10, 8)
) as v(title, ordering, hours)
where cur.version_label = 'DPFC 2025-2026' and el.name = '1èreC' and s.name = 'Philosophie';

insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select cu.curriculum_id, cu.id, v.week, cu.ordering
from curriculum_units cu
join curricula cur on cur.id = cu.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Philosophie'
join education_levels el on el.id = cur.education_level_id and el.name = '1èreC'
join (values (1,1),(2,8),(3,9),(4,11),(5,16),(6,17),(7,19),(8,22),(9,24),(10,27)) as v(ordering, week) on v.ordering = cu.ordering
where cur.version_label = 'DPFC 2025-2026' and el.name = '1èreC' and s.name = 'Philosophie';

-- 1.x Philosophie — 1èreD (02H/semaine, contenu C-D-E)
insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC 2025-2026',
  'https://dpfc-ci.net/dpfc/2026/progressions/PHILOSOPHIE%20PROGRESSIONS%201%C3%A8res%20CDE%202025-2026.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name = '1èreD'
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'Philosophie'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

insert into curriculum_units (curriculum_id, title, ordering, recommended_hours)
select cur.id, v.title, v.ordering, v.hours
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'Philosophie'
join education_levels el on el.id = cur.education_level_id and el.name = '1èreD'
cross join lateral (values
  ('La méthode de lecture de texte', 1, 14),
  ('La rédaction de l''introduction', 2, 2),
  ('La rédaction de la conclusion', 3, 2),
  ('L''essai de problématisation', 4, 10),
  ('La rédaction de l''introduction (essai de problématisation)', 5, 2),
  ('La rédaction de la conclusion (essai de problématisation)', 6, 2),
  ('La période antique', 7, 6),
  ('Le Moyen-Âge et la Renaissance', 8, 4),
  ('La période moderne', 9, 6),
  ('La période contemporaine', 10, 8)
) as v(title, ordering, hours)
where cur.version_label = 'DPFC 2025-2026' and el.name = '1èreD' and s.name = 'Philosophie';

insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select cu.curriculum_id, cu.id, v.week, cu.ordering
from curriculum_units cu
join curricula cur on cur.id = cu.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Philosophie'
join education_levels el on el.id = cur.education_level_id and el.name = '1èreD'
join (values (1,1),(2,8),(3,9),(4,11),(5,16),(6,17),(7,19),(8,22),(9,24),(10,27)) as v(ordering, week) on v.ordering = cu.ordering
where cur.version_label = 'DPFC 2025-2026' and el.name = '1èreD' and s.name = 'Philosophie';

-- 1.x Philosophie — TerminaleA1 (08H/semaine)
insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC 2025-2026',
  'https://dpfc-ci.net/dpfc/2026/progressions/PHILOSOPHIE%20PROGRESSIONS%20Tles%20A1-A2%202025-2026.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name = 'TerminaleA1'
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'Philosophie'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

insert into curriculum_units (curriculum_id, title, ordering, recommended_hours)
select cur.id, v.title, v.ordering, v.hours
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'Philosophie'
join education_levels el on el.id = cur.education_level_id and el.name = 'TerminaleA1'
cross join lateral (values
  ('La dissertation philosophique', 1, 8),
  ('Le commentaire de texte philosophique', 2, 8),
  ('La connaissance de l''homme', 3, 16),
  ('La vie en société', 4, 24),
  ('Dieu et la religion', 5, 8),
  ('L''histoire et l''humanité', 6, 32),
  ('La valeur de la philosophie', 7, 24),
  ('Progrès et bonheur', 8, 32),
  ('Langage et vérité', 9, 24),
  ('La connaissance scientifique', 10, 48)
) as v(title, ordering, hours)
where cur.version_label = 'DPFC 2025-2026' and el.name = 'TerminaleA1' and s.name = 'Philosophie';

insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select cu.curriculum_id, cu.id, v.week, cu.ordering
from curriculum_units cu
join curricula cur on cur.id = cu.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Philosophie'
join education_levels el on el.id = cur.education_level_id and el.name = 'TerminaleA1'
join (values (1,1),(2,2),(3,4),(4,6),(5,9),(6,11),(7,15),(8,18),(9,22),(10,25)) as v(ordering, week) on v.ordering = cu.ordering
where cur.version_label = 'DPFC 2025-2026' and el.name = 'TerminaleA1' and s.name = 'Philosophie';

-- 1.x Philosophie — TerminaleA2 (08H/semaine)
insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC 2025-2026',
  'https://dpfc-ci.net/dpfc/2026/progressions/PHILOSOPHIE%20PROGRESSIONS%20Tles%20A1-A2%202025-2026.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name = 'TerminaleA2'
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'Philosophie'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

insert into curriculum_units (curriculum_id, title, ordering, recommended_hours)
select cur.id, v.title, v.ordering, v.hours
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'Philosophie'
join education_levels el on el.id = cur.education_level_id and el.name = 'TerminaleA2'
cross join lateral (values
  ('La dissertation philosophique', 1, 8),
  ('Le commentaire de texte philosophique', 2, 8),
  ('La connaissance de l''homme', 3, 16),
  ('La vie en société', 4, 24),
  ('Dieu et la religion', 5, 8),
  ('L''histoire et l''humanité', 6, 32),
  ('La valeur de la philosophie', 7, 24),
  ('Progrès et bonheur', 8, 32),
  ('Langage et vérité', 9, 24),
  ('La connaissance scientifique', 10, 48)
) as v(title, ordering, hours)
where cur.version_label = 'DPFC 2025-2026' and el.name = 'TerminaleA2' and s.name = 'Philosophie';

insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select cu.curriculum_id, cu.id, v.week, cu.ordering
from curriculum_units cu
join curricula cur on cur.id = cu.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Philosophie'
join education_levels el on el.id = cur.education_level_id and el.name = 'TerminaleA2'
join (values (1,1),(2,2),(3,4),(4,6),(5,9),(6,11),(7,15),(8,18),(9,22),(10,25)) as v(ordering, week) on v.ordering = cu.ordering
where cur.version_label = 'DPFC 2025-2026' and el.name = 'TerminaleA2' and s.name = 'Philosophie';

-- 1.x Philosophie — TerminaleC (03H/semaine, contenu C-D-E)
insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC 2025-2026',
  'https://dpfc-ci.net/dpfc/2026/progressions/PHILOSOPHIE%20PROGRESSIONS%20Tles%20C-D-E%202025-2026.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name = 'TerminaleC'
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'Philosophie'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

insert into curriculum_units (curriculum_id, title, ordering, recommended_hours)
select cur.id, v.title, v.ordering, v.hours
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'Philosophie'
join education_levels el on el.id = cur.education_level_id and el.name = 'TerminaleC'
cross join lateral (values
  ('La dissertation philosophique', 1, 6),
  ('Le commentaire de texte philosophique', 2, 6),
  ('La connaissance de l''homme', 3, 9),
  ('La vie en société', 4, 9),
  ('Dieu et la religion', 5, 6),
  ('La valeur de la philosophie', 6, 9),
  ('Progrès et bonheur', 7, 18),
  ('Langage et vérité', 8, 9),
  ('La connaissance scientifique', 9, 18)
) as v(title, ordering, hours)
where cur.version_label = 'DPFC 2025-2026' and el.name = 'TerminaleC' and s.name = 'Philosophie';

insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select cu.curriculum_id, cu.id, v.week, cu.ordering
from curriculum_units cu
join curricula cur on cur.id = cu.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Philosophie'
join education_levels el on el.id = cur.education_level_id and el.name = 'TerminaleC'
join (values (1,1),(2,3),(3,5),(4,8),(5,11),(6,13),(7,16),(8,22),(9,25)) as v(ordering, week) on v.ordering = cu.ordering
where cur.version_label = 'DPFC 2025-2026' and el.name = 'TerminaleC' and s.name = 'Philosophie';

-- 1.x Philosophie — TerminaleD (03H/semaine, contenu C-D-E)
insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC 2025-2026',
  'https://dpfc-ci.net/dpfc/2026/progressions/PHILOSOPHIE%20PROGRESSIONS%20Tles%20C-D-E%202025-2026.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name = 'TerminaleD'
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'Philosophie'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

insert into curriculum_units (curriculum_id, title, ordering, recommended_hours)
select cur.id, v.title, v.ordering, v.hours
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'Philosophie'
join education_levels el on el.id = cur.education_level_id and el.name = 'TerminaleD'
cross join lateral (values
  ('La dissertation philosophique', 1, 6),
  ('Le commentaire de texte philosophique', 2, 6),
  ('La connaissance de l''homme', 3, 9),
  ('La vie en société', 4, 9),
  ('Dieu et la religion', 5, 6),
  ('La valeur de la philosophie', 6, 9),
  ('Progrès et bonheur', 7, 18),
  ('Langage et vérité', 8, 9),
  ('La connaissance scientifique', 9, 18)
) as v(title, ordering, hours)
where cur.version_label = 'DPFC 2025-2026' and el.name = 'TerminaleD' and s.name = 'Philosophie';

insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select cu.curriculum_id, cu.id, v.week, cu.ordering
from curriculum_units cu
join curricula cur on cur.id = cu.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Philosophie'
join education_levels el on el.id = cur.education_level_id and el.name = 'TerminaleD'
join (values (1,1),(2,3),(3,5),(4,8),(5,11),(6,13),(7,16),(8,22),(9,25)) as v(ordering, week) on v.ordering = cu.ordering
where cur.version_label = 'DPFC 2025-2026' and el.name = 'TerminaleD' and s.name = 'Philosophie';

-- ============================================================================
-- 2. ANGLAIS
-- ============================================================================

-- 2.x Anglais — 1èreA1 (contenu Première A)
insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC 2025-2026',
  'https://dpfc-ci.net/dpfc/2026/progressions/Anglais%20Progression%201%C3%A8re%20A%202025-2026.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name = '1èreA1'
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'Anglais'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

insert into curriculum_units (curriculum_id, title, ordering, recommended_hours)
select cur.id, v.title, v.ordering, v.hours
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'Anglais'
join education_levels el on el.id = cur.education_level_id and el.name = '1èreA1'
cross join lateral (values
  ('Travel and World Tourism', 1, 9),
  ('Natural Resources', 2, 9),
  ('Deadly Viruses and Diseases', 3, 9),
  ('Crime and Violence', 4, 9),
  ('Human Rights', 5, 9),
  ('Technology and Our Lives', 6, 9),
  ('Political Change', 7, 9),
  ('African Cultural Heritage', 8, 9),
  ('Our Consumer Society', 9, 9),
  ('Friends, Dating and Entertainment', 10, 9)
) as v(title, ordering, hours)
where cur.version_label = 'DPFC 2025-2026' and el.name = '1èreA1' and s.name = 'Anglais';

insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select cu.curriculum_id, cu.id, v.week, cu.ordering
from curriculum_units cu
join curricula cur on cur.id = cu.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Anglais'
join education_levels el on el.id = cur.education_level_id and el.name = '1èreA1'
join (values (1,1),(2,4),(3,7),(4,10),(5,13),(6,16),(7,19),(8,22),(9,25),(10,28)) as v(ordering, week) on v.ordering = cu.ordering
where cur.version_label = 'DPFC 2025-2026' and el.name = '1èreA1' and s.name = 'Anglais';

-- 2.x Anglais — 1èreA2 (contenu Première A)
insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC 2025-2026',
  'https://dpfc-ci.net/dpfc/2026/progressions/Anglais%20Progression%201%C3%A8re%20A%202025-2026.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name = '1èreA2'
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'Anglais'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

insert into curriculum_units (curriculum_id, title, ordering, recommended_hours)
select cur.id, v.title, v.ordering, v.hours
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'Anglais'
join education_levels el on el.id = cur.education_level_id and el.name = '1èreA2'
cross join lateral (values
  ('Travel and World Tourism', 1, 9),
  ('Natural Resources', 2, 9),
  ('Deadly Viruses and Diseases', 3, 9),
  ('Crime and Violence', 4, 9),
  ('Human Rights', 5, 9),
  ('Technology and Our Lives', 6, 9),
  ('Political Change', 7, 9),
  ('African Cultural Heritage', 8, 9),
  ('Our Consumer Society', 9, 9),
  ('Friends, Dating and Entertainment', 10, 9)
) as v(title, ordering, hours)
where cur.version_label = 'DPFC 2025-2026' and el.name = '1èreA2' and s.name = 'Anglais';

insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select cu.curriculum_id, cu.id, v.week, cu.ordering
from curriculum_units cu
join curricula cur on cur.id = cu.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Anglais'
join education_levels el on el.id = cur.education_level_id and el.name = '1èreA2'
join (values (1,1),(2,4),(3,7),(4,10),(5,13),(6,16),(7,19),(8,22),(9,25),(10,28)) as v(ordering, week) on v.ordering = cu.ordering
where cur.version_label = 'DPFC 2025-2026' and el.name = '1èreA2' and s.name = 'Anglais';

-- 2.x Anglais — 1èreC (contenu Première C-D)
insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC 2025-2026',
  'https://dpfc-ci.net/dpfc/2026/progressions/Anglais%20Progression%20Premi%C3%A8re%20C%20et%20D%202025-2026.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name = '1èreC'
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'Anglais'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

insert into curriculum_units (curriculum_id, title, ordering, recommended_hours)
select cur.id, v.title, v.ordering, v.hours
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'Anglais'
join education_levels el on el.id = cur.education_level_id and el.name = '1èreC'
cross join lateral (values
  ('Travel and World Tourism', 1, 12),
  ('Natural Resources', 2, 12),
  ('Deadly Viruses and Diseases', 3, 12),
  ('Crime and Violence', 4, 12),
  ('Human Rights', 5, 12),
  ('Technology and Our Lives', 6, 12),
  ('Political Change', 7, 12)
) as v(title, ordering, hours)
where cur.version_label = 'DPFC 2025-2026' and el.name = '1èreC' and s.name = 'Anglais';

insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select cu.curriculum_id, cu.id, v.week, cu.ordering
from curriculum_units cu
join curricula cur on cur.id = cu.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Anglais'
join education_levels el on el.id = cur.education_level_id and el.name = '1èreC'
join (values (1,1),(2,5),(3,9),(4,13),(5,17),(6,21),(7,25)) as v(ordering, week) on v.ordering = cu.ordering
where cur.version_label = 'DPFC 2025-2026' and el.name = '1èreC' and s.name = 'Anglais';

-- 2.x Anglais — 1èreD (contenu Première C-D)
insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC 2025-2026',
  'https://dpfc-ci.net/dpfc/2026/progressions/Anglais%20Progression%20Premi%C3%A8re%20C%20et%20D%202025-2026.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name = '1èreD'
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'Anglais'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

insert into curriculum_units (curriculum_id, title, ordering, recommended_hours)
select cur.id, v.title, v.ordering, v.hours
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'Anglais'
join education_levels el on el.id = cur.education_level_id and el.name = '1èreD'
cross join lateral (values
  ('Travel and World Tourism', 1, 12),
  ('Natural Resources', 2, 12),
  ('Deadly Viruses and Diseases', 3, 12),
  ('Crime and Violence', 4, 12),
  ('Human Rights', 5, 12),
  ('Technology and Our Lives', 6, 12),
  ('Political Change', 7, 12)
) as v(title, ordering, hours)
where cur.version_label = 'DPFC 2025-2026' and el.name = '1èreD' and s.name = 'Anglais';

insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select cu.curriculum_id, cu.id, v.week, cu.ordering
from curriculum_units cu
join curricula cur on cur.id = cu.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Anglais'
join education_levels el on el.id = cur.education_level_id and el.name = '1èreD'
join (values (1,1),(2,5),(3,9),(4,13),(5,17),(6,21),(7,25)) as v(ordering, week) on v.ordering = cu.ordering
where cur.version_label = 'DPFC 2025-2026' and el.name = '1èreD' and s.name = 'Anglais';

-- 2.x Anglais — TerminaleA1 (contenu Terminale A)
insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC 2025-2026',
  'https://dpfc-ci.net/dpfc/2026/progressions/Anglais%20Progression%20Terminale%20A%202025-2026.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name = 'TerminaleA1'
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'Anglais'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

insert into curriculum_units (curriculum_id, title, ordering, recommended_hours)
select cur.id, v.title, v.ordering, v.hours
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'Anglais'
join education_levels el on el.id = cur.education_level_id and el.name = 'TerminaleA1'
cross join lateral (values
  ('Lifestyles: Moving with the Times', 1, 9),
  ('Freedom and Civil Rights', 2, 9),
  ('Development Issues', 3, 9),
  ('What the Future Holds', 4, 9),
  ('Managing Resources', 5, 9),
  ('Contemporary Africa', 6, 9),
  ('International Issues', 7, 9),
  ('Cultural Differences', 8, 9),
  ('Justice', 9, 9),
  ('Demography', 10, 9)
) as v(title, ordering, hours)
where cur.version_label = 'DPFC 2025-2026' and el.name = 'TerminaleA1' and s.name = 'Anglais';

insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select cu.curriculum_id, cu.id, v.week, cu.ordering
from curriculum_units cu
join curricula cur on cur.id = cu.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Anglais'
join education_levels el on el.id = cur.education_level_id and el.name = 'TerminaleA1'
join (values (1,1),(2,4),(3,7),(4,10),(5,13),(6,16),(7,19),(8,22),(9,25),(10,28)) as v(ordering, week) on v.ordering = cu.ordering
where cur.version_label = 'DPFC 2025-2026' and el.name = 'TerminaleA1' and s.name = 'Anglais';

-- 2.x Anglais — TerminaleA2 (contenu Terminale A)
insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC 2025-2026',
  'https://dpfc-ci.net/dpfc/2026/progressions/Anglais%20Progression%20Terminale%20A%202025-2026.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name = 'TerminaleA2'
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'Anglais'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

insert into curriculum_units (curriculum_id, title, ordering, recommended_hours)
select cur.id, v.title, v.ordering, v.hours
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'Anglais'
join education_levels el on el.id = cur.education_level_id and el.name = 'TerminaleA2'
cross join lateral (values
  ('Lifestyles: Moving with the Times', 1, 9),
  ('Freedom and Civil Rights', 2, 9),
  ('Development Issues', 3, 9),
  ('What the Future Holds', 4, 9),
  ('Managing Resources', 5, 9),
  ('Contemporary Africa', 6, 9),
  ('International Issues', 7, 9),
  ('Cultural Differences', 8, 9),
  ('Justice', 9, 9),
  ('Demography', 10, 9)
) as v(title, ordering, hours)
where cur.version_label = 'DPFC 2025-2026' and el.name = 'TerminaleA2' and s.name = 'Anglais';

insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select cu.curriculum_id, cu.id, v.week, cu.ordering
from curriculum_units cu
join curricula cur on cur.id = cu.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Anglais'
join education_levels el on el.id = cur.education_level_id and el.name = 'TerminaleA2'
join (values (1,1),(2,4),(3,7),(4,10),(5,13),(6,16),(7,19),(8,22),(9,25),(10,28)) as v(ordering, week) on v.ordering = cu.ordering
where cur.version_label = 'DPFC 2025-2026' and el.name = 'TerminaleA2' and s.name = 'Anglais';

-- 2.x Anglais — TerminaleC (contenu Terminale C-D)
insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC 2025-2026',
  'https://dpfc-ci.net/dpfc/2026/progressions/Anglais%20Progression%20Terminale%20C%20et%20D%202025-2026.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name = 'TerminaleC'
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'Anglais'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

insert into curriculum_units (curriculum_id, title, ordering, recommended_hours)
select cur.id, v.title, v.ordering, v.hours
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'Anglais'
join education_levels el on el.id = cur.education_level_id and el.name = 'TerminaleC'
cross join lateral (values
  ('Lifestyles: Moving with the Times', 1, 10),
  ('Freedom and Civil Rights', 2, 10),
  ('Development Issues', 3, 10),
  ('What the Future Holds', 4, 10),
  ('Managing Resources', 5, 10),
  ('Contemporary Africa', 6, 10)
) as v(title, ordering, hours)
where cur.version_label = 'DPFC 2025-2026' and el.name = 'TerminaleC' and s.name = 'Anglais';

insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select cu.curriculum_id, cu.id, v.week, cu.ordering
from curriculum_units cu
join curricula cur on cur.id = cu.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Anglais'
join education_levels el on el.id = cur.education_level_id and el.name = 'TerminaleC'
join (values (1,1),(2,6),(3,11),(4,16),(5,21),(6,26)) as v(ordering, week) on v.ordering = cu.ordering
where cur.version_label = 'DPFC 2025-2026' and el.name = 'TerminaleC' and s.name = 'Anglais';

-- 2.x Anglais — TerminaleD (contenu Terminale C-D)
insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC 2025-2026',
  'https://dpfc-ci.net/dpfc/2026/progressions/Anglais%20Progression%20Terminale%20C%20et%20D%202025-2026.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name = 'TerminaleD'
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'Anglais'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

insert into curriculum_units (curriculum_id, title, ordering, recommended_hours)
select cur.id, v.title, v.ordering, v.hours
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'Anglais'
join education_levels el on el.id = cur.education_level_id and el.name = 'TerminaleD'
cross join lateral (values
  ('Lifestyles: Moving with the Times', 1, 10),
  ('Freedom and Civil Rights', 2, 10),
  ('Development Issues', 3, 10),
  ('What the Future Holds', 4, 10),
  ('Managing Resources', 5, 10),
  ('Contemporary Africa', 6, 10)
) as v(title, ordering, hours)
where cur.version_label = 'DPFC 2025-2026' and el.name = 'TerminaleD' and s.name = 'Anglais';

insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select cu.curriculum_id, cu.id, v.week, cu.ordering
from curriculum_units cu
join curricula cur on cur.id = cu.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Anglais'
join education_levels el on el.id = cur.education_level_id and el.name = 'TerminaleD'
join (values (1,1),(2,6),(3,11),(4,16),(5,21),(6,26)) as v(ordering, week) on v.ordering = cu.ordering
where cur.version_label = 'DPFC 2025-2026' and el.name = 'TerminaleD' and s.name = 'Anglais';

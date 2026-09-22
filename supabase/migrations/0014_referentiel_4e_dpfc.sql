-- ============================================================================
-- 0014_referentiel_4e_dpfc.sql
-- Troisième enrichissement réel du référentiel (Convention §8/§19), niveau 4e
-- (collège), les 6 matières déjà seedées en 0007. Suite de 0012 (6e) et 0013
-- (5e), à la demande explicite de l'utilisateur ("EF-REF 4e").
--
-- SOURCES OFFICIELLES DPFC consultées le 15 août 2026 (chaque
-- `curricula.source_document_url` pointe vers le PDF exact utilisé) :
--   - Mathématiques : même document combiné 6e->Tle que 0012/0013
--     (MATHS - Progressions 2025-2026.pdf, section "PROGRESSION 4e").
--   - SVT : SVT PROGRESSIONS ANNUELLES 2025-2026.pdf, section "Niveau : 4e"
--     (structure par compétences/leçons, comme 6e/5e).
--   - Physique-Chimie : Physique-Chimie Progressions 2025-2026.pdf,
--     section "PROGRESSION DE PHYSIQUE-CHIMIE QUATRIÈME 2025-2026".
--   - Anglais : Anglais Progression 4ème 2025-2026.pdf (fichier dédié au
--     niveau, comme 6e/5e).
--   - Français : FRANCAIS_PROGRESSIONS_A USAGE PEDAGOGIQUE 2025-2026 1er
--     Cycle DPFC.pdf, section "PROGRESSION ANNUELLE DE LA CLASSE DE
--     QUATRIÈME" (même document que 6e/5e).
--   - Histoire-Géographie : comme pour la 5e, PAS de progression 2025-2026
--     dédiée publiée pour la 4e sur la page officielle des progressions du
--     secondaire (seule la 6e "nouveau programme" y figure). Utilisé à la
--     place : le programme éducatif officiel DPFC "Histoire-Géographie
--     4ème/3ème" (HISTGEO_4eme.pdf), qui contient sa propre section
--     "PROGRESSION ANNUELLE" pour Histoire et Géographie séparément --
--     même source institutionnelle (dpfc-ci.net) que celle utilisée pour
--     la 5e, non datée par année scolaire pour la même raison (guide non
--     republié chaque année, mais jamais retiré ni remplacé).
--
-- Comme pour 0012/0013 : contenu rattaché à l'année scolaire COURANTE
-- (2026-2027, déjà seedée en 0007), via `expected_week` uniquement (numéro
-- de semaine 1 à 30/32 tel que publié) -- jamais de date calendaire
-- inventée. Rien n'est inventé : tout intitulé de leçon/thème et tout
-- volume horaire est recopié tel quel des documents cités.
--
-- Même simplification assumée qu'en 0013 pour le Français : seuls les 5
-- domaines parents sont créés (Grammaire/Orthographe, Expression orale,
-- Étude d'œuvre intégrale, Lecture méthodique/Exploitation de texte,
-- Expression écrite), sans séquences filles ni official_progression_steps
-- -- les domaines avancent en parallèle chaque semaine, un simple
-- expected_week par domaine déformerait la réalité du programme.
--
-- Cas particulier SVT 4e : le document officiel numérote les compétences
-- dans l'ordre C1, C4, C2, C3 (pas C1,C2,C3,C4) -- numérotation recopiée
-- telle quelle (Convention §19), l'ordonnancement `ordering` suit l'ordre
-- de déroulement réel dans l'année (donc C1, C4, C2, C3).
--
-- Non couvert dans ce lot : 3e/2nde/1ère/Tle et les matières secondaires,
-- à sourcer un par un (jamais improvisé). La Physique-Chimie CI ne
-- distingue pas de sous-matière Physique/Chimie dans le référentiel (une
-- seule matière "Physique-Chimie", Convention §9) -- modélisée ici avec
-- des unités parentes "thème" (Optique, Courants et tensions alternatifs,
-- Les ions, Eau potable), comme pour 6e/5e.
-- ============================================================================

-- ============================================================================
-- 1. MATHÉMATIQUES 4e
-- Source : https://dpfc-ci.net/dpfc/2026/progressions/MATHS%20-%20Progressions%20%202025-2026.pdf
-- Volume horaire annuel officiel : 120h (4h/semaine)
-- ============================================================================

insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC 2025-2026 (contenu reconduit)',
  'https://dpfc-ci.net/dpfc/2026/progressions/MATHS%20-%20Progressions%20%202025-2026.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name = '4e'
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'Mathématiques'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

insert into curriculum_units (curriculum_id, title, ordering, recommended_hours)
select cur.id, v.title, v.ordering, v.hours
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'Mathématiques'
join education_levels el on el.id = cur.education_level_id and el.name = '4e'
cross join lateral (values
  ('Nombres décimaux relatifs', 1, 7),
  ('Angles', 2, 7),
  ('Nombres rationnels', 3, 13),
  ('Distances', 4, 7),
  ('Perspective cavalière', 5, 9),
  ('Calcul littéral', 6, 9),
  ('Cercles et triangles', 7, 9),
  ('Équations et inéquations', 8, 7),
  ('Vecteurs', 9, 13),
  ('Statistique', 10, 5),
  ('Symétries et translations', 11, 15)
) as v(title, ordering, hours)
where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and cur.subject_id = (select id from subjects where name = 'Mathématiques' limit 1)
  and cur.education_level_id = el.id;

insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select cu.curriculum_id, cu.id, v.week, cu.ordering
from curriculum_units cu
join curricula cur on cur.id = cu.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Mathématiques'
join education_levels el on el.id = cur.education_level_id and el.name = '4e'
join (values
  (1,1),(2,3),(3,5),(4,8),(5,10),(6,12),(7,15),(8,18),(9,20),(10,23),(11,25)
) as v(ordering, week) on v.ordering = cu.ordering
where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and cur.education_level_id = el.id;

-- ============================================================================
-- 2. FRANÇAIS 4e (5 domaines menés en parallèle, comme 6e/5e)
-- Source : https://dpfc-ci.net/dpfc/2026/progressions/FRANCAIS_PROGRESSIONS_A%20USAGE%20PEDAGOGIQUE%20_2025-2026%201er%20Cycle%20DPFC.pdf
-- Pas d'official_progression_steps (voir note en tête de fichier).
-- ============================================================================

insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC 2025-2026 (contenu reconduit)',
  'https://dpfc-ci.net/dpfc/2026/progressions/FRANCAIS_PROGRESSIONS_A%20USAGE%20PEDAGOGIQUE%20_2025-2026%201er%20Cycle%20DPFC.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name = '4e'
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'Français'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

insert into curriculum_units (curriculum_id, title, ordering)
select cur.id, v.title, v.ordering
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'Français'
join education_levels el on el.id = cur.education_level_id and el.name = '4e'
cross join lateral (values
  ('Grammaire / Orthographe', 1),
  ('Expression orale', 2),
  ('Étude d''œuvre intégrale', 3),
  ('Lecture méthodique / Exploitation de texte', 4),
  ('Expression écrite', 5)
) as v(title, ordering)
where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and cur.subject_id = (select id from subjects where name = 'Français' limit 1)
  and cur.education_level_id = el.id;

-- ============================================================================
-- 3. SVT 4e (structure par compétences/leçons, comme 6e/5e)
-- Source : https://dpfc-ci.net/dpfc/2026/progressions/SVT%20PROGRESSIONS%20ANNUELLES%202025%202026%20.pdf
-- Numérotation officielle des compétences non séquentielle : C1, C4, C2, C3
-- (recopiée telle quelle, voir note en tête de fichier).
-- ============================================================================

insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC 2025-2026 (contenu reconduit)',
  'https://dpfc-ci.net/dpfc/2026/progressions/SVT%20PROGRESSIONS%20ANNUELLES%202025%202026%20.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name = '4e'
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'SVT'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

insert into curriculum_units (curriculum_id, title, ordering)
select cur.id, v.title, v.ordering
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'SVT'
join education_levels el on el.id = cur.education_level_id and el.name = '4e'
cross join lateral (values
  ('Compétence 1 : Reproduction humaine', 1),
  ('Compétence 4 : Utilisation de l''eau et santé de l''Homme', 2),
  ('Compétence 2 : Formation et dégradation des roches endogènes', 3),
  ('Compétence 3 : Formation des sols et leurs caractéristiques', 4)
) as v(title, ordering)
where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and cur.subject_id = (select id from subjects where name = 'SVT' limit 1)
  and cur.education_level_id = el.id;

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering, recommended_hours)
select p.curriculum_id, p.id, v.title, v.ordering, v.hours
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'SVT'
join education_levels el on el.id = cur.education_level_id and el.name = '4e'
cross join lateral (values
  ('Les différentes transformations du corps humain de l''enfance à l''adolescence', 1, 2),
  ('Le devenir des cellules sexuelles chez l''Homme', 2, 4)
) as v(title, ordering, hours)
where p.title = 'Compétence 1 : Reproduction humaine' and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and cur.education_level_id = el.id;

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering, recommended_hours)
select p.curriculum_id, p.id, v.title, v.ordering, v.hours
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'SVT'
join education_levels el on el.id = cur.education_level_id and el.name = '4e'
cross join lateral (values
  ('Les maladies liées à l''eau', 1, 3),
  ('La lutte contre les maladies liées à l''eau', 2, 3),
  ('Le traitement de l''eau souillée', 3, 2)
) as v(title, ordering, hours)
where p.title = 'Compétence 4 : Utilisation de l''eau et santé de l''Homme' and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and cur.education_level_id = el.id;

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering, recommended_hours)
select p.curriculum_id, p.id, v.title, v.ordering, v.hours
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'SVT'
join education_levels el on el.id = cur.education_level_id and el.name = '4e'
cross join lateral (values
  ('La formation des roches endogènes', 1, 3),
  ('La dégradation des roches endogènes', 2, 3)
) as v(title, ordering, hours)
where p.title = 'Compétence 2 : Formation et dégradation des roches endogènes' and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and cur.education_level_id = el.id;

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering, recommended_hours)
select p.curriculum_id, p.id, v.title, v.ordering, v.hours
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'SVT'
join education_levels el on el.id = cur.education_level_id and el.name = '4e'
cross join lateral (values
  ('La formation des sols', 1, 2),
  ('Les textures des sols', 2, 2)
) as v(title, ordering, hours)
where p.title = 'Compétence 3 : Formation des sols et leurs caractéristiques' and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and cur.education_level_id = el.id;

insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select cu.curriculum_id, cu.id, v.week, v.ordering
from curriculum_units cu
join curricula cur on cur.id = cu.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'SVT'
join education_levels el on el.id = cur.education_level_id and el.name = '4e'
join (values
  ('Les différentes transformations du corps humain de l''enfance à l''adolescence', 1, 1),
  ('Le devenir des cellules sexuelles chez l''Homme', 2, 3),
  ('Les maladies liées à l''eau', 3, 9),
  ('La lutte contre les maladies liées à l''eau', 4, 12),
  ('Le traitement de l''eau souillée', 5, 15),
  ('La formation des roches endogènes', 6, 18),
  ('La dégradation des roches endogènes', 7, 21),
  ('La formation des sols', 8, 25),
  ('Les textures des sols', 9, 27)
) as v(title, ordering, week) on v.title = cu.title
where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and cur.education_level_id = el.id and cu.parent_unit_id is not null;

-- ============================================================================
-- 4. PHYSIQUE-CHIMIE 4e (thèmes en unités parentes, comme 6e/5e)
-- Source : https://dpfc-ci.net/dpfc/2026/progressions/Physique-Chimie%20Progressions%202025-2026.pdf
-- (section "PROGRESSION DE PHYSIQUE-CHIMIE QUATRIÈME 2025-2026")
-- ============================================================================

insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC 2025-2026 (contenu reconduit)',
  'https://dpfc-ci.net/dpfc/2026/progressions/Physique-Chimie%20Progressions%202025-2026.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name = '4e'
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'Physique-Chimie'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

insert into curriculum_units (curriculum_id, title, ordering)
select cur.id, v.title, v.ordering
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'Physique-Chimie'
join education_levels el on el.id = cur.education_level_id and el.name = '4e'
cross join lateral (values
  ('Physique — Optique', 1),
  ('Physique — Courants et tensions alternatifs', 2),
  ('Chimie — Les ions', 3),
  ('Chimie — Eau potable', 4)
) as v(title, ordering)
where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and cur.subject_id = (select id from subjects where name = 'Physique-Chimie' limit 1)
  and cur.education_level_id = el.id;

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Physique-Chimie'
join education_levels el on el.id = cur.education_level_id and el.name = '4e'
cross join lateral (values
  ('Sources et récepteurs de lumière', 1),
  ('Propagation de la lumière', 2),
  ('Les phases de la Lune et les éclipses', 3),
  ('Analyse et synthèse de la lumière blanche', 4)
) as v(title, ordering)
where p.title = 'Physique — Optique' and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and cur.education_level_id = el.id;

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Physique-Chimie'
join education_levels el on el.id = cur.education_level_id and el.name = '4e'
cross join lateral (values
  ('Aimant et bobine', 1),
  ('Production d''une tension alternative', 2),
  ('Tension alternative sinusoïdale', 3),
  ('Dangers du courant du secteur', 4),
  ('Transformation, redressement et lissage d''une tension alternative sinusoïdale', 5)
) as v(title, ordering)
where p.title = 'Physique — Courants et tensions alternatifs' and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and cur.education_level_id = el.id;

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Physique-Chimie'
join education_levels el on el.id = cur.education_level_id and el.name = '4e'
cross join lateral (values
  ('Atomes et ions', 1),
  ('Transformation d''un métal en ion et inversement', 2)
) as v(title, ordering)
where p.title = 'Chimie — Les ions' and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and cur.education_level_id = el.id;

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Physique-Chimie'
join education_levels el on el.id = cur.education_level_id and el.name = '4e'
cross join lateral (values
  ('Traitement de l''eau', 1),
  ('Qualité de l''eau', 2)
) as v(title, ordering)
where p.title = 'Chimie — Eau potable' and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and cur.education_level_id = el.id;

insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select cu.curriculum_id, cu.id, v.week, v.ordering
from curriculum_units cu
join curricula cur on cur.id = cu.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Physique-Chimie'
join education_levels el on el.id = cur.education_level_id and el.name = '4e'
join (values
  ('Sources et récepteurs de lumière', 1, 1),
  ('Propagation de la lumière', 2, 3),
  ('Les phases de la Lune et les éclipses', 3, 5),
  ('Analyse et synthèse de la lumière blanche', 4, 7),
  ('Aimant et bobine', 5, 10),
  ('Production d''une tension alternative', 6, 11),
  ('Tension alternative sinusoïdale', 7, 13),
  ('Dangers du courant du secteur', 8, 14),
  ('Transformation, redressement et lissage d''une tension alternative sinusoïdale', 9, 16),
  ('Atomes et ions', 10, 19),
  ('Transformation d''un métal en ion et inversement', 11, 21),
  ('Traitement de l''eau', 12, 24),
  ('Qualité de l''eau', 13, 26)
) as v(title, ordering, week) on v.title = cu.title
where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and cur.education_level_id = el.id and cu.parent_unit_id is not null;

-- ============================================================================
-- 5. HISTOIRE-GÉOGRAPHIE 4e
-- Source : programme éducatif officiel DPFC "Histoire-Géographie 4ème/3ème",
-- incluant sa propre "PROGRESSION ANNUELLE" -- voir note en tête de fichier
-- sur l'absence de progression 2025-2026 dédiée publiée.
-- https://dpfc-ci.net/wp-content/uploads/dpfc_fichiers/Programmes/prg_secondaire/Histoire_Geographie/HISTGEO_4eme.pdf
-- ============================================================================

insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC — programme éducatif officiel (contenu reconduit)',
  'https://dpfc-ci.net/wp-content/uploads/dpfc_fichiers/Programmes/prg_secondaire/Histoire_Geographie/HISTGEO_4eme.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name = '4e'
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'Histoire-Géographie'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

insert into curriculum_units (curriculum_id, title, ordering)
select cur.id, v.title, v.ordering
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'Histoire-Géographie'
join education_levels el on el.id = cur.education_level_id and el.name = '4e'
cross join lateral (values
  ('Histoire — Thème 1 : Les peuples de Côte d''Ivoire et leurs contacts avec l''Europe du XVIe au XVIIIe siècle', 1),
  ('Histoire — Thème 2 : Les bouleversements sociopolitiques et économiques en Afrique et en Europe du XVIIe au XIXe siècle', 2),
  ('Géographie — Thème 1 : L''organisation administrative dans le développement de la Côte d''Ivoire', 3),
  ('Géographie — Thème 2 : Les regroupements économiques en Afrique de l''Ouest et en Europe (CEDEAO, UE)', 4)
) as v(title, ordering)
where cur.version_label = 'DPFC — programme éducatif officiel (contenu reconduit)' and cur.subject_id = (select id from subjects where name = 'Histoire-Géographie' limit 1)
  and cur.education_level_id = el.id;

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering, recommended_hours)
select p.curriculum_id, p.id, v.title, v.ordering, v.hours
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Histoire-Géographie'
join education_levels el on el.id = cur.education_level_id and el.name = '4e'
cross join lateral (values
  ('Leçon 1 : La mise en place des peuples de Côte d''Ivoire du XVIe au XVIIIe siècle', 1, 3),
  ('Leçon 2 : L''organisation sociopolitique des peuples de Côte d''Ivoire', 2, 3),
  ('Leçon 3 : Les mécanismes de prévention et de résolution des conflits chez les peuples de Côte d''Ivoire', 3, 3),
  ('Leçon 4 : L''évolution des contacts entre la Côte d''Ivoire et l''Europe du XVIe au XVIIIe siècle', 4, 2)
) as v(title, ordering, hours)
where p.title = 'Histoire — Thème 1 : Les peuples de Côte d''Ivoire et leurs contacts avec l''Europe du XVIe au XVIIIe siècle' and cur.version_label = 'DPFC — programme éducatif officiel (contenu reconduit)' and cur.education_level_id = el.id;

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering, recommended_hours)
select p.curriculum_id, p.id, v.title, v.ordering, v.hours
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Histoire-Géographie'
join education_levels el on el.id = cur.education_level_id and el.name = '4e'
cross join lateral (values
  ('Leçon 1 : La traite négrière dans l''histoire de l''humanité', 1, 3),
  ('Leçon 2 : La Révolution française de 1789', 2, 3),
  ('Leçon 3 : La Révolution industrielle aux XVIIIe et XIXe siècles en Europe', 3, 3)
) as v(title, ordering, hours)
where p.title = 'Histoire — Thème 2 : Les bouleversements sociopolitiques et économiques en Afrique et en Europe du XVIIe au XIXe siècle' and cur.version_label = 'DPFC — programme éducatif officiel (contenu reconduit)' and cur.education_level_id = el.id;

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering, recommended_hours)
select p.curriculum_id, p.id, v.title, v.ordering, v.hours
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Histoire-Géographie'
join education_levels el on el.id = cur.education_level_id and el.name = '4e'
cross join lateral (values
  ('Leçon 1 : La déconcentration administrative en Côte d''Ivoire', 1, 4),
  ('Leçon 2 : La décentralisation administrative en Côte d''Ivoire', 2, 4),
  ('Leçon 3 : Les insuffisances de l''organisation administrative dans le développement de la Côte d''Ivoire', 3, 4)
) as v(title, ordering, hours)
where p.title = 'Géographie — Thème 1 : L''organisation administrative dans le développement de la Côte d''Ivoire' and cur.version_label = 'DPFC — programme éducatif officiel (contenu reconduit)' and cur.education_level_id = el.id;

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering, recommended_hours)
select p.curriculum_id, p.id, v.title, v.ordering, v.hours
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Histoire-Géographie'
join education_levels el on el.id = cur.education_level_id and el.name = '4e'
cross join lateral (values
  ('Leçon 1 : La Communauté économique des États de l''Afrique de l''Ouest (CEDEAO) : succès et limites', 1, 4),
  ('Leçon 2 : L''Union européenne (UE) : un exemple d''intégration régionale', 2, 4)
) as v(title, ordering, hours)
where p.title = 'Géographie — Thème 2 : Les regroupements économiques en Afrique de l''Ouest et en Europe (CEDEAO, UE)' and cur.version_label = 'DPFC — programme éducatif officiel (contenu reconduit)' and cur.education_level_id = el.id;

insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select cu.curriculum_id, cu.id, v.week, v.ordering
from curriculum_units cu
join curricula cur on cur.id = cu.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Histoire-Géographie'
join education_levels el on el.id = cur.education_level_id and el.name = '4e'
join (values
  ('Leçon 1 : La mise en place des peuples de Côte d''Ivoire du XVIe au XVIIIe siècle', 1, 1),
  ('Leçon 2 : L''organisation sociopolitique des peuples de Côte d''Ivoire', 2, 3),
  ('Leçon 3 : Les mécanismes de prévention et de résolution des conflits chez les peuples de Côte d''Ivoire', 3, 7),
  ('Leçon 4 : L''évolution des contacts entre la Côte d''Ivoire et l''Europe du XVIe au XVIIIe siècle', 4, 13),
  ('Leçon 1 : La traite négrière dans l''histoire de l''humanité', 5, 15),
  ('Leçon 2 : La Révolution française de 1789', 6, 21),
  ('Leçon 3 : La Révolution industrielle aux XVIIIe et XIXe siècles en Europe', 7, 24),
  ('Leçon 1 : La déconcentration administrative en Côte d''Ivoire', 8, 1),
  ('Leçon 2 : La décentralisation administrative en Côte d''Ivoire', 9, 3),
  ('Leçon 3 : Les insuffisances de l''organisation administrative dans le développement de la Côte d''Ivoire', 10, 13),
  ('Leçon 1 : La Communauté économique des États de l''Afrique de l''Ouest (CEDEAO) : succès et limites', 11, 17),
  ('Leçon 2 : L''Union européenne (UE) : un exemple d''intégration régionale', 12, 25)
) as v(title, ordering, week) on v.title = cu.title and v.ordering = (
    case
      when cu.parent_unit_id = (select id from curriculum_units where title = 'Histoire — Thème 1 : Les peuples de Côte d''Ivoire et leurs contacts avec l''Europe du XVIe au XVIIIe siècle' and curriculum_id = cu.curriculum_id) then cu.ordering
      when cu.parent_unit_id = (select id from curriculum_units where title = 'Histoire — Thème 2 : Les bouleversements sociopolitiques et économiques en Afrique et en Europe du XVIIe au XIXe siècle' and curriculum_id = cu.curriculum_id) then cu.ordering + 4
      when cu.parent_unit_id = (select id from curriculum_units where title = 'Géographie — Thème 1 : L''organisation administrative dans le développement de la Côte d''Ivoire' and curriculum_id = cu.curriculum_id) then cu.ordering + 7
      when cu.parent_unit_id = (select id from curriculum_units where title = 'Géographie — Thème 2 : Les regroupements économiques en Afrique de l''Ouest et en Europe (CEDEAO, UE)' and curriculum_id = cu.curriculum_id) then cu.ordering + 10
    end
  )
where cur.version_label = 'DPFC — programme éducatif officiel (contenu reconduit)' and cur.education_level_id = el.id and cu.parent_unit_id is not null;

-- ============================================================================
-- 6. ANGLAIS 4e
-- Source : https://dpfc-ci.net/dpfc/2026/progressions/Anglais%20Progression%204%C3%A8me%202025-2026.pdf
-- Volume horaire annuel officiel : 90h
-- ============================================================================

insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC 2025-2026 (contenu reconduit)',
  'https://dpfc-ci.net/dpfc/2026/progressions/Anglais%20Progression%204%C3%A8me%202025-2026.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name = '4e'
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'Anglais'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

insert into curriculum_units (curriculum_id, title, ordering, recommended_hours)
select cur.id, v.title, v.ordering, v.hours
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'Anglais'
join education_levels el on el.id = cur.education_level_id and el.name = '4e'
cross join lateral (values
  ('Life at school (La vie à l''école)', 1, 11),
  ('Women at work (La femme au travail)', 2, 11),
  ('Travelling (Les voyages)', 3, 11),
  ('Fashion (La mode)', 4, 12),
  ('City or village (Au village ou à la ville)', 5, 11),
  ('Human rights (Les droits humains)', 6, 11),
  ('Hygiene and health (Hygiène et santé)', 7, 11),
  ('Information and Communication Technologies (les TIC)', 8, 12)
) as v(title, ordering, hours)
where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and cur.subject_id = (select id from subjects where name = 'Anglais' limit 1)
  and cur.education_level_id = el.id;

insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select cu.curriculum_id, cu.id, v.week, cu.ordering
from curriculum_units cu
join curricula cur on cur.id = cu.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Anglais'
join education_levels el on el.id = cur.education_level_id and el.name = '4e'
join (values
  (1,1),(2,5),(3,9),(4,12),(5,16),(6,19),(7,23),(8,27)
) as v(ordering, week) on v.ordering = cu.ordering
where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and cur.education_level_id = el.id and cu.parent_unit_id is null;

-- ============================================================================
-- 0013_referentiel_5e_dpfc.sql
-- Deuxième enrichissement réel du référentiel (Convention §8/§19), niveau 5e
-- (collège), les 6 matières déjà seedées en 0007. Suite de 0012 (6e), à la
-- demande explicite de l'utilisateur ("programme DPFC 5e -> Tle").
--
-- SOURCES OFFICIELLES DPFC consultées le 15 août 2026 (chaque
-- `curricula.source_document_url` pointe vers le PDF exact utilisé) :
--   - Mathématiques : même document combiné 6e->Tle que 0012
--     (MATHS - Progressions 2025-2026.pdf, section "PROGRESSION 5e").
--   - SVT : SVT PROGRESSIONS ANNUELLES 2025-2026.pdf, section "Niveau : 5e"
--     (structure par compétences/leçons, comme la source de la SVT 6e).
--   - Physique-Chimie : Physique-Chimie Progressions 2025-2026.pdf,
--     section "PROGRESSION DE PHYSIQUE-CHIMIE CINQUIÈME 2025-2026".
--   - Anglais : Anglais Progression 5ème 2025-2026.pdf (fichier dédié au
--     niveau, comme pour la 6e).
--   - Français : FRANCAIS_PROGRESSIONS_A USAGE PEDAGOGIQUE 2025-2026 1er
--     Cycle DPFC.pdf, section "PROGRESSION ANNUELLE DE LA CLASSE DE
--     CINQUIÈME" (même document que celui qui contient aussi la 6e/4e/3e).
--   - Histoire-Géographie : PAS de progression 2025-2026 dédiée publiée
--     pour la 5e sur la page officielle des progressions du secondaire
--     (contrairement aux 5 autres matières) -- seule la 6e "nouveau
--     programme" y figure. Utilisé à la place : le programme éducatif
--     officiel DPFC de la 5e (HISTGEO_5eme.pdf, Histoire et Géographie
--     regroupées, programme "standard" toujours en vigueur), qui contient
--     sa propre section "PROGRESSION ANNUELLE" officielle (Histoire 5e et
--     Géographie 5e séparément) -- même source institutionnelle
--     (dpfc-ci.net), non datée par année scolaire car ce guide n'est pas
--     republié chaque année comme les progressions du secondaire, mais
--     jamais retiré ni remplacé par une version plus récente à ce jour.
--
-- Comme pour 0012 : contenu rattaché à l'année scolaire COURANTE (2026-2027,
-- déjà seedée en 0007), via `expected_week` uniquement (numéro de semaine
-- 1 à 30, tel que publié) -- jamais de date calendaire inventée. Rien
-- n'est inventé : tout intitulé de leçon/thème et tout volume horaire est
-- recopié tel quel des documents cités.
--
-- Simplification assumée par rapport à 0012 (à documenter comme dette,
-- Convention §19 : mieux vaut l'omettre que l'improviser) : pour le
-- Français, 0012 avait détaillé des unités filles (séquences) sous le
-- domaine Grammaire/Orthographe/Lexique de la 6e. Pour tenir un rythme
-- soutenable sur 6 matières d'un même lot, ce niveau de détail n'est PAS
-- reproduit ici pour la 5e : seuls les 5 domaines parents sont créés
-- (Grammaire/Orthographe/Lexique, Expression orale, Étude d'œuvre
-- intégrale, Lecture méthodique/Exploitation de texte, Expression écrite),
-- sans séquences filles ni official_progression_steps (même raison qu'en
-- 0012 : les domaines avancent en parallèle, un simple expected_week par
-- domaine déformerait la réalité du programme).
--
-- Non couvert dans ce lot : 4e/3e/2nde/1ère/Tle, matières secondaires. La
-- Physique-Chimie CI ne distingue pas de sous-matière Physique/Chimie dans
-- le référentiel (une seule matière "Physique-Chimie", conformément à
-- Convention §9) -- modélisée ici avec des unités parentes "thème" par
-- discipline (Physique / Chimie), comme pour Histoire-Géographie.
-- ============================================================================

-- ============================================================================
-- 1. MATHÉMATIQUES 5e
-- Source : https://dpfc-ci.net/dpfc/2026/progressions/MATHS%20-%20Progressions%20%202025-2026.pdf
-- Volume horaire annuel officiel : 120h (4h/semaine)
-- ============================================================================

insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC 2025-2026 (contenu reconduit)',
  'https://dpfc-ci.net/dpfc/2026/progressions/MATHS%20-%20Progressions%20%202025-2026.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name = '5e'
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'Mathématiques'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

insert into curriculum_units (curriculum_id, title, ordering, recommended_hours)
select cur.id, v.title, v.ordering, v.hours
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'Mathématiques'
join education_levels el on el.id = cur.education_level_id and el.name = '5e'
cross join lateral (values
  ('Nombres premiers', 1, 11),
  ('Figures symétriques par rapport à une droite', 2, 13),
  ('Angles', 3, 7),
  ('Nombres décimaux relatifs', 4, 11),
  ('Segments', 5, 7),
  ('Fractions', 6, 9),
  ('Triangles', 7, 11),
  ('Cercles', 8, 5),
  ('Proportionnalité', 9, 7),
  ('Parallélogrammes particuliers', 10, 9),
  ('Statistique', 11, 5),
  ('Prismes droits', 12, 5)
) as v(title, ordering, hours)
where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and cur.subject_id = (select id from subjects where name = 'Mathématiques' limit 1)
  and cur.education_level_id = el.id;

insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select cu.curriculum_id, cu.id, v.week, cu.ordering
from curriculum_units cu
join curricula cur on cur.id = cu.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Mathématiques'
join education_levels el on el.id = cur.education_level_id and el.name = '5e'
join (values
  (1,1),(2,4),(3,7),(4,9),(5,12),(6,14),(7,17),(8,20),(9,21),(10,22),(11,26),(12,27)
) as v(ordering, week) on v.ordering = cu.ordering
where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and cur.education_level_id = el.id;

-- ============================================================================
-- 2. FRANÇAIS 5e (5 domaines menés en parallèle, comme la 6e)
-- Source : https://dpfc-ci.net/dpfc/2026/progressions/FRANCAIS_PROGRESSIONS_A%20USAGE%20PEDAGOGIQUE%20_2025-2026%201er%20Cycle%20DPFC.pdf
-- Pas d'official_progression_steps (voir note en tête de fichier).
-- ============================================================================

insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC 2025-2026 (contenu reconduit)',
  'https://dpfc-ci.net/dpfc/2026/progressions/FRANCAIS_PROGRESSIONS_A%20USAGE%20PEDAGOGIQUE%20_2025-2026%201er%20Cycle%20DPFC.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name = '5e'
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'Français'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

insert into curriculum_units (curriculum_id, title, ordering)
select cur.id, v.title, v.ordering
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'Français'
join education_levels el on el.id = cur.education_level_id and el.name = '5e'
cross join lateral (values
  ('Grammaire / Orthographe / Lexique', 1),
  ('Expression orale', 2),
  ('Étude d''œuvre intégrale', 3),
  ('Lecture méthodique / Exploitation de texte', 4),
  ('Expression écrite', 5)
) as v(title, ordering)
where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and cur.subject_id = (select id from subjects where name = 'Français' limit 1)
  and cur.education_level_id = el.id;

-- ============================================================================
-- 3. SVT 5e (structure par compétences/leçons, comme la source de la 6e)
-- Source : https://dpfc-ci.net/dpfc/2026/progressions/SVT%20PROGRESSIONS%20ANNUELLES%202025%202026%20.pdf
-- ============================================================================

insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC 2025-2026 (contenu reconduit)',
  'https://dpfc-ci.net/dpfc/2026/progressions/SVT%20PROGRESSIONS%20ANNUELLES%202025%202026%20.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name = '5e'
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'SVT'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

-- Compétences (unités parentes)
insert into curriculum_units (curriculum_id, title, ordering)
select cur.id, v.title, v.ordering
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'SVT'
join education_levels el on el.id = cur.education_level_id and el.name = '5e'
cross join lateral (values
  ('Compétence 1 : Reproduction chez les plantes sans fleurs et croissance chez les invertébrés', 1),
  ('Compétence 2 : Nutrition chez les plantes sans chlorophylle et chez les invertébrés', 2),
  ('Compétence 3 : Conséquences des actions néfastes de certains invertébrés et lutte contre ces invertébrés', 3)
) as v(title, ordering)
where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and cur.subject_id = (select id from subjects where name = 'SVT' limit 1)
  and cur.education_level_id = el.id;

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering, recommended_hours)
select p.curriculum_id, p.id, v.title, v.ordering, v.hours
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'SVT'
join education_levels el on el.id = cur.education_level_id and el.name = '5e'
cross join lateral (values
  ('Leçon 1 : La reproduction chez les champignons à chapeau', 1, 4),
  ('Leçon 2 : La croissance chez les insectes', 2, 4),
  ('Leçon 3 : La croissance chez les mollusques', 3, 3)
) as v(title, ordering, hours)
where p.title = 'Compétence 1 : Reproduction chez les plantes sans fleurs et croissance chez les invertébrés' and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and cur.education_level_id = el.id;

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering, recommended_hours)
select p.curriculum_id, p.id, v.title, v.ordering, v.hours
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'SVT'
join education_levels el on el.id = cur.education_level_id and el.name = '5e'
cross join lateral (values
  ('Leçon 1 : La nutrition des plantes sans chlorophylle', 1, 3),
  ('Leçon 2 : La nutrition des invertébrés', 2, 4)
) as v(title, ordering, hours)
where p.title = 'Compétence 2 : Nutrition chez les plantes sans chlorophylle et chez les invertébrés' and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and cur.education_level_id = el.id;

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering, recommended_hours)
select p.curriculum_id, p.id, v.title, v.ordering, v.hours
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'SVT'
join education_levels el on el.id = cur.education_level_id and el.name = '5e'
cross join lateral (values
  ('Leçon 1 : Les conséquences de la prolifération du criquet', 1, 2),
  ('Leçon 2 : Les conséquences de la prolifération du moustique', 2, 2),
  ('Leçon 3 : La lutte contre le criquet et le moustique', 3, 3)
) as v(title, ordering, hours)
where p.title = 'Compétence 3 : Conséquences des actions néfastes de certains invertébrés et lutte contre ces invertébrés' and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and cur.education_level_id = el.id;

insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select cu.curriculum_id, cu.id, v.week, v.ordering
from curriculum_units cu
join curricula cur on cur.id = cu.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'SVT'
join education_levels el on el.id = cur.education_level_id and el.name = '5e'
join (values
  ('Leçon 1 : La reproduction chez les champignons à chapeau', 1, 1),
  ('Leçon 2 : La croissance chez les insectes', 2, 4),
  ('Leçon 3 : La croissance chez les mollusques', 3, 8),
  ('Leçon 1 : La nutrition des plantes sans chlorophylle', 4, 14),
  ('Leçon 2 : La nutrition des invertébrés', 5, 17),
  ('Leçon 1 : Les conséquences de la prolifération du criquet', 6, 22),
  ('Leçon 2 : Les conséquences de la prolifération du moustique', 7, 24),
  ('Leçon 3 : La lutte contre le criquet et le moustique', 8, 26)
) as v(title, ordering, week) on v.title = cu.title
where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and cur.education_level_id = el.id and cu.parent_unit_id is not null;

-- ============================================================================
-- 4. PHYSIQUE-CHIMIE 5e (thèmes Physique/Chimie en unités parentes, comme HG)
-- Source : https://dpfc-ci.net/dpfc/2026/progressions/Physique-Chimie%20Progressions%202025-2026.pdf
-- (section "PROGRESSION DE PHYSIQUE-CHIMIE CINQUIÈME 2025-2026")
-- ============================================================================

insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC 2025-2026 (contenu reconduit)',
  'https://dpfc-ci.net/dpfc/2026/progressions/Physique-Chimie%20Progressions%202025-2026.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name = '5e'
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'Physique-Chimie'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

insert into curriculum_units (curriculum_id, title, ordering)
select cur.id, v.title, v.ordering
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'Physique-Chimie'
join education_levels el on el.id = cur.education_level_id and el.name = '5e'
cross join lateral (values
  ('Physique — Électricité', 1),
  ('Physique — Mesure de grandeurs physiques', 2),
  ('Chimie — Mélanges et réactions chimiques', 3),
  ('Physique — Propriétés physiques de la matière', 4)
) as v(title, ordering)
where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and cur.subject_id = (select id from subjects where name = 'Physique-Chimie' limit 1)
  and cur.education_level_id = el.id;

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Physique-Chimie'
join education_levels el on el.id = cur.education_level_id and el.name = '5e'
cross join lateral (values
  ('Adaptation d''un générateur à un récepteur', 1),
  ('Association de lampes électriques', 2),
  ('Association de piles en série', 3)
) as v(title, ordering)
where p.title = 'Physique — Électricité' and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and cur.education_level_id = el.id;

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Physique-Chimie'
join education_levels el on el.id = cur.education_level_id and el.name = '5e'
cross join lateral (values
  ('Intensité du courant électrique', 1),
  ('Tension électrique', 2),
  ('Pression atmosphérique', 3)
) as v(title, ordering)
where p.title = 'Physique — Mesure de grandeurs physiques' and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and cur.education_level_id = el.id;

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Physique-Chimie'
join education_levels el on el.id = cur.education_level_id and el.name = '5e'
cross join lateral (values
  ('Les mélanges', 1),
  ('Atomes et molécules', 2),
  ('Combustion du carbone', 3),
  ('Combustion du soufre', 4)
) as v(title, ordering)
where p.title = 'Chimie — Mélanges et réactions chimiques' and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and cur.education_level_id = el.id;

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Physique-Chimie'
join education_levels el on el.id = cur.education_level_id and el.name = '5e'
cross join lateral (values
  ('Dilatation des solides', 1),
  ('Dilatation des liquides', 2),
  ('Dilatation des gaz', 3)
) as v(title, ordering)
where p.title = 'Physique — Propriétés physiques de la matière' and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and cur.education_level_id = el.id;

insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select cu.curriculum_id, cu.id, v.week, v.ordering
from curriculum_units cu
join curricula cur on cur.id = cu.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Physique-Chimie'
join education_levels el on el.id = cur.education_level_id and el.name = '5e'
join (values
  ('Adaptation d''un générateur à un récepteur', 1, 1),
  ('Association de lampes électriques', 2, 3),
  ('Association de piles en série', 3, 5),
  ('Intensité du courant électrique', 4, 8),
  ('Tension électrique', 5, 10),
  ('Pression atmosphérique', 6, 12),
  ('Les mélanges', 7, 16),
  ('Atomes et molécules', 8, 18),
  ('Combustion du carbone', 9, 20),
  ('Combustion du soufre', 10, 22),
  ('Dilatation des solides', 11, 24),
  ('Dilatation des liquides', 12, 26),
  ('Dilatation des gaz', 13, 28)
) as v(title, ordering, week) on v.title = cu.title
where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and cur.education_level_id = el.id and cu.parent_unit_id is not null;

-- ============================================================================
-- 5. HISTOIRE-GÉOGRAPHIE 5e
-- Source : programme éducatif officiel DPFC de la 5e (Histoire et
-- Géographie), incluant sa propre "PROGRESSION ANNUELLE" -- voir note en
-- tête de fichier sur l'absence de progression 2025-2026 dédiée publiée.
-- https://dpfc-ci.net/wp-content/uploads/dpfc_fichiers/Programmes/prg_secondaire/Histoire_Geographie/HISTGEO_5eme.pdf
-- ============================================================================

insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC — programme éducatif officiel (contenu reconduit)',
  'https://dpfc-ci.net/wp-content/uploads/dpfc_fichiers/Programmes/prg_secondaire/Histoire_Geographie/HISTGEO_5eme.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name = '5e'
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'Histoire-Géographie'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

insert into curriculum_units (curriculum_id, title, ordering)
select cur.id, v.title, v.ordering
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'Histoire-Géographie'
join education_levels el on el.id = cur.education_level_id and el.name = '5e'
cross join lateral (values
  ('Histoire — Thème 1 : Évolution et traits de civilisation des peuples de ma région', 1),
  ('Histoire — Thème 2 : Le peuplement de la Côte d''Ivoire des origines à l''éclatement de l''empire du Mali', 2),
  ('Géographie — Thème 1 : L''Homme et son milieu en Côte d''Ivoire', 3),
  ('Géographie — Thème 2 : Les conséquences des activités économiques sur l''environnement', 4)
) as v(title, ordering)
where cur.version_label = 'DPFC — programme éducatif officiel (contenu reconduit)' and cur.subject_id = (select id from subjects where name = 'Histoire-Géographie' limit 1)
  and cur.education_level_id = el.id;

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering, recommended_hours)
select p.curriculum_id, p.id, v.title, v.ordering, v.hours
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Histoire-Géographie'
join education_levels el on el.id = cur.education_level_id and el.name = '5e'
cross join lateral (values
  ('Leçon 1 : L''origine et l''installation des peuples des régions de Côte d''Ivoire', 1, 3),
  ('Leçon 2 : Les traits de civilisation des peuples des différentes régions de Côte d''Ivoire', 2, 4),
  ('Leçon 3 : Les codes de réglementation des conflits dans les régions de Côte d''Ivoire et le droit international humanitaire', 3, 3)
) as v(title, ordering, hours)
where p.title = 'Histoire — Thème 1 : Évolution et traits de civilisation des peuples de ma région' and cur.version_label = 'DPFC — programme éducatif officiel (contenu reconduit)' and cur.education_level_id = el.id;

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering, recommended_hours)
select p.curriculum_id, p.id, v.title, v.ordering, v.hours
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Histoire-Géographie'
join education_levels el on el.id = cur.education_level_id and el.name = '5e'
cross join lateral (values
  ('Leçon 1 : Les premiers habitants de la Côte d''Ivoire', 1, 3),
  ('Leçon 2 : Les premiers mouvements migratoires en Côte d''Ivoire', 2, 2),
  ('Leçon 3 : Les grands empires de l''Afrique de l''Ouest : exemple du Mali', 3, 2)
) as v(title, ordering, hours)
where p.title = 'Histoire — Thème 2 : Le peuplement de la Côte d''Ivoire des origines à l''éclatement de l''empire du Mali' and cur.version_label = 'DPFC — programme éducatif officiel (contenu reconduit)' and cur.education_level_id = el.id;

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering, recommended_hours)
select p.curriculum_id, p.id, v.title, v.ordering, v.hours
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Histoire-Géographie'
join education_levels el on el.id = cur.education_level_id and el.name = '5e'
cross join lateral (values
  ('Leçon 1 : Le milieu physique en Côte d''Ivoire et l''installation des populations', 1, 3),
  ('Leçon 2 : La croissance démographique en Côte d''Ivoire', 2, 4),
  ('Leçon 3 : L''eau dans le développement de la Côte d''Ivoire', 3, 3)
) as v(title, ordering, hours)
where p.title = 'Géographie — Thème 1 : L''Homme et son milieu en Côte d''Ivoire' and cur.version_label = 'DPFC — programme éducatif officiel (contenu reconduit)' and cur.education_level_id = el.id;

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering, recommended_hours)
select p.curriculum_id, p.id, v.title, v.ordering, v.hours
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Histoire-Géographie'
join education_levels el on el.id = cur.education_level_id and el.name = '5e'
cross join lateral (values
  ('Leçon 1 : Les conséquences des méthodes et techniques agricoles sur l''environnement', 1, 3),
  ('Leçon 2 : Les effets de la pollution industrielle et commerciale sur l''environnement', 2, 2),
  ('Leçon 3 : L''impôt et l''aménagement du territoire ivoirien', 3, 2)
) as v(title, ordering, hours)
where p.title = 'Géographie — Thème 2 : Les conséquences des activités économiques sur l''environnement' and cur.version_label = 'DPFC — programme éducatif officiel (contenu reconduit)' and cur.education_level_id = el.id;

insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select cu.curriculum_id, cu.id, v.week, v.ordering
from curriculum_units cu
join curricula cur on cur.id = cu.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Histoire-Géographie'
join education_levels el on el.id = cur.education_level_id and el.name = '5e'
join (values
  ('Leçon 1 : L''origine et l''installation des peuples des régions de Côte d''Ivoire', 1, 1),
  ('Leçon 2 : Les traits de civilisation des peuples des différentes régions de Côte d''Ivoire', 2, 6),
  ('Leçon 3 : Les codes de réglementation des conflits dans les régions de Côte d''Ivoire et le droit international humanitaire', 3, 11),
  ('Leçon 1 : Les premiers habitants de la Côte d''Ivoire', 4, 16),
  ('Leçon 2 : Les premiers mouvements migratoires en Côte d''Ivoire', 5, 21),
  ('Leçon 3 : Les grands empires de l''Afrique de l''Ouest : exemple du Mali', 6, 24),
  ('Leçon 1 : Le milieu physique en Côte d''Ivoire et l''installation des populations', 7, 1),
  ('Leçon 2 : La croissance démographique en Côte d''Ivoire', 8, 6),
  ('Leçon 3 : L''eau dans le développement de la Côte d''Ivoire', 9, 11),
  ('Leçon 1 : Les conséquences des méthodes et techniques agricoles sur l''environnement', 10, 16),
  ('Leçon 2 : Les effets de la pollution industrielle et commerciale sur l''environnement', 11, 20),
  ('Leçon 3 : L''impôt et l''aménagement du territoire ivoirien', 12, 24)
) as v(title, ordering, week) on v.title = cu.title and v.ordering = (
    case
      when cu.parent_unit_id = (select id from curriculum_units where title = 'Histoire — Thème 1 : Évolution et traits de civilisation des peuples de ma région' and curriculum_id = cu.curriculum_id) then cu.ordering
      when cu.parent_unit_id = (select id from curriculum_units where title = 'Histoire — Thème 2 : Le peuplement de la Côte d''Ivoire des origines à l''éclatement de l''empire du Mali' and curriculum_id = cu.curriculum_id) then cu.ordering + 3
      when cu.parent_unit_id = (select id from curriculum_units where title = 'Géographie — Thème 1 : L''Homme et son milieu en Côte d''Ivoire' and curriculum_id = cu.curriculum_id) then cu.ordering + 6
      when cu.parent_unit_id = (select id from curriculum_units where title = 'Géographie — Thème 2 : Les conséquences des activités économiques sur l''environnement' and curriculum_id = cu.curriculum_id) then cu.ordering + 9
    end
  )
where cur.version_label = 'DPFC — programme éducatif officiel (contenu reconduit)' and cur.education_level_id = el.id and cu.parent_unit_id is not null;

-- ============================================================================
-- 6. ANGLAIS 5e
-- Source : https://dpfc-ci.net/dpfc/2026/progressions/Anglais%20Progression%205%C3%A8me%202025-2026.pdf
-- Volume horaire annuel officiel : 90h
-- ============================================================================

insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC 2025-2026 (contenu reconduit)',
  'https://dpfc-ci.net/dpfc/2026/progressions/Anglais%20Progression%205%C3%A8me%202025-2026.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name = '5e'
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'Anglais'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

insert into curriculum_units (curriculum_id, title, ordering, recommended_hours)
select cur.id, v.title, v.ordering, v.hours
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'Anglais'
join education_levels el on el.id = cur.education_level_id and el.name = '5e'
cross join lateral (values
  ('At school (Discover my school, Life at collège Kassere, What do you learn at school?)', 1, 11),
  ('At home (My family tree, A Sunday with my family, The Tchonron soup)', 2, 11),
  ('Time and date (Weather in December, Time is money, Adon''s schedule)', 3, 11),
  ('Jobs and occupations (Mother''s job, What do you use a map for?, Where does Aunt Enoh work?)', 4, 12),
  ('Clothes and colours (At the market place, My favourite clothes, Can I help you?)', 5, 11),
  ('Food and drinks (What''s on the menu today?, Keep fit with your diet, What''s your favorite meal?)', 6, 11),
  ('Health and environment (I take care of my body, Keep your environment safe, Health and water)', 7, 11),
  ('Sports and games (Basketball, A football star, Be an active learner!)', 8, 12)
) as v(title, ordering, hours)
where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and cur.subject_id = (select id from subjects where name = 'Anglais' limit 1)
  and cur.education_level_id = el.id;

insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select cu.curriculum_id, cu.id, v.week, cu.ordering
from curriculum_units cu
join curricula cur on cur.id = cu.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Anglais'
join education_levels el on el.id = cur.education_level_id and el.name = '5e'
join (values
  (1,1),(2,5),(3,9),(4,12),(5,16),(6,20),(7,23),(8,27)
) as v(ordering, week) on v.ordering = cu.ordering
where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and cur.education_level_id = el.id and cu.parent_unit_id is null;

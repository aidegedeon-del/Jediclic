-- ============================================================================
-- 0015_referentiel_3e_dpfc.sql
-- Quatrième enrichissement réel du référentiel (Convention §8/§19), niveau 3e
-- (collège), les 6 matières déjà seedées en 0007. Suite de 0012 (6e), 0013
-- (5e) et 0014 (4e), à la demande explicite de l'utilisateur ("Référentiel
-- DPFC : 3e").
--
-- SOURCES OFFICIELLES DPFC consultées le 15 août 2026 (chaque
-- `curricula.source_document_url` pointe vers le PDF exact utilisé) :
--   - Mathématiques : même document combiné 6e->Tle que 0012/0013/0014
--     (MATHS - Progressions 2025-2026.pdf, section "PROGRESSION 3e").
--   - SVT : SVT PROGRESSIONS ANNUELLES 2025-2026.pdf, section "Niveau : 3e".
--   - Physique-Chimie : Physique-Chimie Progressions 2025-2026.pdf,
--     section "PROGRESSION DE PHYSIQUE-CHIMIE TROISIÈME 2025-2026".
--   - Anglais : Anglais Progression 3ème 2025-2026.pdf (fichier dédié au
--     niveau, comme 6e/5e/4e).
--   - Français : FRANCAIS_PROGRESSIONS_A USAGE PEDAGOGIQUE 2025-2026 1er
--     Cycle DPFC.pdf, section "PROGRESSION ANNUELLE DE LA CLASSE DE
--     TROISIÈME" (même document que 6e/5e/4e).
--   - Histoire-Géographie : À LA DIFFÉRENCE de la 5e et de la 4e (qui n'ont
--     pas de guide dédié et réutilisent un document 4e/3e commun), la 3e
--     dispose de son propre programme éducatif DPFC "Histoire-Géographie
--     3ème" (HISTGEO_3eme.pdf), avec sa propre section "PROGRESSION
--     ANNUELLE" pour Histoire et pour Géographie séparément -- utilisé
--     directement, non daté par année scolaire pour la même raison que les
--     niveaux précédents (guide non republié chaque année, mais jamais
--     retiré ni remplacé).
--
-- Comme pour 0012/0013/0014 : contenu rattaché à l'année scolaire COURANTE
-- (2026-2027, déjà seedée en 0007), via `expected_week` uniquement (numéro
-- de semaine 1 à 30/32 tel que publié) -- jamais de date calendaire
-- inventée. Rien n'est inventé : tout intitulé de leçon/thème et tout
-- volume horaire est recopié tel quel des documents cités.
--
-- Même simplification qu'en 0013/0014 pour le Français : seuls les 5
-- domaines parents sont créés (Grammaire/Orthographe, Expression orale,
-- Étude d'œuvre intégrale, Lecture méthodique/Exploitation de texte,
-- Expression écrite), sans séquences filles ni official_progression_steps
-- -- les domaines avancent en parallèle chaque semaine.
--
-- Cas particulier SVT 3e (comme la SVT 4e en 0014) : le document officiel
-- numérote les compétences dans l'ordre C2, C1, C3, C4 (pas C1,C2,C3,C4) --
-- numérotation recopiée telle quelle (Convention §19), l'ordonnancement
-- `ordering` suit l'ordre de déroulement réel dans l'année (donc C2, C1,
-- C3, C4).
--
-- Cas particulier Physique-Chimie 3e : contrairement aux niveaux
-- précédents où chaque thème (Optique, Électricité, etc.) se déroule sur
-- une plage continue, le thème "Les réactions chimiques" (Chimie) est
-- interrompu par le thème "Optique" (Physique) puis reprend plus loin dans
-- l'année (Convention §19 : recopié tel quel, jamais réorganisé pour
-- paraître continu) -- modélisé comme une seule unité parente "Chimie —
-- Les réactions chimiques" regroupant ses 5 leçons, avec les dates réelles
-- (non contiguës) portées par `official_progression_steps` au niveau de
-- chaque leçon, l'ordering de l'unité parente reflétant sa première
-- apparition dans le document.
--
-- Cas particulier Histoire 3e, Leçon 3 : le document propose une "leçon
-- alternante" (deux variantes au choix du professeur, non cumulatives : la
-- guerre du Biafra OU la guerre du Rwanda) -- recopiée telle quelle sous un
-- seul intitulé mentionnant les deux options (Convention §19 : ne jamais
-- trancher à la place du professeur un choix que le document laisse
-- ouvert).
--
-- Non couvert dans ce lot : 2nde/1ère/Terminale et les matières
-- secondaires, à sourcer un par un (jamais improvisé).
-- ============================================================================

-- ============================================================================
-- 1. MATHÉMATIQUES 3e
-- Source : https://dpfc-ci.net/dpfc/2026/progressions/MATHS%20-%20Progressions%20%202025-2026.pdf
-- Volume horaire annuel officiel : 120h (4h/semaine)
-- ============================================================================

insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC 2025-2026 (contenu reconduit)',
  'https://dpfc-ci.net/dpfc/2026/progressions/MATHS%20-%20Progressions%20%202025-2026.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name = '3e'
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'Mathématiques'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

insert into curriculum_units (curriculum_id, title, ordering, recommended_hours)
select cur.id, v.title, v.ordering, v.hours
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'Mathématiques'
join education_levels el on el.id = cur.education_level_id and el.name = '3e'
cross join lateral (values
  ('Calcul littéral', 1, 7),
  ('Propriétés de Thalès dans un triangle', 2, 7),
  ('Racines carrées', 3, 7),
  ('Triangle rectangle', 4, 11),
  ('Calcul numérique', 5, 9),
  ('Angles inscrits', 6, 5),
  ('Vecteurs', 7, 7),
  ('Équations et inéquations dans ℝ', 8, 5),
  ('Coordonnées de vecteurs', 9, 7),
  ('Équations de droites', 10, 7),
  ('Statistique', 11, 7),
  ('Équations et inéquations dans ℝ × ℝ', 12, 7),
  ('Applications affines', 13, 5),
  ('Pyramides et cônes', 14, 7)
) as v(title, ordering, hours)
where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and cur.subject_id = (select id from subjects where name = 'Mathématiques' limit 1)
  and cur.education_level_id = el.id;

insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select cu.curriculum_id, cu.id, v.week, cu.ordering
from curriculum_units cu
join curricula cur on cur.id = cu.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Mathématiques'
join education_levels el on el.id = cur.education_level_id and el.name = '3e'
join (values
  (1,1),(2,3),(3,5),(4,7),(5,10),(6,12),(7,14),(8,16),(9,17),(10,19),(11,21),(12,23),(13,25),(14,27)
) as v(ordering, week) on v.ordering = cu.ordering
where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and cur.education_level_id = el.id;

-- ============================================================================
-- 2. FRANÇAIS 3e (5 domaines menés en parallèle, comme 6e/5e/4e)
-- Source : https://dpfc-ci.net/dpfc/2026/progressions/FRANCAIS_PROGRESSIONS_A%20USAGE%20PEDAGOGIQUE%20_2025-2026%201er%20Cycle%20DPFC.pdf
-- Pas d'official_progression_steps (voir note en tête de fichier).
-- ============================================================================

insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC 2025-2026 (contenu reconduit)',
  'https://dpfc-ci.net/dpfc/2026/progressions/FRANCAIS_PROGRESSIONS_A%20USAGE%20PEDAGOGIQUE%20_2025-2026%201er%20Cycle%20DPFC.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name = '3e'
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'Français'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

insert into curriculum_units (curriculum_id, title, ordering)
select cur.id, v.title, v.ordering
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'Français'
join education_levels el on el.id = cur.education_level_id and el.name = '3e'
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
-- 3. SVT 3e (structure par compétences/leçons, comme 6e/5e/4e)
-- Source : https://dpfc-ci.net/dpfc/2026/progressions/SVT%20PROGRESSIONS%20ANNUELLES%202025%202026%20.pdf
-- Numérotation officielle des compétences non séquentielle : C2, C1, C3, C4
-- (recopiée telle quelle, voir note en tête de fichier).
-- ============================================================================

insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC 2025-2026 (contenu reconduit)',
  'https://dpfc-ci.net/dpfc/2026/progressions/SVT%20PROGRESSIONS%20ANNUELLES%202025%202026%20.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name = '3e'
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'SVT'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

insert into curriculum_units (curriculum_id, title, ordering)
select cur.id, v.title, v.ordering
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'SVT'
join education_levels el on el.id = cur.education_level_id and el.name = '3e'
cross join lateral (values
  ('Compétence 2 — La reproduction humaine et l''infection au VIH', 1),
  ('Compétence 1 — La nutrition chez l''Homme', 2),
  ('Compétence 3 — Les relations sols-plantes', 3),
  ('Compétence 4 — La dégradation, la protection et l''amélioration des sols', 4)
) as v(title, ordering)
where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and cur.subject_id = (select id from subjects where name = 'SVT' limit 1)
  and cur.education_level_id = el.id;

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'SVT'
join education_levels el on el.id = cur.education_level_id and el.name = '3e'
cross join lateral (values
  ('Leçon 1 : Les grossesses précoces et les moyens de prévention', 1),
  ('Leçon 2 : L''infection au VIH', 2)
) as v(title, ordering)
where p.title = 'Compétence 2 — La reproduction humaine et l''infection au VIH' and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and cur.education_level_id = el.id;

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'SVT'
join education_levels el on el.id = cur.education_level_id and el.name = '3e'
cross join lateral (values
  ('Leçon 1 : Les aliments et l''Homme', 1),
  ('Leçon 2 : La digestion des aliments', 2),
  ('Leçon 3 : Le sang', 3),
  ('Leçon 4 : La transfusion sanguine', 4),
  ('Leçon 5 : La circulation sanguine', 5)
) as v(title, ordering)
where p.title = 'Compétence 1 — La nutrition chez l''Homme' and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and cur.education_level_id = el.id;

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'SVT'
join education_levels el on el.id = cur.education_level_id and el.name = '3e'
cross join lateral (values
  ('Leçon 1 : Les caractéristiques d''un sol', 1),
  ('Leçon 2 : Les relations sols-plantes', 2)
) as v(title, ordering)
where p.title = 'Compétence 3 — Les relations sols-plantes' and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and cur.education_level_id = el.id;

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'SVT'
join education_levels el on el.id = cur.education_level_id and el.name = '3e'
cross join lateral (values
  ('Leçon 1 : La dégradation des sols', 1),
  ('Leçon 2 : La protection et l''amélioration des sols', 2)
) as v(title, ordering)
where p.title = 'Compétence 4 — La dégradation, la protection et l''amélioration des sols' and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and cur.education_level_id = el.id;

insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select cu.curriculum_id, cu.id, v.week, v.ordering
from curriculum_units cu
join curricula cur on cur.id = cu.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'SVT'
join education_levels el on el.id = cur.education_level_id and el.name = '3e'
join (values
  ('Leçon 1 : Les grossesses précoces et les moyens de prévention', 1, 1),
  ('Leçon 2 : L''infection au VIH', 2, 3),
  ('Leçon 1 : Les aliments et l''Homme', 3, 7),
  ('Leçon 2 : La digestion des aliments', 4, 10),
  ('Leçon 3 : Le sang', 5, 12),
  ('Leçon 4 : La transfusion sanguine', 6, 15),
  ('Leçon 5 : La circulation sanguine', 7, 16),
  ('Leçon 1 : Les caractéristiques d''un sol', 8, 20),
  ('Leçon 2 : Les relations sols-plantes', 9, 22),
  ('Leçon 1 : La dégradation des sols', 10, 25),
  ('Leçon 2 : La protection et l''amélioration des sols', 11, 27)
) as v(title, ordering, week) on v.title = cu.title and v.ordering = (
    case
      when cu.parent_unit_id = (select id from curriculum_units where title = 'Compétence 2 — La reproduction humaine et l''infection au VIH' and curriculum_id = cu.curriculum_id) then cu.ordering
      when cu.parent_unit_id = (select id from curriculum_units where title = 'Compétence 1 — La nutrition chez l''Homme' and curriculum_id = cu.curriculum_id) then cu.ordering + 2
      when cu.parent_unit_id = (select id from curriculum_units where title = 'Compétence 3 — Les relations sols-plantes' and curriculum_id = cu.curriculum_id) then cu.ordering + 7
      when cu.parent_unit_id = (select id from curriculum_units where title = 'Compétence 4 — La dégradation, la protection et l''amélioration des sols' and curriculum_id = cu.curriculum_id) then cu.ordering + 9
    end
  )
where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and cur.education_level_id = el.id and cu.parent_unit_id is not null;

-- ============================================================================
-- 4. PHYSIQUE-CHIMIE 3e (thèmes en unités parentes, comme 6e/5e/4e)
-- Source : https://dpfc-ci.net/dpfc/2026/progressions/Physique-Chimie%20Progressions%202025-2026.pdf
-- (section "PROGRESSION DE PHYSIQUE-CHIMIE TROISIÈME 2025-2026")
-- Cas particulier "Les réactions chimiques" : thème non contigu, voir note
-- en tête de fichier.
-- ============================================================================

insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC 2025-2026 (contenu reconduit)',
  'https://dpfc-ci.net/dpfc/2026/progressions/Physique-Chimie%20Progressions%202025-2026.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name = '3e'
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'Physique-Chimie'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

insert into curriculum_units (curriculum_id, title, ordering)
select cur.id, v.title, v.ordering
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'Physique-Chimie'
join education_levels el on el.id = cur.education_level_id and el.name = '3e'
cross join lateral (values
  ('Physique — Mécanique', 1),
  ('Chimie — Les réactions chimiques', 2),
  ('Physique — Optique', 3),
  ('Physique — Électricité', 4)
) as v(title, ordering)
where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and cur.subject_id = (select id from subjects where name = 'Physique-Chimie' limit 1)
  and cur.education_level_id = el.id;

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Physique-Chimie'
join education_levels el on el.id = cur.education_level_id and el.name = '3e'
cross join lateral (values
  ('Masse et poids d''un corps', 1),
  ('Les forces', 2),
  ('Équilibre d''un solide soumis à deux forces', 3),
  ('Travail et puissance mécaniques', 4),
  ('Énergie mécanique', 5)
) as v(title, ordering)
where p.title = 'Physique — Mécanique' and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and cur.education_level_id = el.id;

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Physique-Chimie'
join education_levels el on el.id = cur.education_level_id and el.name = '3e'
cross join lateral (values
  ('Électrolyse et synthèse de l''eau', 1),
  ('Les alcanes', 2),
  ('Oxydation des corps purs simples', 3),
  ('Réduction des oxydes / Oxydation des corps purs simples (suite et fin)', 4),
  ('Solutions acides, basiques et neutres', 5)
) as v(title, ordering)
where p.title = 'Chimie — Les réactions chimiques' and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and cur.education_level_id = el.id;

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Physique-Chimie'
join education_levels el on el.id = cur.education_level_id and el.name = '3e'
cross join lateral (values
  ('Les lentilles', 1),
  ('Les défauts de l''œil et leurs corrections', 2)
) as v(title, ordering)
where p.title = 'Physique — Optique' and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and cur.education_level_id = el.id;

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Physique-Chimie'
join education_levels el on el.id = cur.education_level_id and el.name = '3e'
cross join lateral (values
  ('Puissance et énergie électriques', 1),
  ('Le conducteur ohmique', 2)
) as v(title, ordering)
where p.title = 'Physique — Électricité' and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and cur.education_level_id = el.id;

insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select cu.curriculum_id, cu.id, v.week, v.ordering
from curriculum_units cu
join curricula cur on cur.id = cu.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Physique-Chimie'
join education_levels el on el.id = cur.education_level_id and el.name = '3e'
join (values
  ('Masse et poids d''un corps', 1, 1),
  ('Les forces', 2, 2),
  ('Équilibre d''un solide soumis à deux forces', 3, 4),
  ('Travail et puissance mécaniques', 4, 5),
  ('Énergie mécanique', 5, 7),
  ('Électrolyse et synthèse de l''eau', 6, 9),
  ('Les alcanes', 7, 11),
  ('Les lentilles', 8, 15),
  ('Les défauts de l''œil et leurs corrections', 9, 17),
  ('Oxydation des corps purs simples', 10, 19),
  ('Réduction des oxydes / Oxydation des corps purs simples (suite et fin)', 11, 21),
  ('Solutions acides, basiques et neutres', 12, 23),
  ('Puissance et énergie électriques', 13, 26),
  ('Le conducteur ohmique', 14, 28)
) as v(title, ordering, week) on v.title = cu.title
where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and cur.education_level_id = el.id and cu.parent_unit_id is not null;

-- ============================================================================
-- 5. HISTOIRE-GÉOGRAPHIE 3e
-- Source : programme éducatif officiel DPFC "Histoire-Géographie 3ème",
-- document propre à ce niveau (contrairement à la 4e/5e qui partagent un
-- guide commun) -- voir note en tête de fichier.
-- https://dpfc-ci.net/wp-content/uploads/dpfc_fichiers/Programmes/prg_secondaire/Histoire_Geographie/HISTGEO_3eme.pdf
-- ============================================================================

insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC — programme éducatif officiel (contenu reconduit)',
  'https://dpfc-ci.net/wp-content/uploads/dpfc_fichiers/Programmes/prg_secondaire/Histoire_Geographie/HISTGEO_3eme.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name = '3e'
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'Histoire-Géographie'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

insert into curriculum_units (curriculum_id, title, ordering)
select cur.id, v.title, v.ordering
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'Histoire-Géographie'
join education_levels el on el.id = cur.education_level_id and el.name = '3e'
cross join lateral (values
  ('Histoire — Thème 1 : L''évolution sociopolitique de la Côte d''Ivoire et de l''Afrique du XIXe siècle à nos jours', 1),
  ('Histoire — Thème 2 : De la Seconde Guerre mondiale aux efforts de construction du monde et de l''Afrique', 2),
  ('Géographie — Thème 1 : Étude économique de la Côte d''Ivoire', 3),
  ('Géographie — Thème 2 : L''Afrique face à la mondialisation', 4)
) as v(title, ordering)
where cur.version_label = 'DPFC — programme éducatif officiel (contenu reconduit)' and cur.subject_id = (select id from subjects where name = 'Histoire-Géographie' limit 1)
  and cur.education_level_id = el.id;

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering, recommended_hours)
select p.curriculum_id, p.id, v.title, v.ordering, v.hours
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Histoire-Géographie'
join education_levels el on el.id = cur.education_level_id and el.name = '3e'
cross join lateral (values
  ('Leçon 1 : Le mouvement impérialiste et la colonisation en Côte d''Ivoire', 1, 4),
  ('Leçon 2 : L''accession de la Côte d''Ivoire à l''indépendance', 2, 4),
  ('Leçon 3 (alternante) : Les crises sociopolitiques de l''Afrique indépendante — la guerre du Biafra ou la guerre du Rwanda', 3, 3)
) as v(title, ordering, hours)
where p.title = 'Histoire — Thème 1 : L''évolution sociopolitique de la Côte d''Ivoire et de l''Afrique du XIXe siècle à nos jours' and cur.version_label = 'DPFC — programme éducatif officiel (contenu reconduit)' and cur.education_level_id = el.id;

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering, recommended_hours)
select p.curriculum_id, p.id, v.title, v.ordering, v.hours
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Histoire-Géographie'
join education_levels el on el.id = cur.education_level_id and el.name = '3e'
cross join lateral (values
  ('Leçon 1 : Les causes, caractères et conséquences de la Deuxième Guerre mondiale', 1, 4),
  ('Leçon 2 : L''Organisation des Nations Unies (ONU)', 2, 3),
  ('Leçon 3 : L''Union Africaine (UA)', 3, 3)
) as v(title, ordering, hours)
where p.title = 'Histoire — Thème 2 : De la Seconde Guerre mondiale aux efforts de construction du monde et de l''Afrique' and cur.version_label = 'DPFC — programme éducatif officiel (contenu reconduit)' and cur.education_level_id = el.id;

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering, recommended_hours)
select p.curriculum_id, p.id, v.title, v.ordering, v.hours
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Histoire-Géographie'
join education_levels el on el.id = cur.education_level_id and el.name = '3e'
cross join lateral (values
  ('Leçon 1 : Les atouts naturels et humains du développement économique de la Côte d''Ivoire', 1, 3),
  ('Leçon 2 : Les secteurs d''activités économiques de la Côte d''Ivoire', 2, 5),
  ('Leçon 3 : Les problèmes du développement économique de la Côte d''Ivoire', 3, 4)
) as v(title, ordering, hours)
where p.title = 'Géographie — Thème 1 : Étude économique de la Côte d''Ivoire' and cur.version_label = 'DPFC — programme éducatif officiel (contenu reconduit)' and cur.education_level_id = el.id;

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering, recommended_hours)
select p.curriculum_id, p.id, v.title, v.ordering, v.hours
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Histoire-Géographie'
join education_levels el on el.id = cur.education_level_id and el.name = '3e'
cross join lateral (values
  ('Leçon 1 : Étude économique de l''Afrique', 1, 4),
  ('Leçon 2 : La place de l''Afrique dans la mondialisation', 2, 4)
) as v(title, ordering, hours)
where p.title = 'Géographie — Thème 2 : L''Afrique face à la mondialisation' and cur.version_label = 'DPFC — programme éducatif officiel (contenu reconduit)' and cur.education_level_id = el.id;

insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select cu.curriculum_id, cu.id, v.week, v.ordering
from curriculum_units cu
join curricula cur on cur.id = cu.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Histoire-Géographie'
join education_levels el on el.id = cur.education_level_id and el.name = '3e'
join (values
  ('Leçon 1 : Le mouvement impérialiste et la colonisation en Côte d''Ivoire', 1, 1),
  ('Leçon 2 : L''accession de la Côte d''Ivoire à l''indépendance', 2, 3),
  ('Leçon 3 (alternante) : Les crises sociopolitiques de l''Afrique indépendante — la guerre du Biafra ou la guerre du Rwanda', 3, 12),
  ('Leçon 1 : Les causes, caractères et conséquences de la Deuxième Guerre mondiale', 4, 15),
  ('Leçon 2 : L''Organisation des Nations Unies (ONU)', 5, 22),
  ('Leçon 3 : L''Union Africaine (UA)', 6, 24),
  ('Leçon 1 : Les atouts naturels et humains du développement économique de la Côte d''Ivoire', 7, 1),
  ('Leçon 2 : Les secteurs d''activités économiques de la Côte d''Ivoire', 8, 3),
  ('Leçon 3 : Les problèmes du développement économique de la Côte d''Ivoire', 9, 12),
  ('Leçon 1 : Étude économique de l''Afrique', 10, 14),
  ('Leçon 2 : La place de l''Afrique dans la mondialisation', 11, 22)
) as v(title, ordering, week) on v.title = cu.title and v.ordering = (
    case
      when cu.parent_unit_id = (select id from curriculum_units where title = 'Histoire — Thème 1 : L''évolution sociopolitique de la Côte d''Ivoire et de l''Afrique du XIXe siècle à nos jours' and curriculum_id = cu.curriculum_id) then cu.ordering
      when cu.parent_unit_id = (select id from curriculum_units where title = 'Histoire — Thème 2 : De la Seconde Guerre mondiale aux efforts de construction du monde et de l''Afrique' and curriculum_id = cu.curriculum_id) then cu.ordering + 3
      when cu.parent_unit_id = (select id from curriculum_units where title = 'Géographie — Thème 1 : Étude économique de la Côte d''Ivoire' and curriculum_id = cu.curriculum_id) then cu.ordering + 6
      when cu.parent_unit_id = (select id from curriculum_units where title = 'Géographie — Thème 2 : L''Afrique face à la mondialisation' and curriculum_id = cu.curriculum_id) then cu.ordering + 9
    end
  )
where cur.version_label = 'DPFC — programme éducatif officiel (contenu reconduit)' and cur.education_level_id = el.id and cu.parent_unit_id is not null;

-- ============================================================================
-- 6. ANGLAIS 3e
-- Source : https://dpfc-ci.net/dpfc/2026/progressions/Anglais%20Progression%203%C3%A8me%202025-2026.pdf
-- Volume horaire annuel officiel : 90h
-- ============================================================================

insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC 2025-2026 (contenu reconduit)',
  'https://dpfc-ci.net/dpfc/2026/progressions/Anglais%20Progression%203%C3%A8me%202025-2026.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name = '3e'
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'Anglais'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

insert into curriculum_units (curriculum_id, title, ordering, recommended_hours)
select cur.id, v.title, v.ordering, v.hours
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'Anglais'
join education_levels el on el.id = cur.education_level_id and el.name = '3e'
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
join education_levels el on el.id = cur.education_level_id and el.name = '3e'
join (values
  (1,1),(2,4),(3,8),(4,12),(5,16),(6,19),(7,23),(8,27)
) as v(ordering, week) on v.ordering = cu.ordering
where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and cur.education_level_id = el.id and cu.parent_unit_id is null;

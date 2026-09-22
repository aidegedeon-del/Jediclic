-- ============================================================================
-- 0012_referentiel_6e_dpfc.sql
-- Premier enrichissement réel du référentiel (Convention §8/§19) : contenu
-- officiel du niveau 6e (collège), les 6 matières déjà seedées en 0007.
--
-- SOURCE : progressions annuelles officielles DPFC 2025-2026 (Ministère de
-- l'Éducation Nationale et de l'Alphabétisation, Côte d'Ivoire),
-- https://dpfc-ci.net/?page_id=5267 — consultées le 15 août 2026.
-- Chaque `curricula.source_document_url` pointe vers le PDF officiel exact
-- utilisé. Aucun intitulé de leçon, volume horaire ou découpage n'est
-- inventé : tout est recopié de ces documents.
--
-- Ces progressions sont republiées chaque année scolaire avec un contenu
-- reconduit à l'identique (seul le calendrier change) : la DPFC publie déjà
-- 3 années successives (2023-2024, 2024-2025, 2025-2026) avec la même liste
-- de chapitres/heures pour les mathématiques par ex. Ce lot rattache donc ce
-- contenu à l'année scolaire COURANTE de l'app (2026-2027, déjà seedée en
-- 0007), en ne renseignant que `expected_week` (numéro de semaine 1 à 30,
-- tel que publié) — jamais de date calendaire inventée. La dérivation
-- semaine -> date réelle réutilise le mécanisme déjà existant
-- (src/lib/progress/drift.ts, fallback expected_week x school_years.starts_on),
-- introduit pour EF-PROG-03, plutôt que d'inventer ici un mapping calendaire.
--
-- Pour la 6e uniquement, la DPFC distingue par endroits un "nouveau
-- programme" (en expérimentation dans certains établissements pilotes) et le
-- programme standard actuellement généralisé. Sauf pour Histoire-Géographie
-- (seule version disponible : le nouveau programme), ce lot utilise le
-- programme STANDARD, pas la version expérimentale, car c'est celui en
-- vigueur dans l'immense majorité des établissements. À réévaluer si la
-- généralisation du nouveau programme est confirmée par la DPFC.
--
-- Non couvert dans ce lot (Convention §19 : à sourcer un par un plus tard,
-- pas improvisé) : 5e/4e/3e/2nde/1ère/Tle, et les compétences /
-- official_progression_steps fines pour Français/HG/Anglais (structurés en
-- domaines/thèmes plutôt qu'en simple liste de chapitres — voir plus bas).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Repères communs
-- ----------------------------------------------------------------------------
-- education_level "6e" (Collège) et school_year "2026-2027" existent déjà
-- (migration 0007). On les retrouve par jointure dans chaque bloc ci-dessous
-- plutôt que de les re-déclarer.

-- ============================================================================
-- 1. MATHÉMATIQUES 6e
-- Source : https://dpfc-ci.net/dpfc/2026/progressions/MATHS%20-%20Progressions%20%202025-2026.pdf
-- Volume horaire annuel officiel : 120h (4h/semaine)
-- ============================================================================

insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC 2025-2026 (contenu reconduit)',
  'https://dpfc-ci.net/dpfc/2026/progressions/MATHS%20-%20Progressions%20%202025-2026.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name = '6e'
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'Mathématiques'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

insert into curriculum_units (curriculum_id, title, ordering, recommended_hours)
select cur.id, v.title, v.ordering, v.hours
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'Mathématiques'
join education_levels el on el.id = cur.education_level_id and el.name = '6e'
cross join lateral (values
  ('Nombres entiers naturels', 1, 7),
  ('Droites et points', 2, 9),
  ('Nombres décimaux relatifs', 3, 13),
  ('Segments', 4, 5),
  ('Cercles et disques', 5, 7),
  ('Fractions', 6, 7),
  ('Angles', 7, 7),
  ('Triangles', 8, 7),
  ('Proportionnalité', 9, 5),
  ('Figures symétriques par rapport à un point', 10, 11),
  ('Parallélogramme', 11, 11),
  ('Statistique', 12, 5),
  ('Pavés droits et cylindres droits', 13, 5)
) as v(title, ordering, hours)
where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)';

insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select cu.curriculum_id, cu.id, v.week, cu.ordering
from curriculum_units cu
join curricula cur on cur.id = cu.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Mathématiques'
join education_levels el on el.id = cur.education_level_id and el.name = '6e'
join (values
  (1,1),(2,3),(3,5),(4,9),(5,10),(6,12),(7,14),(8,16),(9,18),(10,20),(11,22),(12,26),(13,27)
) as v(ordering, week) on v.ordering = cu.ordering
where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)';

-- ============================================================================
-- 2. FRANÇAIS 6e (nouveau programme — seule version publiée pour la 6e)
-- Source : https://dpfc-ci.net/dpfc/2026/progressions/FRANCAIS_PROGRESSION_%206%C3%A8_NOUVEAU%20PROGRAMME.pdf
-- Structure officielle : 5 domaines menés en parallèle toute l'année (pas
-- une liste séquentielle de chapitres) — modélisé ici en unités parentes
-- (domaine) + unités filles (séquence), via parent_unit_id.
-- Pas d'official_progression_steps pour ce curriculum : les 5 domaines
-- avancent simultanément chaque semaine (calendrier non transposable en un
-- simple "expected_week" par unité sans le déformer — Convention §19,
-- mieux vaut l'omettre que l'inventer).
-- ============================================================================

insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC 2025-2026 (nouveau programme, contenu reconduit)',
  'https://dpfc-ci.net/dpfc/2026/progressions/FRANCAIS_PROGRESSION_%206%C3%A8_NOUVEAU%20PROGRAMME.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name = '6e'
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'Français'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

-- Domaines (unités parentes)
insert into curriculum_units (curriculum_id, title, ordering)
select cur.id, v.title, v.ordering
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'Français'
cross join lateral (values
  ('Grammaire / Orthographe / Lexique', 1),
  ('Expression orale', 2),
  ('Lecture méthodique / Exploitation de texte', 3),
  ('Étude d''œuvre intégrale', 4),
  ('Expression écrite', 5)
) as v(title, ordering)
where cur.version_label = 'DPFC 2025-2026 (nouveau programme, contenu reconduit)';

-- Séquences (unités filles) — Grammaire/Orthographe/Lexique
insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Français'
cross join lateral (values
  ('Étudier la phrase', 1),
  ('Étudier le groupe nominal', 2),
  ('Étudier le groupe adjectif', 3),
  ('Étudier le groupe verbal', 4),
  ('Étudier les pronoms', 5),
  ('Étudier les verbes : formes et emplois', 6),
  ('L''adverbe et le groupe adverbial', 7),
  ('Étudier la coordination', 8)
) as v(title, ordering)
where p.title = 'Grammaire / Orthographe / Lexique' and cur.version_label = 'DPFC 2025-2026 (nouveau programme, contenu reconduit)';

-- Séquences — Expression orale
insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Français'
cross join lateral (values
  ('Interpréter oralement des messages et des discours', 1),
  ('S''exprimer devant un auditoire', 2),
  ('Participer à des échanges oraux', 3),
  ('Dire un texte', 4)
) as v(title, ordering)
where p.title = 'Expression orale' and cur.version_label = 'DPFC 2025-2026 (nouveau programme, contenu reconduit)';

-- Séquences — Lecture méthodique / Exploitation de texte
insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Français'
cross join lateral (values
  ('Lire une lettre', 1),
  ('Lire un texte descriptif', 2),
  ('Lire un portrait', 3),
  ('Lire un texte narratif', 4)
) as v(title, ordering)
where p.title = 'Lecture méthodique / Exploitation de texte' and cur.version_label = 'DPFC 2025-2026 (nouveau programme, contenu reconduit)';

-- Séquences — Étude d'œuvre intégrale
insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Français'
cross join lateral (values
  ('Œuvre intégrale narrative n°1', 1),
  ('Œuvre intégrale narrative n°2', 2)
) as v(title, ordering)
where p.title = 'Étude d''œuvre intégrale' and cur.version_label = 'DPFC 2025-2026 (nouveau programme, contenu reconduit)';

-- Séquences — Expression écrite
insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Français'
cross join lateral (values
  ('Rédiger une lettre', 1),
  ('Rédiger une description', 2),
  ('Rédiger un portrait', 3),
  ('Rédiger un texte narratif', 4)
) as v(title, ordering)
where p.title = 'Expression écrite' and cur.version_label = 'DPFC 2025-2026 (nouveau programme, contenu reconduit)';

-- ============================================================================
-- 3. SVT 6e
-- Source : https://dpfc-ci.net/dpfc/2026/progressions/SVT%20PROGRESSIONS%20ANNUELLES%202025%202026%20.pdf
-- Structure officielle : 3 compétences, chacune avec ses leçons.
-- ============================================================================

insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC 2025-2026 (contenu reconduit)',
  'https://dpfc-ci.net/dpfc/2026/progressions/SVT%20PROGRESSIONS%20ANNUELLES%202025%202026%20.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name = '6e'
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'SVT'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

insert into curriculum_units (curriculum_id, title, ordering)
select cur.id, v.title, v.ordering
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'SVT'
cross join lateral (values
  ('Compétence 1 : Reproduction chez les plantes à fleurs et chez les vertébrés', 1),
  ('Compétence 2 : Facteurs de croissance chez les plantes à fleurs et chez les vertébrés', 2),
  ('Compétence 3 : Dégradation et préservation de l''environnement', 3)
) as v(title, ordering)
where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and cur.subject_id = (select id from subjects where name='SVT' limit 1);

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering, recommended_hours)
select p.curriculum_id, p.id, v.title, v.ordering, v.hours
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'SVT'
cross join lateral (values
  ('La formation d''une graine', 1, 2),
  ('La germination d''une graine', 2, 2),
  ('La reproduction chez les mammifères', 3, 4),
  ('La reproduction chez les oiseaux', 4, 3)
) as v(title, ordering, hours)
where p.title = 'Compétence 1 : Reproduction chez les plantes à fleurs et chez les vertébrés' and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)';

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering, recommended_hours)
select p.curriculum_id, p.id, v.title, v.ordering, v.hours
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'SVT'
cross join lateral (values
  ('Les facteurs de croissance chez les plantes à fleurs', 1, 3),
  ('L''influence des aliments sur la croissance des vertébrés', 2, 3)
) as v(title, ordering, hours)
where p.title = 'Compétence 2 : Facteurs de croissance chez les plantes à fleurs et chez les vertébrés' and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)';

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering, recommended_hours)
select p.curriculum_id, p.id, v.title, v.ordering, v.hours
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'SVT'
cross join lateral (values
  ('Les actions néfastes de l''Homme et leurs conséquences sur l''environnement', 1, 3),
  ('La lutte contre la dégradation de l''environnement', 2, 3)
) as v(title, ordering, hours)
where p.title = 'Compétence 3 : Dégradation et préservation de l''environnement' and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)';

insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select cu.curriculum_id, cu.id, v.week, v.ordering
from curriculum_units cu
join curricula cur on cur.id = cu.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'SVT'
join (values
  ('La formation d''une graine', 1, 1),
  ('La germination d''une graine', 2, 3),
  ('La reproduction chez les mammifères', 3, 4),
  ('La reproduction chez les oiseaux', 4, 8),
  ('Les facteurs de croissance chez les plantes à fleurs', 5, 16),
  ('L''influence des aliments sur la croissance des vertébrés', 6, 19),
  ('Les actions néfastes de l''Homme et leurs conséquences sur l''environnement', 7, 23),
  ('La lutte contre la dégradation de l''environnement', 8, 26)
) as v(title, ordering, week) on v.title = cu.title
where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and cu.parent_unit_id is not null;

-- ============================================================================
-- 4. PHYSIQUE-CHIMIE 6e (programme standard, pas le nouveau programme en
-- expérimentation)
-- Source : https://dpfc-ci.net/dpfc/2026/progressions/Physique-Chimie%20Progressions%202025-2026.pdf
-- (page "PROGRESSION DE PHYSIQUE-CHIMIE SIXIÈME 2025-2026")
-- ============================================================================

insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC 2025-2026 (contenu reconduit)',
  'https://dpfc-ci.net/dpfc/2026/progressions/Physique-Chimie%20Progressions%202025-2026.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name = '6e'
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'Physique-Chimie'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

insert into curriculum_units (curriculum_id, title, ordering)
select cur.id, v.title, v.ordering
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'Physique-Chimie'
cross join lateral (values
  ('Électricité', 1),
  ('Propriétés physiques de la matière', 2),
  ('Les combustions', 3),
  ('Mesure de grandeurs physiques', 4)
) as v(title, ordering)
where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and cur.subject_id = (select id from subjects where name='Physique-Chimie' limit 1);

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Physique-Chimie'
cross join lateral (values
  ('Le circuit électrique', 1),
  ('Commande d''un circuit électrique', 2),
  ('Court-circuit et protection des installations électriques', 3)
) as v(title, ordering)
where p.title = 'Électricité' and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)';

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Physique-Chimie'
cross join lateral (values
  ('Solides et liquides', 1),
  ('Les gaz', 2),
  ('Température d''un corps', 3),
  ('Les changements d''état de l''eau', 4)
) as v(title, ordering)
where p.title = 'Propriétés physiques de la matière' and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)';

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Physique-Chimie'
cross join lateral (values
  ('Les constituants de l''air', 1),
  ('Combustion d''un solide et d''un liquide dans l''air', 2),
  ('Combustion d''un gaz dans l''air', 3),
  ('Dangers des combustions', 4)
) as v(title, ordering)
where p.title = 'Les combustions' and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)';

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Physique-Chimie'
cross join lateral (values
  ('Volume d''un liquide et d''un solide', 1),
  ('Masse d''un solide et d''un liquide', 2)
) as v(title, ordering)
where p.title = 'Mesure de grandeurs physiques' and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)';

insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select cu.curriculum_id, cu.id, v.week, v.ordering
from curriculum_units cu
join curricula cur on cur.id = cu.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Physique-Chimie'
join (values
  ('Le circuit électrique', 1, 1),
  ('Commande d''un circuit électrique', 2, 3),
  ('Court-circuit et protection des installations électriques', 3, 5),
  ('Solides et liquides', 4, 9),
  ('Les gaz', 5, 10),
  ('Température d''un corps', 6, 12),
  ('Les changements d''état de l''eau', 7, 14),
  ('Les constituants de l''air', 8, 17),
  ('Combustion d''un solide et d''un liquide dans l''air', 9, 18),
  ('Combustion d''un gaz dans l''air', 10, 20),
  ('Dangers des combustions', 11, 21),
  ('Volume d''un liquide et d''un solide', 12, 24),
  ('Masse d''un solide et d''un liquide', 13, 27)
) as v(title, ordering, week) on v.title = cu.title
where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and cu.parent_unit_id is not null;

-- ============================================================================
-- 5. HISTOIRE-GÉOGRAPHIE 6e (nouveau programme — seule version publiée)
-- Source : https://dpfc-ci.net/dpfc/2026/progressions/HG_PROGRESSION%20SIXIEME_NOUVEAU.pdf
-- Deux disciplines regroupées sous une même matière du référentiel
-- (Convention §9 : le référentiel ne modélise pas de sous-matière séparée
-- pour Histoire vs Géographie, on les représente comme deux unités
-- parentes distinctes sous la même matière "Histoire-Géographie").
-- ============================================================================

insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC 2025-2026 (nouveau programme, contenu reconduit)',
  'https://dpfc-ci.net/dpfc/2026/progressions/HG_PROGRESSION%20SIXIEME_NOUVEAU.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name = '6e'
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'Histoire-Géographie'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

insert into curriculum_units (curriculum_id, title, ordering)
select cur.id, v.title, v.ordering
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'Histoire-Géographie'
cross join lateral (values
  ('Histoire — Thème 1 : Les fondements de l''étude de l''histoire', 1),
  ('Histoire — Thème 2 : Les débuts de l''humanité', 2),
  ('Géographie — Thème 1 : Les fondements de l''étude de la géographie', 3),
  ('Géographie — Thème 2 : Connaître le milieu ivoirien', 4)
) as v(title, ordering)
where cur.version_label = 'DPFC 2025-2026 (nouveau programme, contenu reconduit)' and cur.subject_id = (select id from subjects where name='Histoire-Géographie' limit 1);

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering, recommended_hours)
select p.curriculum_id, p.id, v.title, v.ordering, v.hours
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Histoire-Géographie'
cross join lateral (values
  ('L''Histoire : une science utile à l''Homme', 1, 4),
  ('Des sources pour la reconstitution du passé de l''Homme', 2, 2),
  ('La détermination des grandes périodes de l''Histoire', 3, 3)
) as v(title, ordering, hours)
where p.title = 'Histoire — Thème 1 : Les fondements de l''étude de l''histoire' and cur.version_label = 'DPFC 2025-2026 (nouveau programme, contenu reconduit)';

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering, recommended_hours)
select p.curriculum_id, p.id, v.title, v.ordering, v.hours
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Histoire-Géographie'
cross join lateral (values
  ('La préhistoire dans le monde', 1, 2),
  ('Le paléolithique en Côte d''Ivoire', 2, 2),
  ('La révolution du néolithique en Côte d''Ivoire', 3, 3),
  ('La métallurgie du fer en Côte d''Ivoire', 4, 2)
) as v(title, ordering, hours)
where p.title = 'Histoire — Thème 2 : Les débuts de l''humanité' and cur.version_label = 'DPFC 2025-2026 (nouveau programme, contenu reconduit)';

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering, recommended_hours)
select p.curriculum_id, p.id, v.title, v.ordering, v.hours
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Histoire-Géographie'
cross join lateral (values
  ('L''utilité de la géographie', 1, 3),
  ('La Terre, une planète en mouvement', 2, 4)
) as v(title, ordering, hours)
where p.title = 'Géographie — Thème 1 : Les fondements de l''étude de la géographie' and cur.version_label = 'DPFC 2025-2026 (nouveau programme, contenu reconduit)';

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering, recommended_hours)
select p.curriculum_id, p.id, v.title, v.ordering, v.hours
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Histoire-Géographie'
cross join lateral (values
  ('Le milieu physique ivoirien', 1, 5),
  ('La ville et la campagne en Côte d''Ivoire', 2, 3)
) as v(title, ordering, hours)
where p.title = 'Géographie — Thème 2 : Connaître le milieu ivoirien' and cur.version_label = 'DPFC 2025-2026 (nouveau programme, contenu reconduit)';

insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select cu.curriculum_id, cu.id, v.week, v.ordering
from curriculum_units cu
join curricula cur on cur.id = cu.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Histoire-Géographie'
join (values
  ('L''Histoire : une science utile à l''Homme', 1, 3),
  ('Des sources pour la reconstitution du passé de l''Homme', 2, 8),
  ('La détermination des grandes périodes de l''Histoire', 3, 11),
  ('La préhistoire dans le monde', 4, 15),
  ('Le paléolithique en Côte d''Ivoire', 5, 18),
  ('La révolution du néolithique en Côte d''Ivoire', 6, 21),
  ('La métallurgie du fer en Côte d''Ivoire', 7, 25),
  ('L''utilité de la géographie', 8, 3),
  ('La Terre, une planète en mouvement', 9, 9),
  ('Le milieu physique ivoirien', 10, 15),
  ('La ville et la campagne en Côte d''Ivoire', 11, 22)
) as v(title, ordering, week) on v.title = cu.title
where cur.version_label = 'DPFC 2025-2026 (nouveau programme, contenu reconduit)' and cu.parent_unit_id is not null;

-- ============================================================================
-- 6. ANGLAIS 6e (programme standard, pas le "nouveau programme" 6e)
-- Source : https://dpfc-ci.net/dpfc/2026/progressions/Anglais%20Progression%206%C3%A8me%202025-2026.pdf
-- Volume horaire annuel officiel : 90h
-- ============================================================================

insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC 2025-2026 (contenu reconduit)',
  'https://dpfc-ci.net/dpfc/2026/progressions/Anglais%20Progression%206%C3%A8me%202025-2026.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name = '6e'
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'Anglais'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

insert into curriculum_units (curriculum_id, title, ordering, recommended_hours)
select cur.id, v.title, v.ordering, v.hours
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'Anglais'
cross join lateral (values
  ('At school (Greetings, In the classroom, Numbers and school things)', 1, 11),
  ('At home (My family, My house, In the kitchen)', 2, 11),
  ('Time and date (The date, The time, The time table)', 3, 11),
  ('Jobs and occupations (Jobs and occupations, Tools, Work places)', 4, 12),
  ('Clothes and colours (Clothes, Clothes and colours, Buying clothes)', 5, 11),
  ('Food and drinks (Meals and drinks, Fruit and vegetables, Recipes)', 6, 11),
  ('Health and environment (Hygiene and parts of body, Insalubrity and common diseases, Water and health)', 7, 11),
  ('Sports and games (Importance of sport, The CAN, Traditional games)', 8, 12)
) as v(title, ordering, hours)
where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and cur.subject_id = (select id from subjects where name='Anglais' limit 1);

insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select cu.curriculum_id, cu.id, v.week, cu.ordering
from curriculum_units cu
join curricula cur on cur.id = cu.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Anglais'
join (values
  (1,1),(2,5),(3,9),(4,12),(5,16),(6,20),(7,23),(8,27)
) as v(ordering, week) on v.ordering = cu.ordering
where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and cu.parent_unit_id is null;

create index if not exists idx_curriculum_units_parent on curriculum_units(parent_unit_id);

-- ============================================================================
-- 0016_referentiel_2nde_dpfc.sql
-- Cinquième enrichissement réel du référentiel (EF-REF-02), niveau 2nde,
-- à la demande explicite de l'utilisateur ("Référentiel DPFC : 2nde").
--
-- DÉCISION ARCHITECTURALE VALIDÉE AVEC L'UTILISATEUR AVANT IMPLÉMENTATION
-- (Convention §59) : contrairement au collège (6e à 3e), la DPFC scinde ses
-- progressions officielles par SÉRIE dès la 2nde (2ndeA / 2ndeC), avec des
-- volumes horaires et des contenus réellement différents (vérifié pour
-- Mathématiques, Physique-Chimie et SVT). Le schéma n'a pas de colonne
-- "série" dédiée, mais `education_levels.name` supporte déjà nativement ce
-- cas (le commentaire du schéma d'origine donne lui-même l'exemple
-- "Terminale D"). Solution retenue : deux nouvelles lignes education_levels
-- ('2ndeA', '2ndeC'), au même titre que deux niveaux à part entière du cycle
-- Lycée — AUCUN changement de schéma. La ligne '2nde' générique créée par le
-- seed (0007) est laissée telle quelle (Convention §15 : on n'efface rien),
-- simplement non utilisée par ce lot ni les suivants ; à netoyer plus tard
-- si confirmé qu'elle ne sert à rien.
-- Conséquence côté produit (signalée à l'utilisateur) : un professeur de
-- 2nde devra désormais choisir sa série au moment de créer sa classe.
--
-- Pour les matières où la DPFC NE publie PAS de contenu distinct par série
-- (Français, Anglais), la même ligne de contenu est rattachée aux deux
-- niveaux 2ndeA et 2ndeC (choix explicite de l'utilisateur) — dupliquée en
-- base plutôt que partagée par un mécanisme implicite, pour rester cohérent
-- avec le principe "un curriculum appartient à un education_level" déjà en
-- place partout ailleurs dans le référentiel.
--
-- SOURCES (consultées le 15 août 2026, https://dpfc-ci.net/?page_id=5267) :
-- - Mathématiques : "MATHS - Progressions du secondaire 2025-2026" (pages
--   2de A / 2de C du document commun 6e->Tle).
-- - SVT : "SVT PROGRESSIONS ANNUELLES 2025-2026" (pages "Niveau : Seconde A"
--   / "Niveau : Seconde C" du document commun 6e->Tle).
-- - Physique-Chimie : "Physique-Chimie Progressions 2025-2026" (pages
--   "PROGRESSION DE PHYSIQUE-CHIMIE SECONDE A 2025-2026" / "...SECONDE C
--   2024-2025"). Particularité documentée : la page Seconde C de ce document
--   est datée 2024-2025 (non republiée pour 2025-2026 au moment de la
--   consultation) — même cas de figure que HISTGEO 4e/5e (Convention §6 :
--   utilisée telle quelle comme source institutionnelle équivalente, jamais
--   présentée comme "2025-2026" dans version_label).
-- - Anglais : "Anglais, Progression (2nde A-C) 2025-2026" — un seul document
--   commun aux deux séries.
-- - Français : "Français, Progressions à usage pédagogique 2nde cycle
--   2025-2026" (section "Classes de 2nde A et C").
--
-- NON COUVERT DANS CE LOT (à sourcer plus tard, jamais improvisé) :
-- - Histoire-Géographie 2nde : aucune progression 2025-2026 dédiée trouvée
--   sur la page officielle des progressions, ET aucun document "programme
--   éducatif" HISTGEO_2nde.pdf trouvé au même emplacement que les documents
--   HISTGEO_4eme.pdf/HISTGEO_5eme.pdf/HISTGEO_3eme.pdf déjà utilisés dans
--   les lots précédents — contrairement à ces niveaux, pas de repli
--   institutionnel équivalent identifié pour l'instant. Plutôt que
--   d'improviser un contenu HG non sourcé (Convention §19), ce lot ne
--   couvre pas cette matière pour la 2nde ; à reprendre avec une recherche
--   dédiée.
-- - Physique-Chimie 2nde : les tableaux sources présentent Physique et
--   Chimie en deux colonnes parallèles avec des durées fractionnées sur
--   plusieurs semaines par leçon (ex. "6h" réparties sur 2-3 semaines) —
--   l'extraction automatique de ce tableau ne permet pas de garantir un
--   volume horaire par leçon fiable. Plutôt que d'inventer une répartition
--   (Convention §19), seuls les intitulés de thème/leçon et une semaine de
--   première apparition sont repris ; `recommended_hours` est laissé vide
--   pour cette matière à ce niveau (comme déjà fait pour PC 6e dans le lot
--   précédent, même principe de prudence face à des données peu fiables).
-- - 1ère/Tle (toutes séries) : à sourcer un par un plus tard.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Niveaux 2ndeA / 2ndeC
-- ----------------------------------------------------------------------------
insert into education_levels (cycle_id, name, ordering)
select ec.id, v.name, v.ordering
from education_cycles ec
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
cross join lateral (values ('2ndeA', 1), ('2ndeC', 2)) as v(name, ordering)
where ec.name = 'Lycée'
on conflict do nothing;

-- ============================================================================
-- 1. MATHÉMATIQUES 2ndeA
-- Volume horaire annuel officiel : 90h (3h/semaine)
-- ============================================================================

insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC 2025-2026 (contenu reconduit)',
  'https://dpfc-ci.net/dpfc/2026/progressions/MATHS%20-%20Progressions%20%202025-2026.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name = '2ndeA'
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'Mathématiques'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

insert into curriculum_units (curriculum_id, title, ordering, recommended_hours)
select cur.id, v.title, v.ordering, v.hours
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'Mathématiques'
join education_levels el on el.id = cur.education_level_id and el.name = '2ndeA'
cross join lateral (values
  ('Calcul numérique', 1, 11),
  ('Dénombrement', 2, 15),
  ('Calcul littéral', 3, 11),
  ('Équations et inéquations dans ℝ', 4, 7),
  ('Généralités sur les fonctions', 5, 11),
  ('Étude de fonctions élémentaires', 6, 9),
  ('Statistique', 7, 7),
  ('Systèmes d''équations linéaires dans ℝ × ℝ', 8, 5)
) as v(title, ordering, hours)
where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and el.name = '2ndeA';

insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select cu.curriculum_id, cu.id, v.week, cu.ordering
from curriculum_units cu
join curricula cur on cur.id = cu.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Mathématiques'
join education_levels el on el.id = cur.education_level_id and el.name = '2ndeA'
join (values (1,1),(2,5),(3,10),(4,14),(5,17),(6,21),(7,24),(8,27)) as v(ordering, week) on v.ordering = cu.ordering
where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)';

-- ============================================================================
-- 2. MATHÉMATIQUES 2ndeC
-- Volume horaire annuel officiel : 150h (5h/semaine)
-- ============================================================================

insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC 2025-2026 (contenu reconduit)',
  'https://dpfc-ci.net/dpfc/2026/progressions/MATHS%20-%20Progressions%20%202025-2026.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name = '2ndeC'
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'Mathématiques'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

insert into curriculum_units (curriculum_id, title, ordering, recommended_hours)
select cur.id, v.title, v.ordering, v.hours
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'Mathématiques'
join education_levels el on el.id = cur.education_level_id and el.name = '2ndeC'
cross join lateral (values
  ('Vecteurs et points du plan', 1, 9),
  ('Ensemble des nombres réels', 2, 11),
  ('Utilisation des symétries et translations', 3, 7),
  ('Généralités sur les fonctions', 4, 9),
  ('Droites et plans de l''espace', 5, 11),
  ('Fonctions polynômes et fractions rationnelles', 6, 7),
  ('Angles inscrits', 7, 5),
  ('Angles orientés et trigonométrie', 8, 11),
  ('Statistique à une variable', 9, 7),
  ('Produit scalaire', 10, 11),
  ('Équations et inéquations dans ℝ', 11, 9),
  ('Homothéties', 12, 7),
  ('Étude de fonctions élémentaires', 13, 11),
  ('Rotations', 14, 7),
  ('Inéquations dans ℝ × ℝ', 15, 3)
) as v(title, ordering, hours)
where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and el.name = '2ndeC';

insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select cu.curriculum_id, cu.id, v.week, cu.ordering
from curriculum_units cu
join curricula cur on cur.id = cu.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Mathématiques'
join education_levels el on el.id = cur.education_level_id and el.name = '2ndeC'
join (values
  (1,1),(2,3),(3,5),(4,7),(5,9),(6,11),(7,13),(8,14),(9,16),(10,18),
  (11,20),(12,22),(13,24),(14,26),(15,28)
) as v(ordering, week) on v.ordering = cu.ordering
where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)';

-- ============================================================================
-- 3. SVT 2ndeA
-- Compétences numérotées 2, 3, 1 dans le document officiel (non
-- séquentielles) — numérotation recopiée telle quelle (Convention §19),
-- `ordering` en base suit l'ordre réel de déroulement dans l'année, même
-- traitement que SVT 4e/3e dans les lots précédents.
-- ============================================================================

insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC 2025-2026 (contenu reconduit)',
  'https://dpfc-ci.net/dpfc/2026/progressions/SVT%20PROGRESSIONS%20ANNUELLES%202025%202026%20.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name = '2ndeA'
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'SVT'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

insert into curriculum_units (curriculum_id, title, ordering)
select cur.id, v.title, v.ordering
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'SVT'
join education_levels el on el.id = cur.education_level_id and el.name = '2ndeA'
cross join lateral (values
  ('Compétence 2 : Reproduction et hérédité — La reproduction cellulaire', 1),
  ('Compétence 3 : Nutrition et santé — La nutrition et la santé de l''Homme', 2),
  ('Compétence 1 : Communication — La transmission de l''information au niveau de l''organisme', 3),
  ('Compétence 1 : Communication — L''Homme et l''environnement', 4)
) as v(title, ordering)
where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and el.name = '2ndeA';

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'SVT'
join education_levels el on el.id = cur.education_level_id and el.name = '2ndeA'
cross join lateral (values
  ('La structure d''une cellule', 1),
  ('La reproduction conforme ou mitose', 2)
) as v(title, ordering)
where p.title = 'Compétence 2 : Reproduction et hérédité — La reproduction cellulaire' and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and el.name = '2ndeA';

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'SVT'
join education_levels el on el.id = cur.education_level_id and el.name = '2ndeA'
cross join lateral (values
  ('La diversité des comportements alimentaires de l''Homme', 1),
  ('Les habitudes alimentaires et la santé de l''Homme', 2)
) as v(title, ordering)
where p.title = 'Compétence 3 : Nutrition et santé — La nutrition et la santé de l''Homme' and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and el.name = '2ndeA';

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'SVT'
join education_levels el on el.id = cur.education_level_id and el.name = '2ndeA'
cross join lateral (values
  ('La transmission d''un message nerveux', 1),
  ('La transmission d''un message hormonal', 2)
) as v(title, ordering)
where p.title = 'Compétence 1 : Communication — La transmission de l''information au niveau de l''organisme' and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and el.name = '2ndeA';

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'SVT'
join education_levels el on el.id = cur.education_level_id and el.name = '2ndeA'
cross join lateral (values
  ('Les grands ensembles environnementaux', 1),
  ('La production de la matière organique', 2),
  ('Le changement climatique', 3)
) as v(title, ordering)
where p.title = 'Compétence 1 : Communication — L''Homme et l''environnement' and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and el.name = '2ndeA';

insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select cu.curriculum_id, cu.id, v.week, v.ordering
from curriculum_units cu
join curricula cur on cur.id = cu.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'SVT'
join education_levels el on el.id = cur.education_level_id and el.name = '2ndeA'
join (values
  ('La structure d''une cellule', 1, 1),
  ('La reproduction conforme ou mitose', 2, 3),
  ('La diversité des comportements alimentaires de l''Homme', 3, 8),
  ('Les habitudes alimentaires et la santé de l''Homme', 4, 10),
  ('La transmission d''un message nerveux', 5, 14),
  ('La transmission d''un message hormonal', 6, 18),
  ('Les grands ensembles environnementaux', 7, 21),
  ('La production de la matière organique', 8, 23),
  ('Le changement climatique', 9, 27)
) as v(title, ordering, week) on v.title = cu.title
where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and cu.parent_unit_id is not null and el.name = '2ndeA';

-- ============================================================================
-- 4. SVT 2ndeC
-- Compétences numérotées 3, 4, 2, 1 dans le document officiel (non
-- séquentielles) — même traitement que ci-dessus.
-- ============================================================================

insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC 2025-2026 (contenu reconduit)',
  'https://dpfc-ci.net/dpfc/2026/progressions/SVT%20PROGRESSIONS%20ANNUELLES%202025%202026%20.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name = '2ndeC'
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'SVT'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

insert into curriculum_units (curriculum_id, title, ordering)
select cur.id, v.title, v.ordering
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'SVT'
join education_levels el on el.id = cur.education_level_id and el.name = '2ndeC'
cross join lateral (values
  ('Compétence 3 : Reproduction et hérédité — La reproduction de la cellule', 1),
  ('Compétence 4 : Nutrition et santé — La nutrition minérale de la plante verte', 2),
  ('Compétence 2 : Communication — Les relations au sein d''un écosystème et l''influence de l''Homme sur l''environnement', 3),
  ('Compétence 1 : Géologie et pédologie — La structure géologique de la Côte d''Ivoire et le devenir des roches', 4)
) as v(title, ordering)
where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and el.name = '2ndeC';

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'SVT'
join education_levels el on el.id = cur.education_level_id and el.name = '2ndeC'
cross join lateral (values
  ('L''organisation d''une cellule', 1),
  ('La division cellulaire', 2),
  ('L''évolution de l''équipement chromosomique d''une cellule au cours de la mitose', 3)
) as v(title, ordering)
where p.title = 'Compétence 3 : Reproduction et hérédité — La reproduction de la cellule' and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and el.name = '2ndeC';

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'SVT'
join education_levels el on el.id = cur.education_level_id and el.name = '2ndeC'
cross join lateral (values
  ('L''absorption de l''eau par la plante verte', 1),
  ('L''influence des sels minéraux sur la croissance de la plante verte', 2),
  ('L''absorption des sels minéraux par la plante verte', 3),
  ('Le devenir des substances absorbées par la plante verte', 4)
) as v(title, ordering)
where p.title = 'Compétence 4 : Nutrition et santé — La nutrition minérale de la plante verte' and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and el.name = '2ndeC';

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'SVT'
join education_levels el on el.id = cur.education_level_id and el.name = '2ndeC'
cross join lateral (values
  ('Les relations entre les êtres vivants dans un écosystème', 1),
  ('Le changement climatique', 2)
) as v(title, ordering)
where p.title = 'Compétence 2 : Communication — Les relations au sein d''un écosystème et l''influence de l''Homme sur l''environnement' and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and el.name = '2ndeC';

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'SVT'
join education_levels el on el.id = cur.education_level_id and el.name = '2ndeC'
cross join lateral (values
  ('La structure géologique de la Côte d''Ivoire', 1),
  ('L''altération chimique des roches magmatiques', 2),
  ('La formation des roches sédimentaires', 3),
  ('La formation des roches métamorphiques', 4),
  ('Le devenir des roches métamorphiques', 5)
) as v(title, ordering)
where p.title = 'Compétence 1 : Géologie et pédologie — La structure géologique de la Côte d''Ivoire et le devenir des roches' and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and el.name = '2ndeC';

insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select cu.curriculum_id, cu.id, v.week, v.ordering
from curriculum_units cu
join curricula cur on cur.id = cu.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'SVT'
join education_levels el on el.id = cur.education_level_id and el.name = '2ndeC'
join (values
  ('L''organisation d''une cellule', 1, 1),
  ('La division cellulaire', 2, 2),
  ('L''évolution de l''équipement chromosomique d''une cellule au cours de la mitose', 3, 4),
  ('L''absorption de l''eau par la plante verte', 4, 7),
  ('L''influence des sels minéraux sur la croissance de la plante verte', 5, 8),
  ('L''absorption des sels minéraux par la plante verte', 6, 10),
  ('Le devenir des substances absorbées par la plante verte', 7, 12),
  ('Les relations entre les êtres vivants dans un écosystème', 8, 16),
  ('Le changement climatique', 9, 19),
  ('La structure géologique de la Côte d''Ivoire', 10, 22),
  ('L''altération chimique des roches magmatiques', 11, 24),
  ('La formation des roches sédimentaires', 12, 25),
  ('La formation des roches métamorphiques', 13, 27),
  ('Le devenir des roches métamorphiques', 14, 28)
) as v(title, ordering, week) on v.title = cu.title
where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and cu.parent_unit_id is not null and el.name = '2ndeC';

-- ============================================================================
-- 5. PHYSIQUE-CHIMIE 2ndeA
-- Unités parentes par thème (comme PC 6e/4e), pas de `recommended_hours` ni
-- d'`official_progression_steps` fins par leçon — voir note en tête de
-- fichier sur la fiabilité du tableau source. Semaine = première apparition
-- de la leçon dans le tableau officiel.
-- ============================================================================

insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC 2025-2026 (contenu reconduit)',
  'https://dpfc-ci.net/dpfc/2026/progressions/Physique-Chimie%20Progressions%202025-2026.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name = '2ndeA'
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'Physique-Chimie'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

insert into curriculum_units (curriculum_id, title, ordering)
select cur.id, v.title, v.ordering
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'Physique-Chimie'
join education_levels el on el.id = cur.education_level_id and el.name = '2ndeA'
cross join lateral (values
  ('Physique — Mécanique', 1),
  ('Physique — Électricité et électronique', 2),
  ('Chimie — La matière et ses transformations', 3),
  ('Chimie — Les ions en solution', 4)
) as v(title, ordering)
where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and el.name = '2ndeA';

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Physique-Chimie'
join education_levels el on el.id = cur.education_level_id and el.name = '2ndeA'
cross join lateral (values
  ('Le mouvement', 1),
  ('Actions mécaniques ou forces', 2),
  ('Équilibre d''un solide soumis à deux forces', 3)
) as v(title, ordering)
where p.title = 'Physique — Mécanique' and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and el.name = '2ndeA';

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Physique-Chimie'
join education_levels el on el.id = cur.education_level_id and el.name = '2ndeA'
cross join lateral (values
  ('Le courant électrique', 1),
  ('Intensité d''un courant continu', 2),
  ('Tension électrique', 3),
  ('Étude expérimentale de quelques dipôles passifs', 4)
) as v(title, ordering)
where p.title = 'Physique — Électricité et électronique' and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and el.name = '2ndeA';

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Physique-Chimie'
join education_levels el on el.id = cur.education_level_id and el.name = '2ndeA'
cross join lateral (values
  ('L''élément chimique', 1),
  ('Structure de l''atome', 2),
  ('Classification périodique des éléments chimiques', 3),
  ('Ions et molécules', 4)
) as v(title, ordering)
where p.title = 'Chimie — La matière et ses transformations' and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and el.name = '2ndeA';

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Physique-Chimie'
join education_levels el on el.id = cur.education_level_id and el.name = '2ndeA'
cross join lateral (values
  ('Mole et grandeurs molaires', 1),
  ('Équation-bilan d''une réaction chimique', 2),
  ('Le chlorure de sodium solide', 3),
  ('Solutions aqueuses ioniques', 4),
  ('Tests d''identification de quelques ions', 5),
  ('Solutions acides et basiques. Mesures de pH', 6)
) as v(title, ordering)
where p.title = 'Chimie — Les ions en solution' and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and el.name = '2ndeA';

insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select cu.curriculum_id, cu.id, v.week, v.ordering
from curriculum_units cu
join curricula cur on cur.id = cu.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Physique-Chimie'
join education_levels el on el.id = cur.education_level_id and el.name = '2ndeA'
join (values
  ('Le mouvement', 1, 1),
  ('Actions mécaniques ou forces', 2, 4),
  ('Équilibre d''un solide soumis à deux forces', 3, 8),
  ('Le courant électrique', 4, 13),
  ('Intensité d''un courant continu', 5, 14),
  ('Tension électrique', 6, 15),
  ('Étude expérimentale de quelques dipôles passifs', 7, 20),
  ('L''élément chimique', 8, 1),
  ('Structure de l''atome', 9, 3),
  ('Classification périodique des éléments chimiques', 10, 6),
  ('Ions et molécules', 11, 7),
  ('Mole et grandeurs molaires', 12, 13),
  ('Équation-bilan d''une réaction chimique', 13, 16),
  ('Le chlorure de sodium solide', 14, 18),
  ('Solutions aqueuses ioniques', 15, 20),
  ('Tests d''identification de quelques ions', 16, 22),
  ('Solutions acides et basiques. Mesures de pH', 17, 24)
) as v(title, ordering, week) on v.title = cu.title
where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and cu.parent_unit_id is not null and el.name = '2ndeA';

-- ============================================================================
-- 6. PHYSIQUE-CHIMIE 2ndeC
-- Particularité : la page source de ce document pour la série C est datée
-- 2024-2025 (non republiée pour 2025-2026 constaté au moment de la
-- consultation) — utilisée telle quelle comme source institutionnelle la
-- plus récente disponible (même principe que HISTGEO 4e/5e), jamais
-- présentée comme "2025-2026".
-- ============================================================================

insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC 2024-2025 (dernière version publiée, contenu reconduit)',
  'https://dpfc-ci.net/dpfc/2026/progressions/Physique-Chimie%20Progressions%202025-2026.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name = '2ndeC'
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'Physique-Chimie'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

insert into curriculum_units (curriculum_id, title, ordering)
select cur.id, v.title, v.ordering
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'Physique-Chimie'
join education_levels el on el.id = cur.education_level_id and el.name = '2ndeC'
cross join lateral (values
  ('Physique — Mécanique', 1),
  ('Physique — Électricité et électronique', 2),
  ('Chimie — La matière et ses transformations', 3),
  ('Chimie — Les ions en solutions aqueuses', 4)
) as v(title, ordering)
where cur.version_label = 'DPFC 2024-2025 (dernière version publiée, contenu reconduit)' and el.name = '2ndeC';

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Physique-Chimie'
join education_levels el on el.id = cur.education_level_id and el.name = '2ndeC'
cross join lateral (values
  ('Le mouvement', 1),
  ('Actions mécaniques ou forces', 2),
  ('Équilibre d''un solide soumis à deux, puis à trois forces', 3),
  ('Équilibre d''un solide mobile autour d''un axe fixe', 4),
  ('Principe de l''inertie', 5),
  ('Quantité de mouvement', 6)
) as v(title, ordering)
where p.title = 'Physique — Mécanique' and cur.version_label = 'DPFC 2024-2025 (dernière version publiée, contenu reconduit)' and el.name = '2ndeC';

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Physique-Chimie'
join education_levels el on el.id = cur.education_level_id and el.name = '2ndeC'
cross join lateral (values
  ('Le courant électrique', 1),
  ('Intensité d''un courant continu', 2),
  ('Tension électrique', 3),
  ('Étude expérimentale de quelques dipôles passifs', 4),
  ('Étude expérimentale d''un dipôle actif. Point de fonctionnement', 5)
) as v(title, ordering)
where p.title = 'Physique — Électricité et électronique' and cur.version_label = 'DPFC 2024-2025 (dernière version publiée, contenu reconduit)' and el.name = '2ndeC';

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Physique-Chimie'
join education_levels el on el.id = cur.education_level_id and el.name = '2ndeC'
cross join lateral (values
  ('L''élément chimique', 1),
  ('Structure de l''atome', 2),
  ('Classification périodique des éléments chimiques', 3),
  ('Ions et molécules', 4)
) as v(title, ordering)
where p.title = 'Chimie — La matière et ses transformations' and cur.version_label = 'DPFC 2024-2025 (dernière version publiée, contenu reconduit)' and el.name = '2ndeC';

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Physique-Chimie'
join education_levels el on el.id = cur.education_level_id and el.name = '2ndeC'
cross join lateral (values
  ('Mole et grandeurs molaires', 1),
  ('Équation-bilan d''une réaction chimique', 2),
  ('Le chlorure de sodium solide', 3),
  ('Solutions aqueuses ioniques', 4),
  ('Tests d''identification de quelques ions', 5),
  ('Solutions acides et basiques. Mesures de pH', 6),
  ('Réaction acido-basique. Dosage', 7)
) as v(title, ordering)
where p.title = 'Chimie — Les ions en solutions aqueuses' and cur.version_label = 'DPFC 2024-2025 (dernière version publiée, contenu reconduit)' and el.name = '2ndeC';

insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select cu.curriculum_id, cu.id, v.week, v.ordering
from curriculum_units cu
join curricula cur on cur.id = cu.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Physique-Chimie'
join education_levels el on el.id = cur.education_level_id and el.name = '2ndeC'
join (values
  ('Le mouvement', 1, 1),
  ('Actions mécaniques ou forces', 2, 4),
  ('Équilibre d''un solide soumis à deux, puis à trois forces', 3, 9),
  ('Équilibre d''un solide mobile autour d''un axe fixe', 4, 11),
  ('Principe de l''inertie', 5, 13),
  ('Quantité de mouvement', 6, 14),
  ('Le courant électrique', 7, 17),
  ('Intensité d''un courant continu', 8, 17),
  ('Tension électrique', 9, 19),
  ('Étude expérimentale de quelques dipôles passifs', 10, 21),
  ('Étude expérimentale d''un dipôle actif. Point de fonctionnement', 11, 25),
  ('L''élément chimique', 12, 1),
  ('Structure de l''atome', 13, 3),
  ('Classification périodique des éléments chimiques', 14, 6),
  ('Ions et molécules', 15, 9),
  ('Mole et grandeurs molaires', 16, 12),
  ('Équation-bilan d''une réaction chimique', 17, 14),
  ('Le chlorure de sodium solide', 18, 16),
  ('Solutions aqueuses ioniques', 19, 19),
  ('Tests d''identification de quelques ions', 20, 21),
  ('Solutions acides et basiques. Mesures de pH', 21, 22),
  ('Réaction acido-basique. Dosage', 22, 27)
) as v(title, ordering, week) on v.title = cu.title
where cur.version_label = 'DPFC 2024-2025 (dernière version publiée, contenu reconduit)' and cu.parent_unit_id is not null and el.name = '2ndeC';

-- ============================================================================
-- 7. ANGLAIS 2ndeA et 2ndeC (contenu identique, un seul document officiel
-- "2nde A-C" pour les deux séries — dupliqué en base, décision utilisateur).
-- 10 unités, 9h/unité, 90h annuel (3h/semaine).
-- ============================================================================

insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC 2025-2026 (contenu reconduit)',
  'https://dpfc-ci.net/dpfc/2026/progressions/Anglais%20Progression%202nde%20A%20et%20C%202025-2026.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name in ('2ndeA', '2ndeC')
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'Anglais'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

insert into curriculum_units (curriculum_id, title, ordering, recommended_hours)
select cur.id, v.title, v.ordering, 9
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'Anglais'
join education_levels el on el.id = cur.education_level_id and el.name in ('2ndeA', '2ndeC')
cross join lateral (values
  ('Unit 1 — People', 1),
  ('Unit 2 — Health and Lifestyle', 2),
  ('Unit 3 — Technology', 3),
  ('Unit 4 — Looking Forward', 4),
  ('Unit 5 — Gender and Education', 5),
  ('Unit 6 — Citizenship', 6),
  ('Unit 7 — Sports', 7),
  ('Unit 8 — Science', 8),
  ('Unit 9 — Wildlife', 9),
  ('Unit 10 — Culture and Civilization', 10)
) as v(title, ordering)
where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)';

insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select cu.curriculum_id, cu.id, v.week, cu.ordering
from curriculum_units cu
join curricula cur on cur.id = cu.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Anglais'
join education_levels el on el.id = cur.education_level_id and el.name in ('2ndeA', '2ndeC')
join (values (1,1),(2,4),(3,7),(4,10),(5,13),(6,16),(7,19),(8,22),(9,25),(10,28)) as v(ordering, week) on v.ordering = cu.ordering
where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)';

-- ============================================================================
-- 8. FRANÇAIS 2ndeA et 2ndeC (contenu identique, document officiel commun
-- "Classes de 2nde A et C" — dupliqué en base, décision utilisateur).
-- Structure officielle en 4 domaines menés en parallèle chaque semaine
-- (Étude de l'œuvre intégrale / Perfectionnement de la langue / Savoir-faire
-- / Expression écrite) — même simplification assumée que pour le Français
-- du collège (6e à 3e) : uniquement les domaines parents, sans séquences
-- filles ni `official_progression_steps` (les domaines avancent en
-- parallèle, un `expected_week` par unité aurait déformé la réalité du
-- programme).
-- ============================================================================

insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC 2025-2026 (contenu reconduit)',
  'https://dpfc-ci.net/dpfc/2026/progressions/FRANCAIS_PROGRESSIONS_A%20USAGE%20PEDAGOGIQUE_2025-2026-%202nd%20CYCLE%20DPFC.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name in ('2ndeA', '2ndeC')
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'Français'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

insert into curriculum_units (curriculum_id, title, ordering)
select cur.id, v.title, v.ordering
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'Français'
join education_levels el on el.id = cur.education_level_id and el.name in ('2ndeA', '2ndeC')
cross join lateral (values
  ('Étude de l''œuvre intégrale', 1),
  ('Perfectionnement de la langue', 2),
  ('Savoir-faire (méthodologie)', 3),
  ('Expression écrite', 4)
) as v(title, ordering)
where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)';

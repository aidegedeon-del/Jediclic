-- ============================================================================
-- 0017_referentiel_1ere_dpfc.sql
-- Sixième enrichissement réel du référentiel (EF-REF-02), niveau 1ère,
-- à la demande explicite de l'utilisateur ("1ère (toutes séries à sourcer)"
-- puis "Mathématiques + SVT + Physique-Chimie" pour ce lot).
--
-- DÉCISION ARCHITECTURALE VALIDÉE AVEC L'UTILISATEUR AVANT IMPLÉMENTATION
-- (Convention §59) : la 1ère est plus fragmentée que la 2nde. Les séries
-- réellement distinguées par la DPFC pour les 3 matières de ce lot sont :
--   - Mathématiques : 1ère A1, 1ère A2, 1ère C, 1ère D (4 progressions
--     distinctes, volumes horaires différents : 120h/90h/180h/150h).
--   - SVT et Physique-Chimie : seulement 1ère A, 1ère C, 1ère D (pas de
--     scission A1/A2 - un seul document "Première A" pour ces 2 matières).
-- Aucune série E trouvée dans les 3 documents sources consultés pour ces
-- 3 matières (contrairement à Philosophie qui distingue "1ères A1-A2" et
-- "1ère C-D-E" sur la même page DPFC) : conformément à la Convention §19,
-- pas de série E créée dans ce lot faute de source, à réévaluer si une
-- matière future (Philosophie notamment) confirme son existence réelle.
--
-- Solution retenue (même mécanisme que 2ndeA/2ndeC, migration 0016) :
-- quatre nouvelles lignes education_levels ('1èreA1', '1èreA2', '1èreC',
-- '1èreD'), aucun changement de schéma. La ligne '1ère' générique du seed
-- (0007) est laissée telle quelle, simplement inutilisée (Convention §15).
-- Pour SVT et Physique-Chimie, qui ne distinguent pas A1/A2, le même
-- contenu est rattaché aux deux niveaux 1èreA1 et 1èreA2 (choix explicite,
-- même principe que Français/Anglais 2nde dans la migration 0016) plutôt
-- que de fusionner A1/A2 en un seul niveau, pour rester cohérent avec la
-- granularité choisie pour les Mathématiques.
--
-- Conséquence côté produit (à signaler à l'utilisateur) : un professeur de
-- 1ère devra choisir sa série (A1/A2/C/D) à la création de sa classe,
-- comme pour la 2nde.
--
-- SOURCES (consultées le 15 août 2026, https://dpfc-ci.net/?page_id=5267) :
-- - Mathématiques : "MATHS - Progressions du secondaire 2025-2026" (pages
--   1re A1 / 1re A2 / 1re C / 1re D du document commun 6e->Tle).
-- - SVT : "SVT PROGRESSIONS ANNUELLES 2025-2026" (pages "Niveau : Première
--   A" / "Niveau : Première C" / "Niveau : Première D" du document commun).
-- - Physique-Chimie : "Physique-Chimie, Progressions 2025-2026" (pages
--   "PROGRESSION DE PHYSIQUE-CHIMIE PREMIERE A/C/D 2025-2026").
--
-- MÉTHODE identique aux lots précédents (0012-0016) : contenu recopié tel
-- quel, `expected_week` = semaine officielle de première apparition de
-- chaque unité dans le document (pas de date calendaire inventée),
-- rattaché à l'année scolaire courante (2026-2027, déjà seedée) via le
-- mécanisme existant de src/lib/progress/drift.ts (EF-PROG-03). Comme pour
-- les lots précédents, les semaines de fin d'unité ne sont pas toujours
-- explicites dans le document source (unités enchaînées sur plusieurs
-- semaines avec régulations intercalées) : seule la semaine de première
-- apparition est reprise, même limite assumée que pour 6e-2nde.
--
-- SVT : modélisée en 2 niveaux (Convention, même pattern que 2nde) :
-- unité parente = "Compétence X : Thème Y" (regroupe le sujet officiel),
-- unité fille = "Leçon" individuelle avec sa semaine propre.
--
-- PHYSIQUE-CHIMIE : à la différence de la 2nde (tableaux jugés peu
-- fiables pour un volume horaire par leçon), les tableaux 1ère présentent
-- une durée unique et non fractionnée par leçon - `recommended_hours` est
-- donc renseigné cette fois. Modélisée en unités parentes par Thème
-- (Physique et Chimie traités comme deux familles de thèmes parallèles,
-- même principe que la 2nde), unités filles = Leçon avec sa durée réelle.
--
-- NON COUVERT DANS CE LOT (à sourcer plus tard, jamais improvisé) :
-- - Français, Anglais, Histoire-Géographie, Philosophie pour la 1ère
--   (Philosophie en particulier distingue déjà "A1-A2" vs "C-D-E" sur la
--   page DPFC - à valider avec l'utilisateur si ce regroupement doit être
--   répliqué ou si A1/A2/C/D/E doivent rester séparés comme pour les 3
--   matières de ce lot).
-- - Série E (aucune source trouvée pour Mathématiques/SVT/Physique-Chimie
--   à ce niveau - à réexaminer si un document dédié est identifié).
-- - Terminale (toutes séries), à sourcer un par un.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Niveaux 1èreA1 / 1èreA2 / 1èreC / 1èreD
-- ----------------------------------------------------------------------------
insert into education_levels (cycle_id, name, ordering)
select ec.id, v.name, v.ordering
from education_cycles ec
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
cross join lateral (values ('1èreA1', 3), ('1èreA2', 4), ('1èreC', 5), ('1èreD', 6)) as v(name, ordering)
where ec.name = 'Lycée'
on conflict do nothing;

-- ============================================================================
-- 1. MATHÉMATIQUES 1ère A1 — Volume horaire annuel : 120h (4h/semaine)
-- ============================================================================

insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC 2025-2026 (contenu reconduit)',
  'https://dpfc-ci.net/dpfc/2026/progressions/MATHS%20-%20Progressions%20%202025-2026.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name = '1èreA1'
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'Mathématiques'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

insert into curriculum_units (curriculum_id, title, ordering, recommended_hours)
select cur.id, v.title, v.ordering, v.hours
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'Mathématiques'
join education_levels el on el.id = cur.education_level_id and el.name = '1èreA1'
cross join lateral (values
  ('Équations et inéquations', 1, 17),
  ('Dénombrement', 2, 19),
  ('Généralités sur les fonctions', 3, 11),
  ('Dérivabilité et étude de fonctions', 4, 21),
  ('Suites numériques', 5, 15),
  ('Statistique', 6, 13),
  ('Systèmes d''équations linéaires dans ℝ × ℝ', 7, 9)
) as v(title, ordering, hours)
where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and el.name = '1èreA1';

insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select cu.curriculum_id, cu.id, v.week, cu.ordering
from curriculum_units cu
join curricula cur on cur.id = cu.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Mathématiques'
join education_levels el on el.id = cur.education_level_id and el.name = '1èreA1'
join (values (1,1),(2,5),(3,10),(4,13),(5,19),(6,23),(7,27)) as v(ordering, week) on v.ordering = cu.ordering
where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)';

-- ============================================================================
-- 2. MATHÉMATIQUES 1ère A2 — Volume horaire annuel : 90h (3h/semaine)
-- ============================================================================

insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC 2025-2026 (contenu reconduit)',
  'https://dpfc-ci.net/dpfc/2026/progressions/MATHS%20-%20Progressions%20%202025-2026.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name = '1èreA2'
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'Mathématiques'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

insert into curriculum_units (curriculum_id, title, ordering, recommended_hours)
select cur.id, v.title, v.ordering, v.hours
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'Mathématiques'
join education_levels el on el.id = cur.education_level_id and el.name = '1èreA2'
cross join lateral (values
  ('Équations et inéquations dans ℝ', 1, 9),
  ('Dénombrement', 2, 17),
  ('Généralités sur les fonctions', 3, 11),
  ('Dérivabilité et étude de fonctions', 4, 17),
  ('Suites numériques', 5, 9),
  ('Statistique', 6, 9),
  ('Systèmes d''équations linéaires dans ℝ × ℝ', 7, 5)
) as v(title, ordering, hours)
where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and el.name = '1èreA2';

insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select cu.curriculum_id, cu.id, v.week, cu.ordering
from curriculum_units cu
join curricula cur on cur.id = cu.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Mathématiques'
join education_levels el on el.id = cur.education_level_id and el.name = '1èreA2'
join (values (1,1),(2,4),(3,10),(4,14),(5,19),(6,22),(7,27)) as v(ordering, week) on v.ordering = cu.ordering
where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)';

-- ============================================================================
-- 3. MATHÉMATIQUES 1ère C — Volume horaire annuel : 180h (6h/semaine)
-- ============================================================================

insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC 2025-2026 (contenu reconduit)',
  'https://dpfc-ci.net/dpfc/2026/progressions/MATHS%20-%20Progressions%20%202025-2026.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name = '1èreC'
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'Mathématiques'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

insert into curriculum_units (curriculum_id, title, ordering, recommended_hours)
select cur.id, v.title, v.ordering, v.hours
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'Mathématiques'
join education_levels el on el.id = cur.education_level_id and el.name = '1èreC'
cross join lateral (values
  ('Équations et inéquations du second degré dans ℝ', 1, 9),
  ('Angles orientés et trigonométrie', 2, 11),
  ('Généralités sur les fonctions', 3, 9),
  ('Barycentre', 4, 9),
  ('Limites et continuité', 5, 9),
  ('Dénombrement', 6, 11),
  ('Extension de la notion de limite', 7, 9),
  ('Composées de transformations du plan', 8, 11),
  ('Dérivation', 9, 9),
  ('Orthogonalité dans l''espace', 10, 9),
  ('Étude et représentation graphique d''une fonction', 11, 11),
  ('Probabilité', 12, 7),
  ('Systèmes d''équations linéaires dans ℝ² et dans ℝ3', 13, 3),
  ('Géométrie analytique du plan', 14, 7),
  ('Suites numériques', 15, 9),
  ('Vecteurs de l''espace', 16, 11),
  ('Statistique à une variable', 17, 7)
) as v(title, ordering, hours)
where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and el.name = '1èreC';

insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select cu.curriculum_id, cu.id, v.week, cu.ordering
from curriculum_units cu
join curricula cur on cur.id = cu.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Mathématiques'
join education_levels el on el.id = cur.education_level_id and el.name = '1èreC'
join (values
  (1,1),(2,2),(3,4),(4,7),(5,8),(6,9),(7,11),(8,13),(9,15),(10,17),
  (11,18),(12,20),(13,22),(14,22),(15,24),(16,25),(17,27)
) as v(ordering, week) on v.ordering = cu.ordering
where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)';

-- ============================================================================
-- 4. MATHÉMATIQUES 1ère D — Volume horaire annuel : 150h (5h/semaine)
-- ============================================================================

insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC 2025-2026 (contenu reconduit)',
  'https://dpfc-ci.net/dpfc/2026/progressions/MATHS%20-%20Progressions%20%202025-2026.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name = '1èreD'
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'Mathématiques'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

insert into curriculum_units (curriculum_id, title, ordering, recommended_hours)
select cur.id, v.title, v.ordering, v.hours
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'Mathématiques'
join education_levels el on el.id = cur.education_level_id and el.name = '1èreD'
cross join lateral (values
  ('Équations et inéquations du second degré dans ℝ', 1, 9),
  ('Angles orientés et trigonométrie', 2, 9),
  ('Généralités sur les fonctions', 3, 7),
  ('Limites et continuité', 4, 9),
  ('Dénombrement', 5, 9),
  ('Dérivation', 6, 11),
  ('Extension de la notion de limite', 7, 9),
  ('Barycentre', 8, 7),
  ('Étude et représentation graphique d''une fonction', 9, 15),
  ('Probabilité', 10, 7),
  ('Suites numériques', 11, 9),
  ('Composées de transformations du plan', 12, 7),
  ('Statistique à une variable', 13, 7),
  ('Systèmes d''équations linéaires dans ℝ² et dans ℝ3', 14, 3),
  ('Orthogonalité dans l''espace', 15, 7)
) as v(title, ordering, hours)
where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and el.name = '1èreD';

insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select cu.curriculum_id, cu.id, v.week, cu.ordering
from curriculum_units cu
join curricula cur on cur.id = cu.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Mathématiques'
join education_levels el on el.id = cur.education_level_id and el.name = '1èreD'
join (values
  (1,1),(2,3),(3,5),(4,6),(5,8),(6,10),(7,13),(8,15),(9,16),(10,19),
  (11,21),(12,22),(13,25),(14,26),(15,27)
) as v(ordering, week) on v.ordering = cu.ordering
where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)';

-- ============================================================================
-- 5. SVT — 1ère A / 1ère C / 1ère D
-- Modélisation en 2 niveaux (parent = Compétence + Thème, fille = Leçon),
-- même pattern que SVT 2nde (migration 0016).
-- ============================================================================

insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC 2025-2026 (contenu reconduit)',
  'https://dpfc-ci.net/dpfc/2026/progressions/SVT%20PROGRESSIONS%20ANNUELLES%202025%202026%20.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'SVT'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
where el.name in ('1èreA1', '1èreA2', '1èreC', '1èreD')
on conflict do nothing;

-- 5.1 SVT — Première A (contenu dupliqué vers 1èreA1 et 1èreA2, cf. note en tête)
insert into curriculum_units (curriculum_id, title, ordering)
select cur.id, v.title, v.ordering
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'SVT'
join education_levels el on el.id = cur.education_level_id and el.name in ('1èreA1', '1èreA2')
cross join lateral (values
  ('Compétence 2 : Reproduction et hérédité — Thème 1 : Les problèmes liés à la reproduction humaine et à la vie familiale', 1),
  ('Compétence 2 : Reproduction et hérédité — Thème 2 : La transmission des caractères héréditaires chez l''Homme', 2),
  ('Compétence 1 : Communication — Les réflexes et les troubles de comportement', 3),
  ('Compétence 3 : Nutrition et santé — Le devenir des nutriments dans l''organisme', 4)
) as v(title, ordering)
where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and el.name in ('1èreA1', '1èreA2');

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'SVT'
join education_levels el on el.id = cur.education_level_id and el.name in ('1èreA1', '1èreA2')
cross join lateral (values ('Les anomalies chromosomiques', 1), ('Les cycles sexuels chez la femme', 2), ('La régulation des naissances', 3)) as v(title, ordering)
where p.title = 'Compétence 2 : Reproduction et hérédité — Thème 1 : Les problèmes liés à la reproduction humaine et à la vie familiale'
  and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and el.name in ('1èreA1', '1èreA2');

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'SVT'
join education_levels el on el.id = cur.education_level_id and el.name in ('1èreA1', '1èreA2')
cross join lateral (values ('La transmission d''un caractère héréditaire lié aux autosomes', 1), ('La transmission d''un caractère héréditaire lié aux hétérosomes', 2)) as v(title, ordering)
where p.title = 'Compétence 2 : Reproduction et hérédité — Thème 2 : La transmission des caractères héréditaires chez l''Homme'
  and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and el.name in ('1èreA1', '1èreA2');

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'SVT'
join education_levels el on el.id = cur.education_level_id and el.name in ('1èreA1', '1èreA2')
cross join lateral (values ('Le réflexe conditionnel', 1), ('Les effets des drogues sur le comportement', 2)) as v(title, ordering)
where p.title = 'Compétence 1 : Communication — Les réflexes et les troubles de comportement'
  and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and el.name in ('1èreA1', '1èreA2');

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'SVT'
join education_levels el on el.id = cur.education_level_id and el.name in ('1èreA1', '1èreA2')
cross join lateral (values ('La production d''énergie par la cellule', 1), ('La mise en réserve des nutriments', 2)) as v(title, ordering)
where p.title = 'Compétence 3 : Nutrition et santé — Le devenir des nutriments dans l''organisme'
  and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and el.name in ('1èreA1', '1èreA2');

insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select ranked.curriculum_id, ranked.id, v.week, ranked.ordering
from (
  select cu.id, cu.curriculum_id, cu.ordering,
    row_number() over (
      partition by cu.curriculum_id
      order by (select p.ordering from curriculum_units p where p.id = coalesce(cu.parent_unit_id, cu.id)), cu.ordering
    ) as rn
  from curriculum_units cu
  join curricula cur on cur.id = cu.curriculum_id
  join subjects s on s.id = cur.subject_id and s.name = 'SVT'
  join education_levels el on el.id = cur.education_level_id and el.name in ('1èreA1', '1èreA2')
  where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and el.name in ('1èreA1', '1èreA2') and cu.parent_unit_id is not null
) ranked
join (values (1,1),(2,4),(3,8),(4,10),(5,13),(6,18),(7,20),(8,25),(9,27)) as v(ordering, week) on v.ordering = ranked.rn;

-- 5.2 SVT — Première C
insert into curriculum_units (curriculum_id, title, ordering)
select cur.id, v.title, v.ordering
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'SVT'
join education_levels el on el.id = cur.education_level_id and el.name = '1èreC'
cross join lateral (values
  ('Compétence 3 : Reproduction et hérédité — Thème 1 : La reproduction chez les mammifères', 1),
  ('Compétence 3 : Reproduction et hérédité — Thème 2 : La transmission des caractères héréditaires', 2),
  ('Compétence 1 : Géologie et pédologie — Thème 1 : La géodynamique interne', 3),
  ('Compétence 1 : Géologie et pédologie — Thème 2 : Les propriétés chimiques des sols', 4),
  ('Compétence 4 : Nutrition et santé — Thème : La production de la matière organique', 5),
  ('Compétence 2 : Communication — Thème : Les écosystèmes', 6)
) as v(title, ordering)
where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and el.name = '1èreC';

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'SVT'
join education_levels el on el.id = cur.education_level_id and el.name = '1èreC'
cross join lateral (values
  ('Le rôle et la structure des gonades des mammifères', 1), ('La division méiotique', 2),
  ('La gamétogénèse chez les mammifères', 3), ('La fécondation chez les mammifères', 4)
) as v(title, ordering)
where p.title = 'Compétence 3 : Reproduction et hérédité — Thème 1 : La reproduction chez les mammifères'
  and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and el.name = '1èreC';

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'SVT'
join education_levels el on el.id = cur.education_level_id and el.name = '1èreC'
cross join lateral (values ('La synthèse des protéines', 1), ('La transmission d''un caractère héréditaire', 2)) as v(title, ordering)
where p.title = 'Compétence 3 : Reproduction et hérédité — Thème 2 : La transmission des caractères héréditaires'
  and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and el.name = '1èreC';

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'SVT'
join education_levels el on el.id = cur.education_level_id and el.name = '1èreC'
cross join lateral (values ('La structure interne du globe terrestre', 1), ('Les mouvements des plaques lithosphériques', 2)) as v(title, ordering)
where p.title = 'Compétence 1 : Géologie et pédologie — Thème 1 : La géodynamique interne'
  and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and el.name = '1èreC';

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'SVT'
join education_levels el on el.id = cur.education_level_id and el.name = '1èreC'
cross join lateral (values ('Les échanges d''ions au niveau du sol', 1)) as v(title, ordering)
where p.title = 'Compétence 1 : Géologie et pédologie — Thème 2 : Les propriétés chimiques des sols'
  and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and el.name = '1èreC';

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'SVT'
join education_levels el on el.id = cur.education_level_id and el.name = '1èreC'
cross join lateral (values ('La photosynthèse', 1)) as v(title, ordering)
where p.title = 'Compétence 4 : Nutrition et santé — Thème : La production de la matière organique'
  and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and el.name = '1èreC';

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'SVT'
join education_levels el on el.id = cur.education_level_id and el.name = '1èreC'
cross join lateral (values ('L''écosystème naturel et l''écosystème agroindustriel', 1)) as v(title, ordering)
where p.title = 'Compétence 2 : Communication — Thème : Les écosystèmes'
  and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and el.name = '1èreC';

insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select ranked.curriculum_id, ranked.id, v.week, ranked.ordering
from (
  select cu.id, cu.curriculum_id, cu.ordering,
    row_number() over (
      partition by cu.curriculum_id
      order by (select p.ordering from curriculum_units p where p.id = coalesce(cu.parent_unit_id, cu.id)), cu.ordering
    ) as rn
  from curriculum_units cu
  join curricula cur on cur.id = cu.curriculum_id
  join subjects s on s.id = cur.subject_id and s.name = 'SVT'
  join education_levels el on el.id = cur.education_level_id and el.name = '1èreC'
  where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and el.name = '1èreC' and cu.parent_unit_id is not null
) ranked
join (values (1,1),(2,3),(3,4),(4,5),(5,7),(6,10),(7,14),(8,17),(9,19),(10,22),(11,26)) as v(ordering, week) on v.ordering = ranked.rn;

-- 5.3 SVT — Première D
insert into curriculum_units (curriculum_id, title, ordering)
select cur.id, v.title, v.ordering
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'SVT'
join education_levels el on el.id = cur.education_level_id and el.name = '1èreD'
cross join lateral (values
  ('Compétence 3 : Reproduction et hérédité — Thème 1 : La reproduction chez les mammifères', 1),
  ('Compétence 3 : Reproduction et hérédité — Thème 2 : La transmission des caractères héréditaires', 2),
  ('Compétence 1 : Géologie et pédologie — Thème 1 : La géodynamique interne', 3),
  ('Compétence 1 : Géologie et pédologie — Thème 2 : Les propriétés chimiques des sols', 4),
  ('Compétence 2 : Communication — Thème : La communication nerveuse', 5),
  ('Compétence 4 : Nutrition et santé — Thème : La production de la matière et son utilisation', 6)
) as v(title, ordering)
where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and el.name = '1èreD';

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'SVT'
join education_levels el on el.id = cur.education_level_id and el.name = '1èreD'
cross join lateral (values ('Les fonctions des gonades', 1), ('La division méiotique', 2), ('La gamétogénèse', 3)) as v(title, ordering)
where p.title = 'Compétence 3 : Reproduction et hérédité — Thème 1 : La reproduction chez les mammifères'
  and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and el.name = '1èreD';

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'SVT'
join education_levels el on el.id = cur.education_level_id and el.name = '1èreD'
cross join lateral (values ('La transmission d''un caractère héréditaire : le monohybridisme', 1), ('La synthèse des protéines', 2)) as v(title, ordering)
where p.title = 'Compétence 3 : Reproduction et hérédité — Thème 2 : La transmission des caractères héréditaires'
  and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and el.name = '1èreD';

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'SVT'
join education_levels el on el.id = cur.education_level_id and el.name = '1èreD'
cross join lateral (values ('Les activités internes du globe terrestre', 1), ('Les mouvements des plaques lithosphériques', 2)) as v(title, ordering)
where p.title = 'Compétence 1 : Géologie et pédologie — Thème 1 : La géodynamique interne'
  and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and el.name = '1èreD';

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'SVT'
join education_levels el on el.id = cur.education_level_id and el.name = '1èreD'
cross join lateral (values ('Les échanges d''ions au niveau du sol', 1), ('L''évolution des sols tropicaux', 2)) as v(title, ordering)
where p.title = 'Compétence 1 : Géologie et pédologie — Thème 2 : Les propriétés chimiques des sols'
  and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and el.name = '1èreD';

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'SVT'
join education_levels el on el.id = cur.education_level_id and el.name = '1èreD'
cross join lateral (values ('Le réflexe inné', 1)) as v(title, ordering)
where p.title = 'Compétence 2 : Communication — Thème : La communication nerveuse'
  and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and el.name = '1èreD';

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering)
select p.curriculum_id, p.id, v.title, v.ordering
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'SVT'
join education_levels el on el.id = cur.education_level_id and el.name = '1èreD'
cross join lateral (values ('La production de la matière', 1), ('La digestion des aliments', 2), ('L''absorption des nutriments', 3)) as v(title, ordering)
where p.title = 'Compétence 4 : Nutrition et santé — Thème : La production de la matière et son utilisation'
  and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and el.name = '1èreD';

insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select ranked.curriculum_id, ranked.id, v.week, ranked.ordering
from (
  select cu.id, cu.curriculum_id, cu.ordering,
    row_number() over (
      partition by cu.curriculum_id
      order by (select p.ordering from curriculum_units p where p.id = coalesce(cu.parent_unit_id, cu.id)), cu.ordering
    ) as rn
  from curriculum_units cu
  join curricula cur on cur.id = cu.curriculum_id
  join subjects s on s.id = cur.subject_id and s.name = 'SVT'
  join education_levels el on el.id = cur.education_level_id and el.name = '1èreD'
  where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and el.name = '1èreD' and cu.parent_unit_id is not null
) ranked
join (values (1,1),(2,3),(3,4),(4,5),(5,8),(6,11),(7,12),(8,15),(9,16),(10,20),(11,22),(12,25),(13,27)) as v(ordering, week) on v.ordering = ranked.rn;

-- ============================================================================
-- 6. PHYSIQUE-CHIMIE — 1ère A / 1ère C / 1ère D
-- Modélisée en unités parentes par Thème (Physique et Chimie en parallèle,
-- même principe que la 2nde), unités filles = Leçon avec sa durée réelle
-- (contrairement à la 2nde, le tableau 1ère donne une durée non fractionnée
-- par leçon, donc recommended_hours est renseigné ici).
-- ============================================================================

insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC 2025-2026 (contenu reconduit)',
  'https://dpfc-ci.net/dpfc/2026/progressions/Physique-Chimie%20Progressions%202025-2026.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'Physique-Chimie'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
where el.name in ('1èreA1', '1èreA2', '1èreC', '1èreD')
on conflict do nothing;

-- 6.1 Physique-Chimie — Première A (dupliqué vers 1èreA1 et 1èreA2)
insert into curriculum_units (curriculum_id, title, ordering)
select cur.id, v.title, v.ordering
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'Physique-Chimie'
join education_levels el on el.id = cur.education_level_id and el.name in ('1èreA1', '1èreA2')
cross join lateral (values
  ('Physique — Électricité', 1), ('Physique — Mécanique', 2),
  ('Chimie — Chimie organique', 3), ('Chimie — Oxydoréduction', 4)
) as v(title, ordering)
where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and el.name in ('1èreA1', '1èreA2');

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering, recommended_hours)
select p.curriculum_id, p.id, v.title, v.ordering, v.hours
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Physique-Chimie'
join education_levels el on el.id = cur.education_level_id and el.name in ('1èreA1', '1èreA2')
cross join lateral (values
  ('Étude d''un dipôle passif : cas d''un résistor', 1, 5),
  ('Étude d''un dipôle actif : cas d''une pile. Loi de Pouillet', 2, 7),
  ('Puissance et énergie électriques', 3, 4),
  ('Principe de la production d''une tension alternative', 4, 5)
) as v(title, ordering, hours)
where p.title = 'Physique — Électricité' and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and el.name in ('1èreA1', '1èreA2');

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering, recommended_hours)
select p.curriculum_id, p.id, v.title, v.ordering, v.hours
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Physique-Chimie'
join education_levels el on el.id = cur.education_level_id and el.name in ('1èreA1', '1èreA2')
cross join lateral (values
  ('Travail et puissance d''une force constante dans le cas d''un mouvement de translation', 1, 5),
  ('Énergie cinétique', 2, 4),
  ('Énergie potentielle de pesanteur', 3, 4),
  ('Énergie mécanique', 4, 3)
) as v(title, ordering, hours)
where p.title = 'Physique — Mécanique' and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and el.name in ('1èreA1', '1èreA2');

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering, recommended_hours)
select p.curriculum_id, p.id, v.title, v.ordering, v.hours
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Physique-Chimie'
join education_levels el on el.id = cur.education_level_id and el.name in ('1èreA1', '1èreA2')
cross join lateral (values
  ('Les alcanes', 1, 3),
  ('Les alcènes : cas de l''éthylène', 2, 3),
  ('Pétroles et gaz naturels', 3, 2)
) as v(title, ordering, hours)
where p.title = 'Chimie — Chimie organique' and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and el.name in ('1èreA1', '1èreA2');

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering, recommended_hours)
select p.curriculum_id, p.id, v.title, v.ordering, v.hours
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Physique-Chimie'
join education_levels el on el.id = cur.education_level_id and el.name in ('1èreA1', '1èreA2')
cross join lateral (values
  ('Réactions d''oxydo-réduction en solution aqueuse', 1, 4),
  ('Classification qualitative des couples oxydant/réducteur', 2, 3),
  ('Classification quantitative des couples oxydant/réducteur', 3, 3.5),
  ('Étude de la pile Daniell', 4, 2)
) as v(title, ordering, hours)
where p.title = 'Chimie — Oxydoréduction' and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and el.name in ('1èreA1', '1èreA2');

insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select ranked.curriculum_id, ranked.id, v.week, ranked.ordering
from (
  select cu.id, cu.curriculum_id, cu.ordering,
    row_number() over (
      partition by cu.curriculum_id
      order by (select p.ordering from curriculum_units p where p.id = coalesce(cu.parent_unit_id, cu.id)), cu.ordering
    ) as rn
  from curriculum_units cu
  join curricula cur on cur.id = cu.curriculum_id
  join subjects s on s.id = cur.subject_id and s.name = 'Physique-Chimie'
  join education_levels el on el.id = cur.education_level_id and el.name in ('1èreA1', '1èreA2')
  where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and el.name in ('1èreA1', '1èreA2') and cu.parent_unit_id is not null
) ranked
join (values (1,1),(2,6),(3,13),(4,16),(5,21),(6,24),(7,26),(8,28),(9,1),(10,7),(11,11),(12,15),(13,21),(14,24),(15,28)) as v(ordering, week) on v.ordering = ranked.rn;

-- 6.2 Physique-Chimie — Première C
insert into curriculum_units (curriculum_id, title, ordering)
select cur.id, v.title, v.ordering
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'Physique-Chimie'
join education_levels el on el.id = cur.education_level_id and el.name = '1èreC'
cross join lateral (values
  ('Physique — Mécanique', 1), ('Physique — Électricité et électronique', 2), ('Physique — Optique', 3),
  ('Chimie — Chimie organique', 4), ('Chimie — Oxydoréduction', 5)
) as v(title, ordering)
where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and el.name = '1èreC';

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering, recommended_hours)
select p.curriculum_id, p.id, v.title, v.ordering, v.hours
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Physique-Chimie'
join education_levels el on el.id = cur.education_level_id and el.name = '1èreC'
cross join lateral (values
  ('Travail et puissance dans le cas d''un mouvement de translation', 1, 6),
  ('Travail et puissance dans le cas d''un mouvement de rotation autour d''un axe fixe', 2, 6),
  ('Énergie cinétique', 3, 8),
  ('Énergie potentielle', 4, 2),
  ('Énergie mécanique', 5, 6)
) as v(title, ordering, hours)
where p.title = 'Physique — Mécanique' and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and el.name = '1èreC';

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering, recommended_hours)
select p.curriculum_id, p.id, v.title, v.ordering, v.hours
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Physique-Chimie'
join education_levels el on el.id = cur.education_level_id and el.name = '1èreC'
cross join lateral (values
  ('Champ électrostatique', 1, 4),
  ('Énergie potentielle électrostatique', 2, 3),
  ('Puissance et énergie électriques', 3, 6),
  ('Le condensateur', 4, 6),
  ('L''amplificateur opérationnel', 5, 8)
) as v(title, ordering, hours)
where p.title = 'Physique — Électricité et électronique' and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and el.name = '1èreC';

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering, recommended_hours)
select p.curriculum_id, p.id, v.title, v.ordering, v.hours
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Physique-Chimie'
join education_levels el on el.id = cur.education_level_id and el.name = '1èreC'
cross join lateral (values
  ('Introduction à l''optique géométrique', 1, 2),
  ('Réflexion et réfraction de la lumière blanche', 2, 8),
  ('Les lentilles minces', 3, 8)
) as v(title, ordering, hours)
where p.title = 'Physique — Optique' and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and el.name = '1èreC';

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering, recommended_hours)
select p.curriculum_id, p.id, v.title, v.ordering, v.hours
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Physique-Chimie'
join education_levels el on el.id = cur.education_level_id and el.name = '1èreC'
cross join lateral (values
  ('Généralités sur les composés organiques', 1, 3.5),
  ('Hydrocarbures saturés : les alcanes', 2, 4),
  ('Hydrocarbures insaturés : les alcènes et les alcynes', 3, 3.5),
  ('Le benzène', 4, 2),
  ('Pétrole et gaz naturels', 5, 1),
  ('Quelques composés oxygénés', 6, 4),
  ('L''éthanol', 7, 2),
  ('Estérification et hydrolyse d''un ester', 8, 4)
) as v(title, ordering, hours)
where p.title = 'Chimie — Chimie organique' and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and el.name = '1èreC';

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering, recommended_hours)
select p.curriculum_id, p.id, v.title, v.ordering, v.hours
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Physique-Chimie'
join education_levels el on el.id = cur.education_level_id and el.name = '1èreC'
cross join lateral (values
  ('Réactions d''oxydoréduction en solution aqueuse', 1, 4),
  ('Classification qualitative des couples oxydant / réducteur', 2, 5),
  ('Classification quantitative des couples oxydant / réducteur', 3, 3),
  ('Couples oxydant / réducteur en solution aqueuse. Dosage', 4, 4),
  ('Oxydoréduction par voie sèche', 5, 3.5),
  ('Électrolyse', 6, 4),
  ('Corrosion et protection des métaux', 7, 2.5)
) as v(title, ordering, hours)
where p.title = 'Chimie — Oxydoréduction' and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and el.name = '1èreC';

insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select ranked.curriculum_id, ranked.id, v.week, ranked.ordering
from (
  select cu.id, cu.curriculum_id, cu.ordering,
    row_number() over (
      partition by cu.curriculum_id
      order by (select p.ordering from curriculum_units p where p.id = coalesce(cu.parent_unit_id, cu.id)), cu.ordering
    ) as rn
  from curriculum_units cu
  join curricula cur on cur.id = cu.curriculum_id
  join subjects s on s.id = cur.subject_id and s.name = 'Physique-Chimie'
  join education_levels el on el.id = cur.education_level_id and el.name = '1èreC'
  where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and el.name = '1èreC' and cu.parent_unit_id is not null
) ranked
join (values
  (1,1),(2,4),(3,7),(4,9),(5,9),
  (6,13),(7,15),(8,15),(9,17),(10,18),
  (11,23),(12,24),(13,26),
  (14,1),(15,3),(16,4),(17,7),(18,9),(19,10),(20,11),(21,14),
  (22,18),(23,20),(24,21),(25,24),(26,26),(27,27),(28,28)) as v(ordering, week) on v.ordering = ranked.rn;

-- 6.3 Physique-Chimie — Première D
insert into curriculum_units (curriculum_id, title, ordering)
select cur.id, v.title, v.ordering
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'Physique-Chimie'
join education_levels el on el.id = cur.education_level_id and el.name = '1èreD'
cross join lateral (values
  ('Physique — Mécanique', 1), ('Physique — Électricité et électronique', 2), ('Physique — Optique', 3),
  ('Chimie — Chimie organique', 4), ('Chimie — Oxydoréduction', 5)
) as v(title, ordering)
where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and el.name = '1èreD';

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering, recommended_hours)
select p.curriculum_id, p.id, v.title, v.ordering, v.hours
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Physique-Chimie'
join education_levels el on el.id = cur.education_level_id and el.name = '1èreD'
cross join lateral (values
  ('Travail et puissance d''une force constante dans le cas d''un mouvement de translation', 1, 8),
  ('Énergie cinétique', 2, 8),
  ('Énergie potentielle de pesanteur', 3, 4),
  ('Énergie mécanique', 4, 6)
) as v(title, ordering, hours)
where p.title = 'Physique — Mécanique' and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and el.name = '1èreD';

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering, recommended_hours)
select p.curriculum_id, p.id, v.title, v.ordering, v.hours
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Physique-Chimie'
join education_levels el on el.id = cur.education_level_id and el.name = '1èreD'
cross join lateral (values
  ('Champ électrostatique', 1, 4),
  ('Énergie potentielle électrostatique', 2, 3),
  ('Puissance et énergie électriques', 3, 6),
  ('Le condensateur', 4, 6),
  ('L''amplificateur opérationnel', 5, 8)
) as v(title, ordering, hours)
where p.title = 'Physique — Électricité et électronique' and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and el.name = '1èreD';

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering, recommended_hours)
select p.curriculum_id, p.id, v.title, v.ordering, v.hours
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Physique-Chimie'
join education_levels el on el.id = cur.education_level_id and el.name = '1èreD'
cross join lateral (values
  ('Introduction à l''optique géométrique', 1, 2),
  ('Réflexion, réfraction de la lumière blanche', 2, 8),
  ('Les lentilles minces', 3, 8)
) as v(title, ordering, hours)
where p.title = 'Physique — Optique' and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and el.name = '1èreD';

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering, recommended_hours)
select p.curriculum_id, p.id, v.title, v.ordering, v.hours
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Physique-Chimie'
join education_levels el on el.id = cur.education_level_id and el.name = '1èreD'
cross join lateral (values
  ('Généralités sur les composés organiques', 1, 4),
  ('Hydrocarbures saturés : les alcanes', 2, 4),
  ('Hydrocarbures insaturés : les alcènes et les alcynes', 3, 3.5),
  ('Le benzène', 4, 2.5),
  ('Pétrole et gaz naturels', 5, 2),
  ('Quelques composés oxygénés', 6, 4),
  ('L''éthanol', 7, 3),
  ('Estérification et hydrolyse d''un ester', 8, 4)
) as v(title, ordering, hours)
where p.title = 'Chimie — Chimie organique' and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and el.name = '1èreD';

insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering, recommended_hours)
select p.curriculum_id, p.id, v.title, v.ordering, v.hours
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
join subjects s on s.id = cur.subject_id and s.name = 'Physique-Chimie'
join education_levels el on el.id = cur.education_level_id and el.name = '1èreD'
cross join lateral (values
  ('Réactions d''oxydoréduction en solution aqueuse', 1, 2),
  ('Classification qualitative des couples oxydant / réducteur', 2, 5),
  ('Classification quantitative des couples oxydant / réducteur', 3, 1),
  ('Couples oxydant / réducteur en solution aqueuse. Dosage', 4, 4),
  ('Oxydoréduction par voie sèche', 5, 2),
  ('Électrolyse', 6, 4)
) as v(title, ordering, hours)
where p.title = 'Chimie — Oxydoréduction' and cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and el.name = '1èreD';

insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select ranked.curriculum_id, ranked.id, v.week, ranked.ordering
from (
  select cu.id, cu.curriculum_id, cu.ordering,
    row_number() over (
      partition by cu.curriculum_id
      order by (select p.ordering from curriculum_units p where p.id = coalesce(cu.parent_unit_id, cu.id)), cu.ordering
    ) as rn
  from curriculum_units cu
  join curricula cur on cur.id = cu.curriculum_id
  join subjects s on s.id = cur.subject_id and s.name = 'Physique-Chimie'
  join education_levels el on el.id = cur.education_level_id and el.name = '1èreD'
  where cur.version_label = 'DPFC 2025-2026 (contenu reconduit)' and el.name = '1èreD' and cu.parent_unit_id is not null
) ranked
join (values
  (1,1),(2,4),(3,7),(4,8),
  (5,12),(6,14),(7,16),(8,17),(9,20),
  (10,22),(11,23),(12,26),
  (13,1),(14,3),(15,5),(16,7),(17,9),(18,9),(19,12),(20,14),
  (21,16),(22,17),(23,19),(24,22),(25,25),(26,26)) as v(ordering, week) on v.ordering = ranked.rn;

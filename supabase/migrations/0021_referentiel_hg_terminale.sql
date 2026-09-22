-- ============================================================================
-- 0021_referentiel_hg_terminale.sql
-- Dixième enrichissement réel du référentiel (EF-REF-02), à la demande
-- explicite de l'utilisateur ("faisons HG" — Histoire-Géographie 1ère/Tle,
-- seule lacune restante identifiée dans les lots précédents pour cette
-- matière).
--
-- RECHERCHE MENÉE (15 août 2026) sur les deux pages officielles DPFC :
-- - "Progressions du Secondaire 2025-2026" (https://dpfc-ci.net/?page_id=5267) :
--   liste 13 matières avec un document daté 2025-2026, mais **aucune entrée
--   Histoire-Géographie au-delà de la 6e** ("HG, Progressions (6è) Nouveau
--   programme 2025-2026" est la seule ligne HG de cette page).
-- - "Programmes éducatifs et guides d'exécution du Secondaire"
--   (https://dpfc-ci.net/?page_id=283), rubrique Histoire-Géographie : les
--   entrées "2nde" et "1ère" y figurent **sans aucun lien hypertexte** (à la
--   différence de 6e/5e/4e/3e qui ont chacune un PDF) — confirmation qu'à ce
--   jour la DPFC n'a publié aucun programme éducatif ni aucune progression
--   pour l'Histoire-Géographie de 2nde et de 1ère, sous quelque forme que ce
--   soit. Seule l'entrée "Tle" a un lien, vers un document 2018-2019
--   ("PROGR_ED_HG_2018-2019_TLE_APC.pdf", programme éducatif "Tle A-C-D").
--
-- DÉCISION PRISE DANS CE LOT : la Terminale est donc chargée (seule source
-- disponible, même ancienne — même principe que la Physique-Chimie 2nde
-- série C en migration 0016, où une source non republiée avait déjà été
-- utilisée telle quelle en la datant honnêtement) ; **la 2nde et la 1ère
-- restent volontairement non chargées**, faute de toute source DPFC, plutôt
-- que d'improviser un contenu non sourcé (Convention §19). Le
-- `version_label` précise explicitement "2018-2019" pour ne jamais laisser
-- croire à un contenu 2025-2026.
--
-- SOURCE : https://dpfc-ci.net/wp-content/uploads//dpfc_fichiers/2018-2019/programmes_guides/HisToire_Geographie/PROGR_ED_HG_2018-2019_TLE_APC.pdf
-- (programme éducatif "Terminale A-C-D", avec sa propre progression annuelle
-- hebdomadaire pour l'Histoire et pour la Géographie, comme la 3e en 0015).
--
-- NIVEAUX CIBLÉS : TerminaleA1/A2/C/D (le document couvre "A-C-D", pas de
-- série E — filières techniques hors périmètre, cf. migration 0018).
--
-- MODÉLISATION : même pattern que la 3e (migration 0015) — deux domaines
-- parents (Histoire / Géographie) contenant chacun des Thèmes eux-mêmes
-- parents de Leçons (curriculum_units à deux niveaux, `parent_unit_id`).
-- `expected_week` recopié directement de la "PROGRESSION ANNUELLE" donnée
-- par le document pour chaque discipline (semaine de première apparition
-- de chaque leçon), jamais interpolé ici — contrairement aux lots
-- précédents, ce document donne un tableau hebdomadaire explicite.
--
-- CAS PARTICULIER — Géographie, Thème 2 : le document prévoit des "LEÇONS
-- TOURNANTES" alternées par cycle ("2018-2021 : Étude économique de la
-- France ; 2021-2024 : Étude économique de la Corée du Sud"), un cycle
-- désormais expiré sans qu'aucune source ne précise ce qui s'applique pour
-- 2026-2027. Plutôt que de deviner laquelle des deux options est en vigueur,
-- les deux leçons sont recopiées sous un intitulé mentionnant explicitement
-- les deux pays possibles, même principe que la leçon alternante
-- Biafra/Rwanda de la 3e (migration 0015, Convention §19) — libre au
-- professeur de retenir l'option pertinente.
--
-- NON COUVERT DANS CE LOT : Histoire-Géographie 2nde et 1ère (aucune source
-- DPFC identifiée, à réexaminer si la DPFC publie un jour un document dédié) ;
-- EDHC, Arts Plastiques, Éducation Musicale, EPS, TICE (toujours en attente,
-- cf. migration 0020). Pas testé en conditions réelles (mêmes limites
-- d'environnement que tous les lots précédents — pas de `supabase db push`
-- possible ici).
-- ============================================================================

insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id, 'DPFC 2018-2019 (programme éducatif, dernière version disponible)',
  'https://dpfc-ci.net/wp-content/uploads//dpfc_fichiers/2018-2019/programmes_guides/HisToire_Geographie/PROGR_ED_HG_2018-2019_TLE_APC.pdf', true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id
  and el.name in ('TerminaleA1', 'TerminaleA2', 'TerminaleC', 'TerminaleD')
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'Histoire-Géographie'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

-- 1. Domaines parents (Histoire / Géographie, 3 thèmes chacun)
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
  ('Géographie — Thème 2 : Étude économique d''un pays développé ou émergent (France ou Corée du Sud, cycle DPFC)', 5),
  ('Géographie — Thème 3 : Regroupement et coopération économique', 6)
) as v(title, ordering)
where cur.version_label = 'DPFC 2018-2019 (programme éducatif, dernière version disponible)';

-- 2. Histoire — Thème 1
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
  and cur.version_label = 'DPFC 2018-2019 (programme éducatif, dernière version disponible)';

-- 3. Histoire — Thème 2
insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering, recommended_hours)
select p.curriculum_id, p.id, v.title, v.ordering, v.hours
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
cross join lateral (values
  ('Leçon 1 : La montée des nationalismes en Afrique', 1, 3),
  ('Leçon 2 : L''accession de la Côte d''Ivoire à l''indépendance', 2, 4),
  ('Leçon 3 : L''accession de l''Algérie à l''indépendance', 3, 4),
  ('Leçon 4 : L''Union Africaine', 4, 3)
) as v(title, ordering, hours)
where p.title = 'Histoire — Thème 2 : De la décolonisation aux efforts d''organisation de l''Afrique'
  and cur.version_label = 'DPFC 2018-2019 (programme éducatif, dernière version disponible)';

-- 4. Histoire — Thème 3
insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering, recommended_hours)
select p.curriculum_id, p.id, v.title, v.ordering, v.hours
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
cross join lateral (values
  ('Leçon 1 : Croyances et valeurs dominantes dans le monde occidental', 1, 3),
  ('Leçon 2 : Les mutations contemporaines de la civilisation négro-africaine', 2, 3)
) as v(title, ordering, hours)
where p.title = 'Histoire — Thème 3 : Croyances et valeurs dans le monde d''aujourd''hui'
  and cur.version_label = 'DPFC 2018-2019 (programme éducatif, dernière version disponible)';

-- 5. Géographie — Thème 1
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
  and cur.version_label = 'DPFC 2018-2019 (programme éducatif, dernière version disponible)';

-- 6. Géographie — Thème 2 (leçons tournantes, cf. note en tête de fichier)
insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering, recommended_hours)
select p.curriculum_id, p.id, v.title, v.ordering, v.hours
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
cross join lateral (values
  ('Leçon 1 (tournante) : Les fondements économiques du pays retenu (France ou Corée du Sud)', 1, 3),
  ('Leçon 2 (tournante) : Une économie dominée par le tertiaire / une puissance émergente (France ou Corée du Sud)', 2, 3)
) as v(title, ordering, hours)
where p.title = 'Géographie — Thème 2 : Étude économique d''un pays développé ou émergent (France ou Corée du Sud, cycle DPFC)'
  and cur.version_label = 'DPFC 2018-2019 (programme éducatif, dernière version disponible)';

-- 7. Géographie — Thème 3
insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering, recommended_hours)
select p.curriculum_id, p.id, v.title, v.ordering, v.hours
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
cross join lateral (values
  ('Leçon 1 : La CEDEAO, une organisation régionale à caractère économique', 1, 4),
  ('Leçon 2 : Les relations UE/ACP, un exemple de coopération Nord-Sud', 2, 4)
) as v(title, ordering, hours)
where p.title = 'Géographie — Thème 3 : Regroupement et coopération économique'
  and cur.version_label = 'DPFC 2018-2019 (programme éducatif, dernière version disponible)';

-- 8. Semaines officielles (recopiées telles quelles des deux tableaux
-- "PROGRESSION ANNUELLE" du document, une entrée par (parent, ordering))
insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select cu.curriculum_id, cu.id, v.week, v.ordering
from curriculum_units cu
join curricula cur on cur.id = cu.curriculum_id
join (values
  ('Histoire — Thème 1 : Les relations internationales de 1945 à nos jours', 1, 1),
  ('Histoire — Thème 1 : Les relations internationales de 1945 à nos jours', 2, 4),
  ('Histoire — Thème 1 : Les relations internationales de 1945 à nos jours', 3, 9),
  ('Histoire — Thème 2 : De la décolonisation aux efforts d''organisation de l''Afrique', 1, 13),
  ('Histoire — Thème 2 : De la décolonisation aux efforts d''organisation de l''Afrique', 2, 14),
  ('Histoire — Thème 2 : De la décolonisation aux efforts d''organisation de l''Afrique', 3, 17),
  ('Histoire — Thème 2 : De la décolonisation aux efforts d''organisation de l''Afrique', 4, 23),
  ('Histoire — Thème 3 : Croyances et valeurs dans le monde d''aujourd''hui', 1, 25),
  ('Histoire — Thème 3 : Croyances et valeurs dans le monde d''aujourd''hui', 2, 28),
  ('Géographie — Thème 1 : La Côte d''Ivoire, étude économique', 1, 1),
  ('Géographie — Thème 1 : La Côte d''Ivoire, étude économique', 2, 6),
  ('Géographie — Thème 1 : La Côte d''Ivoire, étude économique', 3, 14),
  ('Géographie — Thème 2 : Étude économique d''un pays développé ou émergent (France ou Corée du Sud, cycle DPFC)', 1, 16),
  ('Géographie — Thème 2 : Étude économique d''un pays développé ou émergent (France ou Corée du Sud, cycle DPFC)', 2, 22),
  ('Géographie — Thème 3 : Regroupement et coopération économique', 1, 24),
  ('Géographie — Thème 3 : Regroupement et coopération économique', 2, 27)
) as v(parent_title, ordering, week)
  on v.ordering = cu.ordering
  and v.parent_title = (select p.title from curriculum_units p where p.id = cu.parent_unit_id)
where cur.version_label = 'DPFC 2018-2019 (programme éducatif, dernière version disponible)'
  and cu.parent_unit_id is not null;

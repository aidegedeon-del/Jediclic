-- ============================================================================
-- 0022_referentiel_hg_2nde_1ere.sql
-- Onzième enrichissement réel du référentiel (EF-REF-02), à la demande
-- explicite de l'utilisateur, qui a demandé de pousser la recherche de
-- source au-delà de ce qui avait été trouvé en migration 0021 ("cherche
-- plus loin, remonte dans les années antérieures").
--
-- RECHERCHE MENÉE (15 août 2026) : en remontant les archives DPFC par
-- année scolaire plutôt que par la seule page "Programmes éducatifs et
-- guides d'exécution" (qui liste HG 2nde/1ère sans lien, comme constaté en
-- 0021), un document distinct existe : la "Coordination Nationale
-- Disciplinaire Histoire-Géographie" publie chaque année un document combiné
-- "PROGRESSIONS ANNUELLES (PREMIER ET SECOND CYCLES)" couvrant la 6e à la
-- Terminale en un seul PDF — retrouvé pour 2021-2022, 2022-2023, 2023-2024
-- et 2024-2025 directement hébergés sur dpfc-ci.net (ex.
-- https://dpfc-ci.net/progressions/2024-2025/HG_PROGRESSION%202024-2025.pdf),
-- chacun signé par le même coordonnateur national (Diké Guillaume YOBOUET).
-- Ce document couvre systématiquement 2nde et 1ère (Histoire ET Géographie,
-- progression hebdomadaire complète), contrairement au programme éducatif
-- 2018-2019 utilisé en 0021 pour la seule Terminale.
--
-- VERSION 2025-2026 : la même Coordination a bien produit une édition
-- 2025-2026 de ce document (même en-tête officiel, même signature "Diké
-- Guillaume YOBOUET"), mais elle n'apparaît pas parmi les liens de la page
-- officielle "Progressions du Secondaire 2025-2026"
-- (https://dpfc-ci.net/?page_id=5267), qui ne référence HG que pour la 6e
-- cette année — vraisemblablement un oubli de publication sur le site
-- officiel plutôt qu'une absence de production, puisque les éditions
-- précédentes (2021-2022 à 2024-2025) y figurent chacune. Faute de trouver
-- cette édition 2025-2026 hébergée sur le domaine officiel dpfc-ci.net au
-- moment de la recherche, elle a été consultée via une republication de
-- fomesoutra.com (plateforme de documentation scolaire ivoirienne), dont le
-- contenu, la mise en forme et la signature du coordonnateur national sont
-- identiques aux éditions officielles hébergées directement sur dpfc-ci.net
-- les années précédentes — ce n'est donc pas assimilé à une source
-- enseignant individuelle, mais à une republication du même document
-- officiel. `version_label` le précise honnêtement.
--
-- SOURCE (contenu chargé dans ce lot) :
--   "Coordination Nationale Disciplinaire Histoire-Géographie — Progressions
--   annuelles (premier et second cycles) 2025-2026", consultée via
--   https://www.fomesoutra.com/espace-prof/prof-histoire-geographique/progressions-hg/22662-hg-progression-2025-2026-by-tehua/file
--   (republication ; document identique en format/signature aux éditions
--   2021-2022 à 2024-2025 hébergées directement sur dpfc-ci.net).
--
-- PÉRIMÈTRE DE CE LOT : seuls les niveaux 2nde et 1ère sont chargés ici (6e
-- à 3e déjà couverts par 0012-0015 via une source différente ; Terminale
-- déjà couverte par 0021). Le document ne distingue aucune série pour ces
-- deux niveaux ("PROGRESSION ANNUELLE D'HISTOIRE 2nde", pas de A/C séparé)
-- — même situation que Français/Anglais/Allemand/Espagnol en 2nde (0016,
-- 0020) : contenu dupliqué vers 2ndeA/2ndeC et vers 1èreA1/1èreA2/1èreC/
-- 1èreD, jamais rattaché à une ligne générique inutilisée.
--
-- MODÉLISATION : même pattern que 3e (0015) et Terminale (0021) — deux
-- domaines parents (Histoire / Géographie) contenant chacun des Thèmes,
-- eux-mêmes parents de Leçons. `expected_week` recopié directement des
-- deux tableaux "PROGRESSION ANNUELLE" du document (semaine de première
-- apparition de chaque leçon), jamais interpolé ici — le document donne un
-- calendrier hebdomadaire explicite comme pour la Terminale. Les séances de
-- régulation/remédiation/évaluation ne sont pas modélisées comme des
-- curriculum_units séparées (ce sont des révisions, pas du contenu
-- nouveau), même principe que tous les lots précédents.
--
-- NON COUVERT DANS CE LOT : EDHC, Arts Plastiques, Éducation Musicale, EPS,
-- TICE (toujours en attente, cf. 0020) ; Français/Histoire-Géographie pour
-- la Terminale ne sont pas retouchés ici (0021 reste la source utilisée
-- pour Tle, non remplacée par cette découverte — à réévaluer séparément si
-- l'utilisateur le souhaite, puisque ce nouveau document couvre aussi la
-- Terminale avec une source plus récente que 2018-2019). Pas testé en
-- conditions réelles (mêmes limites d'environnement que tous les lots
-- précédents — pas de `supabase db push` possible ici).
-- ============================================================================

-- ============================================================================
-- A. HISTOIRE-GEOGRAPHIE — 2nde (2ndeA et 2ndeC, contenu identique)
-- ============================================================================

insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id,
  'DPFC 2025-2026 (Coordination Nationale Disciplinaire HG — republication fomesoutra.com, non retrouvée hébergée directement sur dpfc-ci.net)',
  'https://www.fomesoutra.com/espace-prof/prof-histoire-geographique/progressions-hg/22662-hg-progression-2025-2026-by-tehua/file',
  true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name in ('2ndeA', '2ndeC')
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'Histoire-Géographie'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

-- A.1 Domaines parents (Histoire / Géographie, 3 thèmes chacun)
insert into curriculum_units (curriculum_id, title, ordering)
select cur.id, v.title, v.ordering
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'Histoire-Géographie'
join education_levels el on el.id = cur.education_level_id and el.name in ('2ndeA', '2ndeC')
cross join lateral (values
  ('Histoire — Thème 1 : L''objet de l''histoire et la démarche historique', 1),
  ('Histoire — Thème 2 : Civilisations et échanges en Afrique et dans le reste du monde, de la préhistoire au XIXe siècle', 2),
  ('Histoire — Thème 3 : Les civilisations des peuples de Côte d''Ivoire, des origines au XIXe siècle', 3),
  ('Géographie — Thème 1 : La terre, domaine privilégié de la géographie', 4),
  ('Géographie — Thème 2 : L''homme et son milieu en Côte d''Ivoire', 5),
  ('Géographie — Thème 3 : L''ingéniosité de l''homme dans la réalisation du développement durable et la préservation de l''espace mondial', 6)
) as v(title, ordering)
where cur.version_label like 'DPFC 2025-2026 (Coordination Nationale Disciplinaire HG%';

-- A.2 Histoire — Thème 1
insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering, recommended_hours)
select p.curriculum_id, p.id, v.title, v.ordering, v.hours
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
cross join lateral (values
  ('Leçon 1 : L''Histoire et la formation du citoyen', 1, 3),
  ('Leçon 2 : Les méthodes d''étude de l''histoire', 2, 2),
  ('Leçon 3 : La méthodologie de la dissertation, du commentaire de document et de la situation d''évaluation', 3, 5)
) as v(title, ordering, hours)
where p.title = 'Histoire — Thème 1 : L''objet de l''histoire et la démarche historique'
  and cur.version_label like 'DPFC 2025-2026 (Coordination Nationale Disciplinaire HG%';

-- A.3 Histoire — Thème 2
insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering, recommended_hours)
select p.curriculum_id, p.id, v.title, v.ordering, v.hours
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
cross join lateral (values
  ('Leçon 1 : La préhistoire en Afrique et dans le reste du monde', 1, 2),
  ('Leçon 2 : La civilisation de l''Egypte ancienne', 2, 2),
  ('Leçon 3 : La démocratie athénienne', 3, 2),
  ('Leçon 4 : La civilisation du Soudan Occidental au moyen-âge', 4, 2),
  ('Leçon 5 : Les traites des Noirs', 5, 3)
) as v(title, ordering, hours)
where p.title = 'Histoire — Thème 2 : Civilisations et échanges en Afrique et dans le reste du monde, de la préhistoire au XIXe siècle'
  and cur.version_label like 'DPFC 2025-2026 (Coordination Nationale Disciplinaire HG%';

-- A.4 Histoire — Thème 3
insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering, recommended_hours)
select p.curriculum_id, p.id, v.title, v.ordering, v.hours
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
cross join lateral (values
  ('Leçon 1 : La révolution du néolithique en Côte d''Ivoire', 1, 2),
  ('Leçon 2 : Les peuples de Côte d''Ivoire : diversité et unité', 2, 6)
) as v(title, ordering, hours)
where p.title = 'Histoire — Thème 3 : Les civilisations des peuples de Côte d''Ivoire, des origines au XIXe siècle'
  and cur.version_label like 'DPFC 2025-2026 (Coordination Nationale Disciplinaire HG%';

-- A.5 Géographie — Thème 1
insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering, recommended_hours)
select p.curriculum_id, p.id, v.title, v.ordering, v.hours
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
cross join lateral (values
  ('Leçon 1 : La géographie, objet, intérêt et démarche', 1, 2),
  ('Leçon 2 : La planète terre', 2, 4),
  ('Leçon 3 : Les techniques de représentation de la terre', 3, 4)
) as v(title, ordering, hours)
where p.title = 'Géographie — Thème 1 : La terre, domaine privilégié de la géographie'
  and cur.version_label like 'DPFC 2025-2026 (Coordination Nationale Disciplinaire HG%';

-- A.6 Géographie — Thème 2
insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering, recommended_hours)
select p.curriculum_id, p.id, v.title, v.ordering, v.hours
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
cross join lateral (values
  ('Leçon 1 : Le milieu subéquatorial ivoirien', 1, 3),
  ('Leçon 2 : Le milieu tropical ivoirien', 2, 3),
  ('Leçon 3 : L''espace ivoirien, un environnement menacé', 3, 4)
) as v(title, ordering, hours)
where p.title = 'Géographie — Thème 2 : L''homme et son milieu en Côte d''Ivoire'
  and cur.version_label like 'DPFC 2025-2026 (Coordination Nationale Disciplinaire HG%';

-- A.7 Géographie — Thème 3
insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering, recommended_hours)
select p.curriculum_id, p.id, v.title, v.ordering, v.hours
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
cross join lateral (values
  ('Leçon 1 : Les grands milieux biogéographiques dans le monde', 1, 3),
  ('Leçon 2 : Les problèmes environnementaux actuels', 2, 2)
) as v(title, ordering, hours)
where p.title = 'Géographie — Thème 3 : L''ingéniosité de l''homme dans la réalisation du développement durable et la préservation de l''espace mondial'
  and cur.version_label like 'DPFC 2025-2026 (Coordination Nationale Disciplinaire HG%';

-- A.8 Semaines officielles 2nde
insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select cu.curriculum_id, cu.id, v.week, v.ordering
from curriculum_units cu
join curricula cur on cur.id = cu.curriculum_id
join (values
  ('Histoire — Thème 1 : L''objet de l''histoire et la démarche historique', 1, 1),
  ('Histoire — Thème 1 : L''objet de l''histoire et la démarche historique', 2, 3),
  ('Histoire — Thème 1 : L''objet de l''histoire et la démarche historique', 3, 7),
  ('Histoire — Thème 2 : Civilisations et échanges en Afrique et dans le reste du monde, de la préhistoire au XIXe siècle', 1, 9),
  ('Histoire — Thème 2 : Civilisations et échanges en Afrique et dans le reste du monde, de la préhistoire au XIXe siècle', 2, 10),
  ('Histoire — Thème 2 : Civilisations et échanges en Afrique et dans le reste du monde, de la préhistoire au XIXe siècle', 3, 13),
  ('Histoire — Thème 2 : Civilisations et échanges en Afrique et dans le reste du monde, de la préhistoire au XIXe siècle', 4, 14),
  ('Histoire — Thème 2 : Civilisations et échanges en Afrique et dans le reste du monde, de la préhistoire au XIXe siècle', 5, 17),
  ('Histoire — Thème 3 : Les civilisations des peuples de Côte d''Ivoire, des origines au XIXe siècle', 1, 20),
  ('Histoire — Thème 3 : Les civilisations des peuples de Côte d''Ivoire, des origines au XIXe siècle', 2, 24),
  ('Géographie — Thème 1 : La terre, domaine privilégié de la géographie', 1, 1),
  ('Géographie — Thème 1 : La terre, domaine privilégié de la géographie', 2, 3),
  ('Géographie — Thème 1 : La terre, domaine privilégié de la géographie', 3, 7),
  ('Géographie — Thème 2 : L''homme et son milieu en Côte d''Ivoire', 1, 11),
  ('Géographie — Thème 2 : L''homme et son milieu en Côte d''Ivoire', 2, 13),
  ('Géographie — Thème 2 : L''homme et son milieu en Côte d''Ivoire', 3, 17),
  ('Géographie — Thème 3 : L''ingéniosité de l''homme dans la réalisation du développement durable et la préservation de l''espace mondial', 1, 22),
  ('Géographie — Thème 3 : L''ingéniosité de l''homme dans la réalisation du développement durable et la préservation de l''espace mondial', 2, 26)
) as v(parent_title, ordering, week)
  on v.ordering = cu.ordering
  and v.parent_title = (select p.title from curriculum_units p where p.id = cu.parent_unit_id)
where cur.version_label like 'DPFC 2025-2026 (Coordination Nationale Disciplinaire HG%'
  and cu.parent_unit_id is not null
  and cur.education_level_id in (select id from education_levels where name in ('2ndeA', '2ndeC'));

-- ============================================================================
-- B. HISTOIRE-GEOGRAPHIE — 1ère (1èreA1/1èreA2/1èreC/1èreD, contenu identique)
-- ============================================================================

insert into curricula (education_level_id, subject_id, school_year_id, version_label, source_document_url, is_active)
select el.id, s.id, sy.id,
  'DPFC 2025-2026 (Coordination Nationale Disciplinaire HG — republication fomesoutra.com, non retrouvée hébergée directement sur dpfc-ci.net)',
  'https://www.fomesoutra.com/espace-prof/prof-histoire-geographique/progressions-hg/22662-hg-progression-2025-2026-by-tehua/file',
  true
from education_levels el
join education_cycles ec on ec.id = el.cycle_id and el.name in ('1èreA1', '1èreA2', '1èreC', '1èreD')
join education_systems es on es.id = ec.education_system_id
join countries c on c.id = es.country_id and c.iso_code = 'CI'
join subjects s on s.education_system_id = es.id and s.name = 'Histoire-Géographie'
join school_years sy on sy.country_id = c.id and sy.label = '2026-2027'
on conflict do nothing;

-- B.1 Domaines parents (Histoire / Géographie)
insert into curriculum_units (curriculum_id, title, ordering)
select cur.id, v.title, v.ordering
from curricula cur
join subjects s on s.id = cur.subject_id and s.name = 'Histoire-Géographie'
join education_levels el on el.id = cur.education_level_id and el.name in ('1èreA1', '1èreA2', '1èreC', '1èreD')
cross join lateral (values
  ('Histoire — Thème 1 : Le développement du capitalisme et l''industrialisation de l''Europe du XVIIIe au XIXe siècle', 1),
  ('Histoire — Thème 2 : L''impérialisme en Afrique du XIXe à la première moitié du XXe siècle', 2),
  ('Histoire — Thème 3 : Les guerres et les violences de masse du XXe siècle à nos jours', 3),
  ('Géographie — Thème 1 : Dynamisme démographique de la Côte d''Ivoire et dans le monde', 4),
  ('Géographie — Thème 2 : L''urbanisation dans le monde', 5),
  ('Géographie — Thème 3 : L''administration et l''aménagement du territoire ivoirien', 6),
  ('Géographie — Thème 4 : Le processus de la mondialisation', 7)
) as v(title, ordering)
where cur.version_label like 'DPFC 2025-2026 (Coordination Nationale Disciplinaire HG%'
  and cur.education_level_id in (select id from education_levels where name in ('1èreA1', '1èreA2', '1èreC', '1èreD'));

-- B.2 Histoire — Thème 1
insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering, recommended_hours)
select p.curriculum_id, p.id, v.title, v.ordering, v.hours
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
cross join lateral (values
  ('Leçon 1 : L''essor du capitalisme et ses conséquences', 1, 4),
  ('Leçon 2 : Les révolutions industrielles', 2, 3)
) as v(title, ordering, hours)
where p.title = 'Histoire — Thème 1 : Le développement du capitalisme et l''industrialisation de l''Europe du XVIIIe au XIXe siècle'
  and cur.version_label like 'DPFC 2025-2026 (Coordination Nationale Disciplinaire HG%';

-- B.3 Histoire — Thème 2
insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering, recommended_hours)
select p.curriculum_id, p.id, v.title, v.ordering, v.hours
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
cross join lateral (values
  ('Leçon 1 : Le mouvement impérialiste et le congrès de Berlin', 1, 3),
  ('Leçon 2 : Les résistances aux conquêtes territoriales, exemple de la Côte d''Ivoire de 1848 à 1920', 2, 4),
  ('Leçon 3 : La colonisation et les résistances en Côte d''Ivoire de 1893 à 1946', 3, 4)
) as v(title, ordering, hours)
where p.title = 'Histoire — Thème 2 : L''impérialisme en Afrique du XIXe à la première moitié du XXe siècle'
  and cur.version_label like 'DPFC 2025-2026 (Coordination Nationale Disciplinaire HG%';

-- B.4 Histoire — Thème 3
insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering, recommended_hours)
select p.curriculum_id, p.id, v.title, v.ordering, v.hours
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
cross join lateral (values
  ('Leçon 1 : La première Guerre Mondiale, causes et conséquences', 1, 4),
  ('Leçon 2 : La deuxième Guerre Mondiale, causes et conséquences', 2, 4),
  ('Leçon 3 : Les violences de masse, les génocides du XXe siècle à nos jours', 3, 3)
) as v(title, ordering, hours)
where p.title = 'Histoire — Thème 3 : Les guerres et les violences de masse du XXe siècle à nos jours'
  and cur.version_label like 'DPFC 2025-2026 (Coordination Nationale Disciplinaire HG%';

-- B.5 Géographie — Thème 1
insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering, recommended_hours)
select p.curriculum_id, p.id, v.title, v.ordering, v.hours
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
cross join lateral (values
  ('Leçon 1 : Dynamisme démographique et qualité de la vie en Côte d''Ivoire', 1, 6),
  ('Leçon 2 : La croissance démographique mondiale et ses conséquences', 2, 4)
) as v(title, ordering, hours)
where p.title = 'Géographie — Thème 1 : Dynamisme démographique de la Côte d''Ivoire et dans le monde'
  and cur.version_label like 'DPFC 2025-2026 (Coordination Nationale Disciplinaire HG%';

-- B.6 Géographie — Thème 2
insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering, recommended_hours)
select p.curriculum_id, p.id, v.title, v.ordering, v.hours
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
cross join lateral (values
  ('Leçon 1 : L''urbanisation dans les pays en développement, l''exemple de la Côte d''Ivoire', 1, 4),
  ('Leçon 2 : L''urbanisation dans les pays développés, l''exemple de la France', 2, 3)
) as v(title, ordering, hours)
where p.title = 'Géographie — Thème 2 : L''urbanisation dans le monde'
  and cur.version_label like 'DPFC 2025-2026 (Coordination Nationale Disciplinaire HG%';

-- B.7 Géographie — Thème 3
insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering, recommended_hours)
select p.curriculum_id, p.id, v.title, v.ordering, v.hours
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
cross join lateral (values
  ('Leçon 1 : L''organisation administrative de la Côte d''Ivoire', 1, 3),
  ('Leçon 2 : L''aménagement du territoire ivoirien', 2, 4)
) as v(title, ordering, hours)
where p.title = 'Géographie — Thème 3 : L''administration et l''aménagement du territoire ivoirien'
  and cur.version_label like 'DPFC 2025-2026 (Coordination Nationale Disciplinaire HG%';

-- B.8 Géographie — Thème 4
insert into curriculum_units (curriculum_id, parent_unit_id, title, ordering, recommended_hours)
select p.curriculum_id, p.id, v.title, v.ordering, v.hours
from curriculum_units p
join curricula cur on cur.id = p.curriculum_id
cross join lateral (values
  ('Leçon 1 : La mondialisation, facteurs et acteurs', 1, 3),
  ('Leçon 2 : La mondialisation, manifestations et conséquences', 2, 2)
) as v(title, ordering, hours)
where p.title = 'Géographie — Thème 4 : Le processus de la mondialisation'
  and cur.version_label like 'DPFC 2025-2026 (Coordination Nationale Disciplinaire HG%';

-- B.9 Semaines officielles 1ère
insert into official_progression_steps (curriculum_id, curriculum_unit_id, expected_week, ordering)
select cu.curriculum_id, cu.id, v.week, v.ordering
from curriculum_units cu
join curricula cur on cur.id = cu.curriculum_id
join (values
  ('Histoire — Thème 1 : Le développement du capitalisme et l''industrialisation de l''Europe du XVIIIe au XIXe siècle', 1, 1),
  ('Histoire — Thème 1 : Le développement du capitalisme et l''industrialisation de l''Europe du XVIIIe au XIXe siècle', 2, 4),
  ('Histoire — Thème 2 : L''impérialisme en Afrique du XIXe à la première moitié du XXe siècle', 1, 8),
  ('Histoire — Thème 2 : L''impérialisme en Afrique du XIXe à la première moitié du XXe siècle', 2, 10),
  ('Histoire — Thème 2 : L''impérialisme en Afrique du XIXe à la première moitié du XXe siècle', 3, 14),
  ('Histoire — Thème 3 : Les guerres et les violences de masse du XXe siècle à nos jours', 1, 18),
  ('Histoire — Thème 3 : Les guerres et les violences de masse du XXe siècle à nos jours', 2, 22),
  ('Histoire — Thème 3 : Les guerres et les violences de masse du XXe siècle à nos jours', 3, 26),
  ('Géographie — Thème 1 : Dynamisme démographique de la Côte d''Ivoire et dans le monde', 1, 1),
  ('Géographie — Thème 1 : Dynamisme démographique de la Côte d''Ivoire et dans le monde', 2, 6),
  ('Géographie — Thème 2 : L''urbanisation dans le monde', 1, 10),
  ('Géographie — Thème 2 : L''urbanisation dans le monde', 2, 12),
  ('Géographie — Thème 3 : L''administration et l''aménagement du territoire ivoirien', 1, 16),
  ('Géographie — Thème 3 : L''administration et l''aménagement du territoire ivoirien', 2, 20),
  ('Géographie — Thème 4 : Le processus de la mondialisation', 1, 24),
  ('Géographie — Thème 4 : Le processus de la mondialisation', 2, 26)
) as v(parent_title, ordering, week)
  on v.ordering = cu.ordering
  and v.parent_title = (select p.title from curriculum_units p where p.id = cu.parent_unit_id)
where cur.version_label like 'DPFC 2025-2026 (Coordination Nationale Disciplinaire HG%'
  and cu.parent_unit_id is not null
  and cur.education_level_id in (select id from education_levels where name in ('1èreA1', '1èreA2', '1èreC', '1èreD'));

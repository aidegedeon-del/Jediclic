-- ============================================================================
-- 0033_index_performance.sql
-- Lot de performance pure (aucun changement de schéma logique, aucune
-- politique RLS modifiée) : ajoute les index manquants identifiés par
-- l'analyse des requêtes réellement exécutées par l'application, pour que
-- les temps de réponse restent stables quand le volume de données augmente
-- (plus d'organisations, de classes, d'élèves, d'évaluations, de résultats).
--
-- Convention §26 : la sécurité (RLS) n'est jamais concernée par cette
-- migration — un index ne change ni qui peut lire une ligne, ni la logique
-- métier, seulement la vitesse à laquelle Postgres la trouve.
-- ============================================================================

-- results : la quasi-totalité des pages (Notes, Bulletins, Analyse,
-- Assistant) filtrent par assessment_id via `.in("assessment_id", [...])`
-- puis regroupent par student_id côté application. Un index composite
-- couvre directement ce filtre + limite la taille de l'index secondaire déjà
-- existant sur (assessment_id) seul (migration 0004).
create index if not exists idx_results_assessment_student on results(assessment_id, student_id);

-- assessments : filtré très fréquemment par (class_id, published) — pages
-- Notes/Bulletins/Analyse ne lisent que les évaluations publiées d'une
-- classe — puis trié par assessment_date pour les bulletins (filtre de
-- période). L'index existant idx_assessments_teacher_subject (migration
-- 0027) ne couvre pas ce cas.
create index if not exists idx_assessments_class_published_date
  on assessments(class_id, published, assessment_date);

-- students : filtré sur presque toutes les pages par (class_id) + condition
-- "archived_at is null" (élèves actifs uniquement) — l'index existant sur
-- students(class_id) (migration 0003) ne priorise pas les lignes actives.
-- Index partiel : ne couvre que les lignes non archivées, plus petit et
-- plus rapide à parcourir que l'index existant pour ce cas très majoritaire.
create index if not exists idx_students_class_active
  on students(class_id) where archived_at is null;

-- classes : filtré sur presque toutes les pages par (organization_id,
-- school_year_id) + "archived_at is null" (année en cours). L'index existant
-- idx_classes_org (migration 0003) ne couvre que organization_id seul.
create index if not exists idx_classes_org_year_active
  on classes(organization_id, school_year_id) where archived_at is null;

-- report_cards : filtré par (class_id, school_period_id, subject_id) dans
-- computeClassBulletin — les index existants (school_period_id seul,
-- student_id seul, migration 0011) ne couvrent pas ce triplet.
create index if not exists idx_report_cards_class_period_subject
  on report_cards(class_id, school_period_id, subject_id);

-- assessment_units : jointure fréquente depuis assessment_id (analyse par
-- chapitre) — aucun index dédié jusqu'ici (seule la clé primaire composite
-- (assessment_id, curriculum_unit_id) existe déjà, donc assessment_id seul
-- est déjà couvert en tête de cette PK — mais curriculum_unit_id seul, utile
-- pour retrouver "quelles évaluations couvrent ce chapitre", ne l'est pas).
create index if not exists idx_assessment_units_curriculum on assessment_units(curriculum_unit_id);

-- organization_members : `requireCurrentOrg()` (appelé sur CHAQUE page du
-- dashboard) filtre par (user_id, accepted_at). La contrainte unique
-- existante est (organization_id, user_id) — l'ordre inverse recherché ici
-- n'est pas couvert efficacement.
create index if not exists idx_organization_members_user_accepted
  on organization_members(user_id) where accepted_at is not null;

-- invitations : le layout dashboard (chargé sur CHAQUE page) filtre par
-- (email, status='pending') — l'index existant idx_invitations_email
-- (migration 0009) couvre déjà ce cas mais on l'aligne explicitement avec le
-- filtre organization_id utilisé par la page Établissement.
create index if not exists idx_invitations_org_status on invitations(organization_id, status);

-- payment_submissions : la page Établissement filtre par
-- (organization_id, submission_kind, status) — l'index existant
-- (organization_id, created_at) et (status, created_at) (migration 0025/26)
-- ne couvrent pas ce triplet précis.
create index if not exists idx_payment_submissions_org_kind_status
  on payment_submissions(organization_id, submission_kind, status);

-- assistant_messages : la page Assistant lit déjà avec un index couvrant
-- (organization_id, created_at) (migration 0010) — RAS, pas de changement.

-- documents : la page Documents filtre par (organization_id) puis trie par
-- created_at — l'index existant (organization_id, status) (migration 0005)
-- ne couvre pas efficacement le tri sans filtre sur status.
create index if not exists idx_documents_org_created on documents(organization_id, created_at desc);

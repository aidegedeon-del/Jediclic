-- ============================================================================
-- 0040_indexation_multitenant_organization_id.sql
-- Audit final de production (point 14/19 — performance & structure DB) :
-- plusieurs tables pédagogiques centrales n'ont AUCUN index dont la colonne
-- de tête est `organization_id` (ou `teacher_id`), alors que :
--   1. Quasiment toutes les policies RLS filtrent sur `organization_id` via
--      is_org_member(organization_id) / has_org_role(organization_id, ...)
--      — chaque lecture RLS-filtrée déclenche donc un Seq Scan complet de
--      la table, tous tenants confondus, sur un déploiement multi-org réel.
--   2. Plusieurs pages/actions filtrent directement sur `organization_id`
--      (ex. src/app/(dashboard)/dashboard/eleves/page.tsx sur `students`)
--      ou sur `teacher_id` seul (ex. getTeacherSubjectsForClass sur
--      `assessments`, resolveClass-adjacent sur `classes.teacher_id`).
--
-- VÉRIFIÉ EN LIVE sur la base de test locale (jediclic_test) via :
--   EXPLAIN SELECT * FROM students WHERE organization_id = <uuid>;
--   EXPLAIN SELECT * FROM classes  WHERE teacher_id = <uuid>;
-- → "Seq Scan" confirmé dans les deux cas avant cette migration.
--
-- Aucun changement de logique métier, de RLS ou de comportement applicatif :
-- ajout d'index uniquement (opération purement additive, sans risque de
-- régression fonctionnelle).
-- ============================================================================

-- students : liste globale "Vos élèves" (toutes classes de l'org) filtrée
-- directement sur organization_id, sans passer par class_id.
create index if not exists idx_students_org
  on students(organization_id);

-- exercises : RLS (exercises_select_own_or_supervisor) évalue
-- has_org_role(organization_id, ...) pour tout owner/admin — aucun index
-- n'existait même sur organization_id seul avant cette migration.
create index if not exists idx_exercises_org
  on exercises(organization_id);
create index if not exists idx_exercises_teacher
  on exercises(teacher_id);

-- lessons : même famille de policies (lessons_select_own_or_supervisor).
create index if not exists idx_lessons_org
  on lessons(organization_id);
create index if not exists idx_lessons_teacher
  on lessons(teacher_id);

-- assessments : RLS + lecture "toutes les évaluations de mon org" côté
-- pages plateforme/analyse.
create index if not exists idx_assessments_org
  on assessments(organization_id);

-- results : RLS results_select_own_or_supervisor rejoint sur assessments
-- mais l'org_id est aussi filtré directement dans plusieurs upserts/lectures.
create index if not exists idx_results_org
  on results(organization_id);

-- ai_recommendations : RLS ai_recommendations_select_own_or_supervisor.
create index if not exists idx_ai_recommendations_org
  on ai_recommendations(organization_id);

-- remediations : RLS remediations_select_own_or_supervisor.
create index if not exists idx_remediations_org
  on remediations(organization_id);

-- report_cards : bulletins consultés par owner/admin sur toute l'org.
create index if not exists idx_report_cards_org
  on report_cards(organization_id);

-- lesson_sessions : RLS lesson_sessions_select_own_or_supervisor.
create index if not exists idx_lesson_sessions_org
  on lesson_sessions(organization_id);

-- subscriptions : lu par organization_id sur les pages abonnement/etablissement
-- et par le cron expire_overdue_subscriptions (filtré sur status, mais la
-- jointure organisation → abonnement passe par organization_id).
create index if not exists idx_subscriptions_org
  on subscriptions(organization_id);

-- establishments : RLS establishment_select_members (is_org_member) +
-- lecture directe organization_id → establishments sur la page établissement.
create index if not exists idx_establishments_org
  on establishments(organization_id);

-- classes.teacher_id : utilisé seul (sans organization_id) dans plusieurs
-- lectures — ex. getTeacherSubjectsForClass, resolveClass côté assistant,
-- décompte des classes d'un professeur avant retrait (removeTeacherFromOrg).
create index if not exists idx_classes_teacher
  on classes(teacher_id);

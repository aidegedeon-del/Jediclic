-- ============================================================================
-- 0029_isolation_profs_supervision.sql
-- EF-ETAB-02 (demande explicite) : dans un établissement, chaque professeur
-- ne doit voir/modifier QUE ses propres classes (et tout ce qui en découle :
-- élèves, notes, progressions, bulletins, contenus générés...). Seuls les
-- rôles 'owner' et 'admin' (le directeur/créateur de l'établissement, et les
-- personnes qu'il promeut au même niveau) voient les données de TOUS les
-- professeurs — mais en LECTURE SEULE : "il supervise sans rien faire".
--
-- Corollaire : un professeur peut être retiré de l'établissement (compte
-- supprimé de l'organisation) sans perdre l'historique. Ses classes restent
-- actives, simplement sans professeur assigné (teacher_id = null), en
-- attendant qu'un remplaçant accepte une invitation ciblant cette classe.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Une classe peut désormais exister sans professeur assigné.
-- ----------------------------------------------------------------------------
alter table classes alter column teacher_id drop not null;

-- Une invitation peut désormais cibler une classe précise (remplacement d'un
-- professeur retiré) plutôt que simplement l'établissement en général. Si la
-- classe est supprimée entretemps, l'invitation redevient une invitation
-- "générale" plutôt que d'échouer.
alter table invitations add column class_id uuid references classes(id) on delete set null;

-- ----------------------------------------------------------------------------
-- 2. Fonction utilitaire : la personne connectée est-elle le professeur
--    assigné à cette classe ?
-- ----------------------------------------------------------------------------
create or replace function is_class_teacher(target_class_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from classes c
    where c.id = target_class_id
      and c.teacher_id = auth.uid()
  );
$$;

-- ----------------------------------------------------------------------------
-- 3. Classes : lecture = son propre professeur OU owner/admin (supervision).
--    Écriture = son propre professeur uniquement. La réassignation d'une
--    classe laissée sans professeur (suite à un retrait de compte, ou à
--    l'acceptation d'une invitation ciblée) passe par le client
--    service_role côté serveur (voir actions.ts), jamais par une policy
--    utilisateur — cohérent avec "le superviseur ne modifie rien lui-même".
-- ----------------------------------------------------------------------------
drop policy if exists "classes_all_org_members" on classes;

create policy "classes_select_own_or_supervisor" on classes for select
  using (teacher_id = auth.uid() or has_org_role(organization_id, array['owner','admin']::user_role[]));

create policy "classes_insert_own" on classes for insert
  with check (teacher_id = auth.uid() and is_org_member(organization_id));

create policy "classes_update_own" on classes for update
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

create policy "classes_delete_own" on classes for delete
  using (teacher_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 4. Élèves et emploi du temps : rattachés à une classe, même logique.
-- ----------------------------------------------------------------------------
drop policy if exists "students_all_org_members" on students;

create policy "students_select_own_or_supervisor" on students for select
  using (
    is_class_teacher(class_id)
    or has_org_role(organization_id, array['owner','admin']::user_role[])
  );
create policy "students_write_own" on students for all
  using (is_class_teacher(class_id))
  with check (is_class_teacher(class_id));

drop policy if exists "schedule_all_org_members" on schedule_slots;

create policy "schedule_select_own_or_supervisor" on schedule_slots for select
  using (teacher_id = auth.uid() or has_org_role(organization_id, array['owner','admin']::user_role[]));
create policy "schedule_write_own" on schedule_slots for all
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 5. Pédagogie : progression, cours, exercices, évaluations, résultats,
--    recommandations IA, remédiations, bulletins.
-- ----------------------------------------------------------------------------
drop policy if exists "progressions_org_members" on teacher_progressions;
create policy "progressions_select_own_or_supervisor" on teacher_progressions for select
  using (is_class_teacher(class_id) or has_org_role(organization_id, array['owner','admin']::user_role[]));
create policy "progressions_write_own" on teacher_progressions for all
  using (is_class_teacher(class_id))
  with check (is_class_teacher(class_id));

drop policy if exists "lessons_org_members" on lessons;
create policy "lessons_select_own_or_supervisor" on lessons for select
  using (teacher_id = auth.uid() or has_org_role(organization_id, array['owner','admin']::user_role[]));
create policy "lessons_write_own" on lessons for all
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

drop policy if exists "lesson_sessions_org_members" on lesson_sessions;
create policy "lesson_sessions_select_own_or_supervisor" on lesson_sessions for select
  using (is_class_teacher(class_id) or has_org_role(organization_id, array['owner','admin']::user_role[]));
create policy "lesson_sessions_write_own" on lesson_sessions for all
  using (is_class_teacher(class_id))
  with check (is_class_teacher(class_id));

drop policy if exists "exercises_org_members" on exercises;
create policy "exercises_select_own_or_supervisor" on exercises for select
  using (teacher_id = auth.uid() or has_org_role(organization_id, array['owner','admin']::user_role[]));
create policy "exercises_write_own" on exercises for all
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

drop policy if exists "assessments_org_members" on assessments;
create policy "assessments_select_own_or_supervisor" on assessments for select
  using (teacher_id = auth.uid() or has_org_role(organization_id, array['owner','admin']::user_role[]));
create policy "assessments_write_own" on assessments for all
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

drop policy if exists "assessment_units_org_members" on assessment_units;
create policy "assessment_units_select_own_or_supervisor" on assessment_units for select
  using (exists (
    select 1 from assessments a where a.id = assessment_id
    and (a.teacher_id = auth.uid() or has_org_role(a.organization_id, array['owner','admin']::user_role[]))
  ));
create policy "assessment_units_write_own" on assessment_units for all
  using (exists (select 1 from assessments a where a.id = assessment_id and a.teacher_id = auth.uid()))
  with check (exists (select 1 from assessments a where a.id = assessment_id and a.teacher_id = auth.uid()));

drop policy if exists "assessment_questions_org_members" on assessment_questions;
create policy "assessment_questions_select_own_or_supervisor" on assessment_questions for select
  using (exists (
    select 1 from assessments a where a.id = assessment_id
    and (a.teacher_id = auth.uid() or has_org_role(a.organization_id, array['owner','admin']::user_role[]))
  ));
create policy "assessment_questions_write_own" on assessment_questions for all
  using (exists (select 1 from assessments a where a.id = assessment_id and a.teacher_id = auth.uid()))
  with check (exists (select 1 from assessments a where a.id = assessment_id and a.teacher_id = auth.uid()));

drop policy if exists "results_org_members" on results;
create policy "results_select_own_or_supervisor" on results for select
  using (exists (
    select 1 from assessments a where a.id = assessment_id
    and (a.teacher_id = auth.uid() or has_org_role(a.organization_id, array['owner','admin']::user_role[]))
  ));
create policy "results_write_own" on results for all
  using (exists (select 1 from assessments a where a.id = assessment_id and a.teacher_id = auth.uid()))
  with check (exists (select 1 from assessments a where a.id = assessment_id and a.teacher_id = auth.uid()));

-- ai_recommendations / remediations : class_id est en pratique toujours
-- renseigné par le code de génération (src/lib/generation/generate.ts).
drop policy if exists "ai_recommendations_org_members" on ai_recommendations;
create policy "ai_recommendations_select_own_or_supervisor" on ai_recommendations for select
  using (
    (class_id is not null and is_class_teacher(class_id))
    or has_org_role(organization_id, array['owner','admin']::user_role[])
  );
create policy "ai_recommendations_write_own" on ai_recommendations for all
  using (class_id is not null and is_class_teacher(class_id))
  with check (class_id is not null and is_class_teacher(class_id));

drop policy if exists "remediations_org_members" on remediations;
create policy "remediations_select_own_or_supervisor" on remediations for select
  using (is_class_teacher(class_id) or has_org_role(organization_id, array['owner','admin']::user_role[]));
create policy "remediations_write_own" on remediations for all
  using (is_class_teacher(class_id))
  with check (is_class_teacher(class_id));

drop policy if exists "remediation_students_org_members" on remediation_students;
create policy "remediation_students_select_own_or_supervisor" on remediation_students for select
  using (exists (
    select 1 from remediations r where r.id = remediation_id
    and (is_class_teacher(r.class_id) or has_org_role(r.organization_id, array['owner','admin']::user_role[]))
  ));
create policy "remediation_students_write_own" on remediation_students for all
  using (exists (select 1 from remediations r where r.id = remediation_id and is_class_teacher(r.class_id)))
  with check (exists (select 1 from remediations r where r.id = remediation_id and is_class_teacher(r.class_id)));

-- Bulletins (report_cards, migration 0011).
drop policy if exists "report_cards_org_members" on report_cards;
create policy "report_cards_select_own_or_supervisor" on report_cards for select
  using (is_class_teacher(class_id) or has_org_role(organization_id, array['owner','admin']::user_role[]));
create policy "report_cards_write_own" on report_cards for all
  using (is_class_teacher(class_id))
  with check (is_class_teacher(class_id));

-- ----------------------------------------------------------------------------
-- 6. Documents importés (brouillons OCR avant validation) : mêmes règles,
--    identifiés par la personne qui a fait l'import (uploaded_by).
-- ----------------------------------------------------------------------------
drop policy if exists "documents_org_members" on documents;
create policy "documents_select_own_or_supervisor" on documents for select
  using (uploaded_by = auth.uid() or has_org_role(organization_id, array['owner','admin']::user_role[]));
create policy "documents_write_own" on documents for all
  using (uploaded_by = auth.uid())
  with check (uploaded_by = auth.uid());

-- ----------------------------------------------------------------------------
-- Note : `classes_org` (audit_logs), `subscriptions`, `organization_members`,
-- `establishments`, `invitations` restent gérés par les policies existantes
-- (migrations 0006/0009) : ce sont des données de gestion d'établissement,
-- pas des données pédagogiques d'un professeur — la supervision y était déjà
-- réservée à owner/admin.
-- ============================================================================

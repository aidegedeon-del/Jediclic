-- ============================================================================
-- 0006_rls_policies.sql
-- Row Level Security obligatoire (Convention §27) sur toutes les tables
-- contenant des donnees privees. La securite ne repose jamais uniquement
-- sur l'interface (§26). Isolation stricte entre organisations (§25).
-- ============================================================================

-- Fonctions utilitaires SECURITY DEFINER pour eviter la recursion RLS
-- quand une policy sur organization_members doit lire organization_members.
create or replace function is_org_member(target_org_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from organization_members m
    where m.organization_id = target_org_id
      and m.user_id = auth.uid()
      and m.suspended_at is null
      and m.accepted_at is not null
  );
$$;

create or replace function has_org_role(target_org_id uuid, allowed_roles user_role[])
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from organization_members m
    where m.organization_id = target_org_id
      and m.user_id = auth.uid()
      and m.role = any(allowed_roles)
      and m.suspended_at is null
      and m.accepted_at is not null
  );
$$;

-- ---- Referentiel : lecture publique (authentifiee), ecriture reservee aux
-- admins de la plateforme (gere hors RLS, via le role service_role / futur
-- espace admin plateforme). Pas de donnees sensibles ici.
alter table countries enable row level security;
alter table education_systems enable row level security;
alter table school_years enable row level security;
alter table education_cycles enable row level security;
alter table education_levels enable row level security;
alter table subjects enable row level security;
alter table curricula enable row level security;
alter table curriculum_units enable row level security;
alter table competencies enable row level security;
alter table official_progression_steps enable row level security;

create policy "referentiel_read_authenticated" on countries for select using (auth.role() = 'authenticated');
create policy "referentiel_read_authenticated" on education_systems for select using (auth.role() = 'authenticated');
create policy "referentiel_read_authenticated" on school_years for select using (auth.role() = 'authenticated');
create policy "referentiel_read_authenticated" on education_cycles for select using (auth.role() = 'authenticated');
create policy "referentiel_read_authenticated" on education_levels for select using (auth.role() = 'authenticated');
create policy "referentiel_read_authenticated" on subjects for select using (auth.role() = 'authenticated');
create policy "referentiel_read_authenticated" on curricula for select using (auth.role() = 'authenticated');
create policy "referentiel_read_authenticated" on curriculum_units for select using (auth.role() = 'authenticated');
create policy "referentiel_read_authenticated" on competencies for select using (auth.role() = 'authenticated');
create policy "referentiel_read_authenticated" on official_progression_steps for select using (auth.role() = 'authenticated');
-- Ecritures : uniquement via service_role (scripts d'admin plateforme / seed),
-- donc aucune policy INSERT/UPDATE/DELETE cote utilisateur authentifie.

-- ---- Organisations / etablissements / membres
alter table organizations enable row level security;
alter table establishments enable row level security;
alter table profiles enable row level security;
alter table organization_members enable row level security;

create policy "org_select_members" on organizations for select
  using (is_org_member(id));
create policy "org_insert_self" on organizations for insert
  with check (true); -- creation initiale a l'onboarding, l'appelant devient owner ensuite
create policy "org_update_admins" on organizations for update
  using (has_org_role(id, array['owner','admin']::user_role[]));

create policy "establishment_select_members" on establishments for select
  using (is_org_member(organization_id));
create policy "establishment_write_admins" on establishments for all
  using (has_org_role(organization_id, array['owner','admin']::user_role[]))
  with check (has_org_role(organization_id, array['owner','admin']::user_role[]));

create policy "profiles_select_own_or_shared_org" on profiles for select
  using (
    id = auth.uid()
    or exists (
      select 1 from organization_members m1
      join organization_members m2 on m2.organization_id = m1.organization_id
      where m1.user_id = auth.uid() and m2.user_id = profiles.id
    )
  );
create policy "profiles_update_own" on profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles_insert_own" on profiles for insert
  with check (id = auth.uid());

create policy "members_select_same_org" on organization_members for select
  using (is_org_member(organization_id) or user_id = auth.uid());
create policy "members_write_admins" on organization_members for all
  using (has_org_role(organization_id, array['owner','admin']::user_role[]))
  with check (has_org_role(organization_id, array['owner','admin']::user_role[]));

-- ---- Classes / eleves / emploi du temps
alter table classes enable row level security;
alter table students enable row level security;
alter table schedule_slots enable row level security;

create policy "classes_all_org_members" on classes for all
  using (is_org_member(organization_id))
  with check (is_org_member(organization_id));

create policy "students_all_org_members" on students for all
  using (is_org_member(organization_id))
  with check (is_org_member(organization_id));

create policy "schedule_all_org_members" on schedule_slots for all
  using (is_org_member(organization_id))
  with check (is_org_member(organization_id));

-- ---- Pedagogie
alter table teacher_progressions enable row level security;
alter table lessons enable row level security;
alter table lesson_sessions enable row level security;
alter table exercises enable row level security;
alter table assessments enable row level security;
alter table assessment_units enable row level security;
alter table assessment_questions enable row level security;
alter table results enable row level security;
alter table ai_recommendations enable row level security;
alter table remediations enable row level security;
alter table remediation_students enable row level security;

create policy "progressions_org_members" on teacher_progressions for all
  using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy "lessons_org_members" on lessons for all
  using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy "lesson_sessions_org_members" on lesson_sessions for all
  using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy "exercises_org_members" on exercises for all
  using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy "assessments_org_members" on assessments for all
  using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy "assessment_units_org_members" on assessment_units for all
  using (exists (select 1 from assessments a where a.id = assessment_id and is_org_member(a.organization_id)))
  with check (exists (select 1 from assessments a where a.id = assessment_id and is_org_member(a.organization_id)));
create policy "assessment_questions_org_members" on assessment_questions for all
  using (exists (select 1 from assessments a where a.id = assessment_id and is_org_member(a.organization_id)))
  with check (exists (select 1 from assessments a where a.id = assessment_id and is_org_member(a.organization_id)));
create policy "results_org_members" on results for all
  using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy "ai_recommendations_org_members" on ai_recommendations for all
  using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy "remediations_org_members" on remediations for all
  using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy "remediation_students_org_members" on remediation_students for all
  using (exists (select 1 from remediations r where r.id = remediation_id and is_org_member(r.organization_id)))
  with check (exists (select 1 from remediations r where r.id = remediation_id and is_org_member(r.organization_id)));

-- ---- Documents / abonnements / audit
alter table documents enable row level security;
alter table plans enable row level security;
alter table subscriptions enable row level security;
alter table audit_logs enable row level security;

create policy "documents_org_members" on documents for all
  using (is_org_member(organization_id)) with check (is_org_member(organization_id));

create policy "plans_read_all_authenticated" on plans for select using (auth.role() = 'authenticated');

create policy "subscriptions_select_org" on subscriptions for select
  using (is_org_member(organization_id));
create policy "subscriptions_write_admins" on subscriptions for all
  using (has_org_role(organization_id, array['owner','admin']::user_role[]))
  with check (has_org_role(organization_id, array['owner','admin']::user_role[]));

create policy "audit_select_admins" on audit_logs for select
  using (organization_id is not null and has_org_role(organization_id, array['owner','admin']::user_role[]));
-- Les inserts d'audit passent par des fonctions/serveur (service_role), pas
-- de policy INSERT cote client.

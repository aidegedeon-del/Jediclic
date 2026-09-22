-- ============================================================================
-- 0037_durcissement_rls_multitenant.sql
-- Durcissement complémentaire :
--   * aucune mutation "FOR ALL" permissive sur les tables pédagogiques
--   * impossibilité de déplacer une ressource vers une autre organisation
--   * vérification des relations classe/élève/évaluation/résultat
--   * plafonnement réel des 2 disciplines gratuites
--   * onboarding atomique et suppression des organisations orphelines
--   * réduction de l'exposition des fonctions SECURITY DEFINER
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Fonctions utilitaires : exécution uniquement pour authenticated.
-- ---------------------------------------------------------------------------
revoke all on function is_org_member(uuid) from public;
revoke all on function has_org_role(uuid, user_role[]) from public;
revoke all on function is_class_teacher(uuid) from public;
revoke all on function is_document_object_accessible(text) from public;

grant execute on function is_org_member(uuid) to authenticated;
grant execute on function has_org_role(uuid, user_role[]) to authenticated;
grant execute on function is_class_teacher(uuid) to authenticated;
grant execute on function is_document_object_accessible(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Helper : accès/consistance de classe.
-- ---------------------------------------------------------------------------
create or replace function class_belongs_to_org(p_class_id uuid, p_org_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from classes c
    where c.id = p_class_id
      and c.organization_id = p_org_id
  );
$$;
revoke all on function class_belongs_to_org(uuid, uuid) from public;
grant execute on function class_belongs_to_org(uuid, uuid) to authenticated;

create or replace function student_belongs_to_class(p_student_id uuid, p_class_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from students s
    where s.id = p_student_id
      and s.class_id = p_class_id
  );
$$;
revoke all on function student_belongs_to_class(uuid, uuid) from public;
grant execute on function student_belongs_to_class(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Classes : séparation stricte des opérations.
-- ---------------------------------------------------------------------------
drop policy if exists "classes_select_own_or_supervisor" on classes;
drop policy if exists "classes_insert_own" on classes;
drop policy if exists "classes_update_own" on classes;
drop policy if exists "classes_delete_own" on classes;

create policy "classes_select_own_or_supervisor" on classes for select
using (
  (teacher_id = auth.uid() and is_org_member(organization_id))
  or has_org_role(organization_id, array['owner','admin']::user_role[])
);

create policy "classes_insert_own" on classes for insert
with check (
  teacher_id = auth.uid()
  and is_org_member(organization_id)
  and (
    establishment_id is null
    or exists (
      select 1 from establishments e
      where e.id = establishment_id
        and e.organization_id = organization_id
    )
  )
);

create policy "classes_update_own" on classes for update
using (teacher_id = auth.uid() and is_org_member(organization_id))
with check (
  teacher_id = auth.uid()
  and is_org_member(organization_id)
  and (
    establishment_id is null
    or exists (
      select 1 from establishments e
      where e.id = establishment_id
        and e.organization_id = organization_id
    )
  )
);

create policy "classes_delete_own" on classes for delete
using (teacher_id = auth.uid() and is_org_member(organization_id));

-- ---------------------------------------------------------------------------
-- 4. Students.
-- ---------------------------------------------------------------------------
drop policy if exists "students_select_own_or_supervisor" on students;
drop policy if exists "students_write_own" on students;

create policy "students_select_own_or_supervisor" on students for select
using (
  (is_class_teacher(class_id) and is_org_member(organization_id))
  or has_org_role(organization_id, array['owner','admin']::user_role[])
);

create policy "students_insert_own" on students for insert
with check (
  is_class_teacher(class_id)
  and is_org_member(organization_id)
  and class_belongs_to_org(class_id, organization_id)
  and (student_profile_id is null or exists (
    select 1 from student_profiles sp
    where sp.id = student_profile_id
      and sp.organization_id = organization_id
  ))
);

create policy "students_update_own" on students for update
using (
  is_class_teacher(class_id)
  and is_org_member(organization_id)
)
with check (
  is_class_teacher(class_id)
  and is_org_member(organization_id)
  and class_belongs_to_org(class_id, organization_id)
  and (student_profile_id is null or exists (
    select 1 from student_profiles sp
    where sp.id = student_profile_id
      and sp.organization_id = organization_id
  ))
);

create policy "students_delete_own" on students for delete
using (is_class_teacher(class_id) and is_org_member(organization_id));

-- ---------------------------------------------------------------------------
-- 5. Schedule.
-- ---------------------------------------------------------------------------
drop policy if exists "schedule_select_own_or_supervisor" on schedule_slots;
drop policy if exists "schedule_write_own" on schedule_slots;

create policy "schedule_select_own_or_supervisor" on schedule_slots for select
using (
  (teacher_id = auth.uid() and is_org_member(organization_id))
  or has_org_role(organization_id, array['owner','admin']::user_role[])
);

create policy "schedule_insert_own" on schedule_slots for insert
with check (
  teacher_id = auth.uid()
  and is_org_member(organization_id)
  and is_class_teacher(class_id)
  and class_belongs_to_org(class_id, organization_id)
);

create policy "schedule_update_own" on schedule_slots for update
using (teacher_id = auth.uid() and is_org_member(organization_id))
with check (
  teacher_id = auth.uid()
  and is_org_member(organization_id)
  and is_class_teacher(class_id)
  and class_belongs_to_org(class_id, organization_id)
);

create policy "schedule_delete_own" on schedule_slots for delete
using (teacher_id = auth.uid() and is_org_member(organization_id));

-- ---------------------------------------------------------------------------
-- 6. Progressions.
-- ---------------------------------------------------------------------------
drop policy if exists "progressions_select_own_or_supervisor" on teacher_progressions;
drop policy if exists "progressions_write_own" on teacher_progressions;
create policy "progressions_select_own_or_supervisor" on teacher_progressions for select
using (is_class_teacher(class_id) or has_org_role(organization_id, array['owner','admin']::user_role[]));
create policy "progressions_insert_own" on teacher_progressions for insert
with check (is_class_teacher(class_id) and class_belongs_to_org(class_id, organization_id));
create policy "progressions_update_own" on teacher_progressions for update
using (is_class_teacher(class_id) and is_org_member(organization_id))
with check (is_class_teacher(class_id) and class_belongs_to_org(class_id, organization_id));
create policy "progressions_delete_own" on teacher_progressions for delete
using (is_class_teacher(class_id) and is_org_member(organization_id));

-- ---------------------------------------------------------------------------
-- 7. Lessons / sessions / exercises.
-- ---------------------------------------------------------------------------
drop policy if exists "lessons_select_own_or_supervisor" on lessons;
drop policy if exists "lessons_write_own" on lessons;
create policy "lessons_select_own_or_supervisor" on lessons for select
using (teacher_id = auth.uid() or has_org_role(organization_id, array['owner','admin']::user_role[]));
create policy "lessons_insert_own" on lessons for insert
with check (
  teacher_id = auth.uid() and is_org_member(organization_id)
  and (class_id is null or (is_class_teacher(class_id) and class_belongs_to_org(class_id, organization_id)))
);
create policy "lessons_update_own" on lessons for update
using (teacher_id = auth.uid() and is_org_member(organization_id))
with check (
  teacher_id = auth.uid() and is_org_member(organization_id)
  and (class_id is null or (is_class_teacher(class_id) and class_belongs_to_org(class_id, organization_id)))
);
create policy "lessons_delete_own" on lessons for delete
using (teacher_id = auth.uid() and is_org_member(organization_id));

drop policy if exists "lesson_sessions_select_own_or_supervisor" on lesson_sessions;
drop policy if exists "lesson_sessions_write_own" on lesson_sessions;
create policy "lesson_sessions_select_own_or_supervisor" on lesson_sessions for select
using (is_class_teacher(class_id) or has_org_role(organization_id, array['owner','admin']::user_role[]));
create policy "lesson_sessions_insert_own" on lesson_sessions for insert
with check (
  is_class_teacher(class_id) and class_belongs_to_org(class_id, organization_id)
  and (lesson_id is null or exists (select 1 from lessons l where l.id = lesson_id and l.organization_id = organization_id))
);
create policy "lesson_sessions_update_own" on lesson_sessions for update
using (is_class_teacher(class_id) and is_org_member(organization_id))
with check (
  is_class_teacher(class_id) and class_belongs_to_org(class_id, organization_id)
  and (lesson_id is null or exists (select 1 from lessons l where l.id = lesson_id and l.organization_id = organization_id))
);
create policy "lesson_sessions_delete_own" on lesson_sessions for delete
using (is_class_teacher(class_id) and is_org_member(organization_id));

drop policy if exists "exercises_select_own_or_supervisor" on exercises;
drop policy if exists "exercises_write_own" on exercises;
create policy "exercises_select_own_or_supervisor" on exercises for select
using (teacher_id = auth.uid() or has_org_role(organization_id, array['owner','admin']::user_role[]));
create policy "exercises_insert_own" on exercises for insert
with check (teacher_id = auth.uid() and is_org_member(organization_id));
create policy "exercises_update_own" on exercises for update
using (teacher_id = auth.uid() and is_org_member(organization_id))
with check (teacher_id = auth.uid() and is_org_member(organization_id));
create policy "exercises_delete_own" on exercises for delete
using (teacher_id = auth.uid() and is_org_member(organization_id));

-- ---------------------------------------------------------------------------
-- 8. Assessments / units / questions / results.
-- ---------------------------------------------------------------------------
drop policy if exists "assessments_select_own_or_supervisor" on assessments;
drop policy if exists "assessments_write_own" on assessments;
create policy "assessments_select_own_or_supervisor" on assessments for select
using (teacher_id = auth.uid() or has_org_role(organization_id, array['owner','admin']::user_role[]));
create policy "assessments_insert_own" on assessments for insert
with check (
  teacher_id = auth.uid() and is_org_member(organization_id)
  and is_class_teacher(class_id) and class_belongs_to_org(class_id, organization_id)
);
create policy "assessments_update_own" on assessments for update
using (teacher_id = auth.uid() and is_org_member(organization_id))
with check (
  teacher_id = auth.uid() and is_org_member(organization_id)
  and is_class_teacher(class_id) and class_belongs_to_org(class_id, organization_id)
);
create policy "assessments_delete_own" on assessments for delete
using (teacher_id = auth.uid() and is_org_member(organization_id));

drop policy if exists "assessment_units_select_own_or_supervisor" on assessment_units;
drop policy if exists "assessment_units_write_own" on assessment_units;
create policy "assessment_units_select_own_or_supervisor" on assessment_units for select
using (exists (select 1 from assessments a where a.id = assessment_id and (a.teacher_id = auth.uid() or has_org_role(a.organization_id, array['owner','admin']::user_role[]))));
create policy "assessment_units_insert_own" on assessment_units for insert
with check (exists (select 1 from assessments a where a.id = assessment_id and a.teacher_id = auth.uid() and a.organization_id is not null));
create policy "assessment_units_update_own" on assessment_units for update
using (exists (select 1 from assessments a where a.id = assessment_id and a.teacher_id = auth.uid()))
with check (exists (select 1 from assessments a where a.id = assessment_id and a.teacher_id = auth.uid()));
create policy "assessment_units_delete_own" on assessment_units for delete
using (exists (select 1 from assessments a where a.id = assessment_id and a.teacher_id = auth.uid()));

drop policy if exists "assessment_questions_select_own_or_supervisor" on assessment_questions;
drop policy if exists "assessment_questions_write_own" on assessment_questions;
create policy "assessment_questions_select_own_or_supervisor" on assessment_questions for select
using (exists (select 1 from assessments a where a.id = assessment_id and (a.teacher_id = auth.uid() or has_org_role(a.organization_id, array['owner','admin']::user_role[]))));
create policy "assessment_questions_insert_own" on assessment_questions for insert
with check (exists (select 1 from assessments a where a.id = assessment_id and a.teacher_id = auth.uid()));
create policy "assessment_questions_update_own" on assessment_questions for update
using (exists (select 1 from assessments a where a.id = assessment_id and a.teacher_id = auth.uid()))
with check (exists (select 1 from assessments a where a.id = assessment_id and a.teacher_id = auth.uid()));
create policy "assessment_questions_delete_own" on assessment_questions for delete
using (exists (select 1 from assessments a where a.id = assessment_id and a.teacher_id = auth.uid()));

drop policy if exists "results_select_own_or_supervisor" on results;
drop policy if exists "results_write_own" on results;
create policy "results_select_own_or_supervisor" on results for select
using (exists (
  select 1 from assessments a
  join students s on s.id = results.student_id
  where a.id = results.assessment_id
    and s.class_id = a.class_id
    and s.organization_id = results.organization_id
    and (a.teacher_id = auth.uid() or has_org_role(a.organization_id, array['owner','admin']::user_role[]))
));
create policy "results_insert_own" on results for insert
with check (exists (
  select 1 from assessments a
  join students s on s.id = results.student_id
  where a.id = results.assessment_id
    and a.teacher_id = auth.uid()
    and a.organization_id = results.organization_id
    and s.class_id = a.class_id
    and s.organization_id = results.organization_id
));
create policy "results_update_own" on results for update
using (exists (
  select 1 from assessments a join students s on s.id = results.student_id
  where a.id = results.assessment_id and a.teacher_id = auth.uid()
    and s.class_id = a.class_id and s.organization_id = results.organization_id
))
with check (exists (
  select 1 from assessments a join students s on s.id = results.student_id
  where a.id = results.assessment_id and a.teacher_id = auth.uid()
    and a.organization_id = results.organization_id and s.class_id = a.class_id and s.organization_id = results.organization_id
));
create policy "results_delete_own" on results for delete
using (exists (select 1 from assessments a where a.id = assessment_id and a.teacher_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- 9. IA / remédiation / bulletins.
-- ---------------------------------------------------------------------------
drop policy if exists "ai_recommendations_select_own_or_supervisor" on ai_recommendations;
drop policy if exists "ai_recommendations_write_own" on ai_recommendations;
create policy "ai_recommendations_select_own_or_supervisor" on ai_recommendations for select
using ((class_id is not null and is_class_teacher(class_id)) or has_org_role(organization_id, array['owner','admin']::user_role[]));
create policy "ai_recommendations_insert_own" on ai_recommendations for insert
with check (
  is_org_member(organization_id)
  and class_id is not null and is_class_teacher(class_id)
  and (student_id is null or student_belongs_to_class(student_id, class_id))
);
create policy "ai_recommendations_update_own" on ai_recommendations for update
using (class_id is not null and is_class_teacher(class_id) and is_org_member(organization_id))
with check (class_id is not null and is_class_teacher(class_id) and is_org_member(organization_id) and (student_id is null or student_belongs_to_class(student_id, class_id)));
create policy "ai_recommendations_delete_own" on ai_recommendations for delete
using (class_id is not null and is_class_teacher(class_id) and is_org_member(organization_id));

drop policy if exists "remediations_select_own_or_supervisor" on remediations;
drop policy if exists "remediations_write_own" on remediations;
create policy "remediations_select_own_or_supervisor" on remediations for select
using (is_class_teacher(class_id) or has_org_role(organization_id, array['owner','admin']::user_role[]));
create policy "remediations_insert_own" on remediations for insert
with check (is_class_teacher(class_id) and class_belongs_to_org(class_id, organization_id));
create policy "remediations_update_own" on remediations for update
using (is_class_teacher(class_id) and is_org_member(organization_id))
with check (is_class_teacher(class_id) and class_belongs_to_org(class_id, organization_id));
create policy "remediations_delete_own" on remediations for delete
using (is_class_teacher(class_id) and is_org_member(organization_id));

drop policy if exists "remediation_students_select_own_or_supervisor" on remediation_students;
drop policy if exists "remediation_students_write_own" on remediation_students;
create policy "remediation_students_select_own_or_supervisor" on remediation_students for select
using (exists (select 1 from remediations r join students s on s.id = remediation_students.student_id where r.id = remediation_id and s.class_id = r.class_id and (is_class_teacher(r.class_id) or has_org_role(r.organization_id, array['owner','admin']::user_role[]))));
create policy "remediation_students_insert_own" on remediation_students for insert
with check (exists (select 1 from remediations r join students s on s.id = student_id where r.id = remediation_id and r.organization_id = s.organization_id and s.class_id = r.class_id and is_class_teacher(r.class_id)));
create policy "remediation_students_update_own" on remediation_students for update
using (exists (select 1 from remediations r join students s on s.id = remediation_students.student_id where r.id = remediation_id and s.class_id = r.class_id and is_class_teacher(r.class_id)))
with check (exists (select 1 from remediations r join students s on s.id = student_id where r.id = remediation_id and r.organization_id = s.organization_id and s.class_id = r.class_id and is_class_teacher(r.class_id)));
create policy "remediation_students_delete_own" on remediation_students for delete
using (exists (select 1 from remediations r where r.id = remediation_id and is_class_teacher(r.class_id)));

drop policy if exists "report_cards_select_own_or_supervisor" on report_cards;
drop policy if exists "report_cards_write_own" on report_cards;
create policy "report_cards_select_own_or_supervisor" on report_cards for select
using (is_class_teacher(class_id) or has_org_role(organization_id, array['owner','admin']::user_role[]));
create policy "report_cards_insert_own" on report_cards for insert
with check (is_class_teacher(class_id) and class_belongs_to_org(class_id, organization_id) and student_belongs_to_class(student_id, class_id));
create policy "report_cards_update_own" on report_cards for update
using (is_class_teacher(class_id) and is_org_member(organization_id))
with check (is_class_teacher(class_id) and class_belongs_to_org(class_id, organization_id) and student_belongs_to_class(student_id, class_id));
create policy "report_cards_delete_own" on report_cards for delete
using (is_class_teacher(class_id) and is_org_member(organization_id));

-- ---------------------------------------------------------------------------
-- 10. Documents et assistant.
-- ---------------------------------------------------------------------------
drop policy if exists "documents_select_own_or_supervisor" on documents;
drop policy if exists "documents_write_own" on documents;
create policy "documents_select_own_or_supervisor" on documents for select
using (uploaded_by = auth.uid() or has_org_role(organization_id, array['owner','admin']::user_role[]));
create policy "documents_insert_own" on documents for insert
with check (uploaded_by = auth.uid() and is_org_member(organization_id));
create policy "documents_update_own" on documents for update
using (uploaded_by = auth.uid() and is_org_member(organization_id))
with check (uploaded_by = auth.uid() and is_org_member(organization_id));
create policy "documents_delete_own" on documents for delete
using (uploaded_by = auth.uid() and is_org_member(organization_id));

drop policy if exists "assistant_messages_select_own_or_supervisor" on assistant_messages;
drop policy if exists "assistant_messages_insert_own" on assistant_messages;
create policy "assistant_messages_select_own_or_supervisor" on assistant_messages for select
using (user_id = auth.uid() or has_org_role(organization_id, array['owner','admin']::user_role[]));
create policy "assistant_messages_insert_own" on assistant_messages for insert
with check (user_id = auth.uid() and is_org_member(organization_id));

-- ---------------------------------------------------------------------------
-- 11. Discipline grants : plus de INSERT direct libre ; RPC atomique.
-- ---------------------------------------------------------------------------
drop policy if exists "teacher_discipline_grants_insert_self_free" on teacher_discipline_grants;

create or replace function grant_free_teacher_discipline(p_organization_id uuid, p_subject_id uuid)
returns teacher_discipline_grants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing teacher_discipline_grants;
  v_result teacher_discipline_grants;
  v_count integer;
begin
  if v_user_id is null then raise exception 'Utilisateur non authentifié'; end if;
  if not is_org_member(p_organization_id) then raise exception 'Accès refusé'; end if;

  select * into v_existing
  from teacher_discipline_grants
  where organization_id = p_organization_id
    and teacher_id = v_user_id
    and subject_id = p_subject_id
  limit 1;
  if found then return v_existing; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text || ':' || v_user_id::text, 0));

  select count(*) into v_count
  from teacher_discipline_grants
  where organization_id = p_organization_id and teacher_id = v_user_id;

  if v_count >= 2 then
    raise exception 'Limite de deux disciplines gratuites atteinte';
  end if;

  insert into teacher_discipline_grants (organization_id, teacher_id, subject_id, source)
  values (p_organization_id, v_user_id, p_subject_id, 'free')
  returning * into v_result;

  return v_result;
end;
$$;
revoke all on function grant_free_teacher_discipline(uuid, uuid) from public;
grant execute on function grant_free_teacher_discipline(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 12. Paiements : l'utilisateur ne peut créer une déclaration que pour son org
--     et ne peut jamais écrire le statut de validation.
-- ---------------------------------------------------------------------------
drop policy if exists "payment_submissions_insert_admins" on payment_submissions;
create policy "payment_submissions_insert_admins" on payment_submissions for insert
with check (has_org_role(organization_id, array['owner','admin']::user_role[]) and submitted_by = auth.uid());
-- Aucun UPDATE/DELETE client.

drop policy if exists "payment_submissions_select_admins" on payment_submissions;
create policy "payment_submissions_select_admins" on payment_submissions for select
using (has_org_role(organization_id, array['owner','admin']::user_role[]));

-- ---------------------------------------------------------------------------
-- 13. Audit logs : lecture admin uniquement, aucune écriture client.
-- ---------------------------------------------------------------------------
drop policy if exists "audit_select_admins" on audit_logs;
create policy "audit_select_admins" on audit_logs for select
using (organization_id is not null and has_org_role(organization_id, array['owner','admin']::user_role[]));

-- ---------------------------------------------------------------------------
-- 14. Trigger d'intégrité multi-tenant : bloque les combinaisons incohérentes
--     même si un futur bug applicatif contourne une policy.
-- ---------------------------------------------------------------------------
create or replace function validate_pedagogical_tenant_consistency()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'students' then
    if not exists (select 1 from classes c where c.id = new.class_id and c.organization_id = new.organization_id) then
      raise exception 'student.class_id et organization_id incohérents';
    end if;
  elsif tg_table_name = 'schedule_slots' then
    if not exists (select 1 from classes c where c.id = new.class_id and c.organization_id = new.organization_id) then
      raise exception 'schedule.class_id et organization_id incohérents';
    end if;
  elsif tg_table_name = 'teacher_progressions' then
    if not exists (select 1 from classes c where c.id = new.class_id and c.organization_id = new.organization_id) then
      raise exception 'progression.class_id et organization_id incohérents';
    end if;
  elsif tg_table_name = 'lessons' then
    if new.class_id is not null and not exists (select 1 from classes c where c.id = new.class_id and c.organization_id = new.organization_id) then
      raise exception 'lesson.class_id et organization_id incohérents';
    end if;
  elsif tg_table_name = 'lesson_sessions' then
    if not exists (select 1 from classes c where c.id = new.class_id and c.organization_id = new.organization_id) then
      raise exception 'lesson_session.class_id et organization_id incohérents';
    end if;
  elsif tg_table_name = 'assessments' then
    if not exists (select 1 from classes c where c.id = new.class_id and c.organization_id = new.organization_id and c.teacher_id = new.teacher_id) then
      raise exception 'assessment.class/teacher/organization incohérents';
    end if;
  elsif tg_table_name = 'results' then
    if not exists (
      select 1 from assessments a join students s on s.id = new.student_id
      where a.id = new.assessment_id and a.organization_id = new.organization_id
        and s.organization_id = new.organization_id and s.class_id = a.class_id
    ) then
      raise exception 'result.assessment/student/organization incohérents';
    end if;
  elsif tg_table_name = 'report_cards' then
    if not exists (select 1 from classes c join students s on s.id = new.student_id where c.id = new.class_id and c.organization_id = new.organization_id and s.class_id = new.class_id and s.organization_id = new.organization_id) then
      raise exception 'report_card.class/student/organization incohérents';
    end if;
  elsif tg_table_name = 'remediations' then
    if not exists (select 1 from classes c where c.id = new.class_id and c.organization_id = new.organization_id) then
      raise exception 'remediation.class/organization incohérents';
    end if;
  elsif tg_table_name = 'ai_recommendations' then
    if new.class_id is not null and not exists (select 1 from classes c where c.id = new.class_id and c.organization_id = new.organization_id) then
      raise exception 'ai_recommendation.class/organization incohérents';
    end if;
    if new.student_id is not null and new.class_id is not null and not exists (select 1 from students s where s.id = new.student_id and s.class_id = new.class_id and s.organization_id = new.organization_id) then
      raise exception 'ai_recommendation.student/class incohérents';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function validate_pedagogical_tenant_consistency() from public;
grant execute on function validate_pedagogical_tenant_consistency() to authenticated;

drop trigger if exists trg_validate_students_tenant on students;
create trigger trg_validate_students_tenant before insert or update on students for each row execute function validate_pedagogical_tenant_consistency();
drop trigger if exists trg_validate_schedule_tenant on schedule_slots;
create trigger trg_validate_schedule_tenant before insert or update on schedule_slots for each row execute function validate_pedagogical_tenant_consistency();
drop trigger if exists trg_validate_progressions_tenant on teacher_progressions;
create trigger trg_validate_progressions_tenant before insert or update on teacher_progressions for each row execute function validate_pedagogical_tenant_consistency();
drop trigger if exists trg_validate_lessons_tenant on lessons;
create trigger trg_validate_lessons_tenant before insert or update on lessons for each row execute function validate_pedagogical_tenant_consistency();
drop trigger if exists trg_validate_lesson_sessions_tenant on lesson_sessions;
create trigger trg_validate_lesson_sessions_tenant before insert or update on lesson_sessions for each row execute function validate_pedagogical_tenant_consistency();
drop trigger if exists trg_validate_assessments_tenant on assessments;
create trigger trg_validate_assessments_tenant before insert or update on assessments for each row execute function validate_pedagogical_tenant_consistency();
drop trigger if exists trg_validate_results_tenant on results;
create trigger trg_validate_results_tenant before insert or update on results for each row execute function validate_pedagogical_tenant_consistency();
drop trigger if exists trg_validate_report_cards_tenant on report_cards;
create trigger trg_validate_report_cards_tenant before insert or update on report_cards for each row execute function validate_pedagogical_tenant_consistency();
drop trigger if exists trg_validate_remediations_tenant on remediations;
create trigger trg_validate_remediations_tenant before insert or update on remediations for each row execute function validate_pedagogical_tenant_consistency();
drop trigger if exists trg_validate_ai_recommendations_tenant on ai_recommendations;
create trigger trg_validate_ai_recommendations_tenant before insert or update on ai_recommendations for each row execute function validate_pedagogical_tenant_consistency();

-- ---------------------------------------------------------------------------
-- 15. RLS restrictive policies sur organizations.
--     L'onboarding sera déplacé vers une RPC atomique ; les insertions directes
--     sont donc retirées.
-- ---------------------------------------------------------------------------
drop policy if exists "org_insert_self" on organizations;

create or replace function complete_onboarding(
  p_full_name text,
  p_organization_name text,
  p_country_id uuid,
  p_account_kind account_kind,
  p_establishment_city text default null
)
returns organizations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_org organizations;
begin
  if v_user_id is null then raise exception 'Utilisateur non authentifié'; end if;
  if length(trim(p_full_name)) not between 1 and 200 then raise exception 'Nom complet invalide'; end if;
  if length(trim(p_organization_name)) not between 1 and 300 then raise exception 'Nom d''organisation invalide'; end if;
  if not exists (select 1 from countries where id = p_country_id) then raise exception 'Pays invalide'; end if;
  if exists (select 1 from organization_members where user_id = v_user_id and accepted_at is not null) then
    raise exception 'Onboarding déjà terminé pour ce compte';
  end if;

  update profiles set full_name = trim(p_full_name), updated_at = now() where id = v_user_id;

  insert into organizations(kind, name, country_id)
  values (p_account_kind, trim(p_organization_name), p_country_id)
  returning * into v_org;

  if p_account_kind = 'establishment' then
    insert into establishments(organization_id, name, city)
    values (v_org.id, trim(p_organization_name), nullif(trim(coalesce(p_establishment_city, '')), ''));
  end if;

  insert into organization_members(organization_id, user_id, role, accepted_at)
  values (v_org.id, v_user_id, 'owner', now());

  return v_org;
end;
$$;
revoke all on function complete_onboarding(text, text, uuid, account_kind, text) from public;
grant execute on function complete_onboarding(text, text, uuid, account_kind, text) to authenticated;

-- Le profil reste modifiable par son propriétaire, mais l'organisation
-- créée doit désormais passer par complete_onboarding().

-- ---------------------------------------------------------------------------
-- Fin.
-- ---------------------------------------------------------------------------

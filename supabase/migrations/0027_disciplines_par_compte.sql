-- Migration 0027 : un compte peut désormais couvrir plusieurs disciplines.
--
-- Contexte (décision explicite de l'utilisateur) : le principe "un compte =
-- une discipline" forçait un enseignant qui cumule deux matières (ex.
-- matière principale + EDHC, très courant en Côte d'Ivoire, cf. discussion
-- EF-REF-02) à créer un deuxième compte payant rien que pour ça. La cause
-- technique : `assessments` n'avait aucune colonne de discipline, le
-- bulletin devinait la matière via `schedule_slots` (majoritaire), ce qui ne
-- fonctionne que si un compte = une seule discipline.
--
-- Cette migration : (1) donne à chaque évaluation sa discipline explicite,
-- pour que le bulletin n'ait plus besoin de deviner ; (2) introduit un
-- système de "disciplines débloquées" par compte, avec 2 gratuites et un
-- supplément au-delà — pour ne pas ouvrir la porte au partage d'un seul
-- compte entre plusieurs enseignants (risque identifié explicitement par
-- l'utilisateur), tout en couvrant sans friction le cas légitime courant
-- (une personne, deux matières).

-- --- 1. Discipline explicite sur chaque évaluation -------------------------

alter table assessments add column if not exists subject_id uuid references subjects(id);

-- Backfill best-effort pour les évaluations déjà créées : on réutilise le
-- même signal que l'ancien `getTeacherSubjectForClass` (matière majoritaire
-- du professeur sur cette classe dans son emploi du temps) plutôt que
-- d'inventer une valeur (Convention §7/§19). Les évaluations sans aucun
-- créneau correspondant restent à subject_id null — jamais deviné plus loin,
-- affiché explicitement côté app le cas échéant.
with majority_subject as (
  select distinct on (teacher_id, class_id)
    teacher_id, class_id, subject_id
  from (
    select teacher_id, class_id, subject_id, count(*) as slot_count
    from schedule_slots
    where subject_id is not null
    group by teacher_id, class_id, subject_id
  ) counted
  order by teacher_id, class_id, slot_count desc
)
update assessments a
set subject_id = ms.subject_id
from majority_subject ms
where a.teacher_id = ms.teacher_id
  and a.class_id = ms.class_id
  and a.subject_id is null;

create index if not exists idx_assessments_teacher_subject on assessments(teacher_id, subject_id);

comment on column assessments.subject_id is
  'Discipline explicite de cette évaluation. Remplace la déduction via schedule_slots (getTeacherSubjectForClass, retiré) : nécessaire pour qu''un même compte puisse couvrir plusieurs disciplines sans mélanger les bulletins.';

-- --- 2. Disciplines débloquées par compte -----------------------------------

create table teacher_discipline_grants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references subjects(id),
  source text not null default 'free' check (source in ('free', 'payment_submission')),
  payment_submission_id uuid references payment_submissions(id),
  granted_at timestamptz not null default now(),
  unique (organization_id, teacher_id, subject_id)
);

create index idx_teacher_discipline_grants_teacher on teacher_discipline_grants(organization_id, teacher_id);

comment on table teacher_discipline_grants is
  'Disciplines qu''un compte est autorisé à utiliser pour créer des évaluations. Les 2 premières par compte sont accordées automatiquement (source=free, voir ensureDisciplineGranted) ; au-delà, source=payment_submission uniquement après confirmation d''un supplément (même mécanique que organization_members.seat_payment_status, migration 0026).';

alter table teacher_discipline_grants enable row level security;

-- Un membre de l'organisation peut voir les disciplines débloquées de
-- l'organisation (même visibilité que schedule_slots) — utile à un
-- owner/admin qui doit décider de valider un supplément pour un collègue.
create policy "teacher_discipline_grants_select_org" on teacher_discipline_grants for select
  using (is_org_member(organization_id));

-- Un enseignant ne peut s'auto-accorder que des disciplines GRATUITES, pour
-- lui-même, jamais pour un collègue. Les disciplines payées (source =
-- 'payment_submission') ne sont jamais insérées par ce chemin authentifié :
-- uniquement côté serveur avec service_role, après confirmation du paiement
-- (cf. confirmWavePayment) — aucune policy insert pour ce cas, à dessein,
-- même principe que payment_submissions (migration 0025) : une organisation
-- ne peut jamais s'auto-valider un paiement.
create policy "teacher_discipline_grants_insert_self_free" on teacher_discipline_grants for insert
  with check (teacher_id = auth.uid() and is_org_member(organization_id) and source = 'free');

-- Backfill des disciplines déjà en usage légitime avant ce lot : jusqu'à 2
-- par compte, par ordre de première évaluation créée dans chaque discipline
-- — pour ne pas bloquer rétroactivement un usage déjà en place.
insert into teacher_discipline_grants (organization_id, teacher_id, subject_id, source, granted_at)
select organization_id, teacher_id, subject_id, 'free', first_used_at
from (
  select organization_id, teacher_id, subject_id, min(created_at) as first_used_at,
    row_number() over (
      partition by organization_id, teacher_id
      order by min(created_at)
    ) as discipline_rank
  from assessments
  where subject_id is not null
  group by organization_id, teacher_id, subject_id
) per_discipline
where discipline_rank <= 2
on conflict (organization_id, teacher_id, subject_id) do nothing;

-- --- 3. Supplément "discipline supplémentaire" sur payment_submissions -----

alter table payment_submissions drop constraint if exists payment_submissions_submission_kind_check;
alter table payment_submissions add constraint payment_submissions_submission_kind_check
  check (submission_kind in ('subscription', 'seat_addition', 'discipline_addition'));

alter table payment_submissions add column if not exists discipline_teacher_id uuid references auth.users(id);
alter table payment_submissions add column if not exists discipline_subject_id uuid references subjects(id);

comment on column payment_submissions.discipline_teacher_id is
  'Renseigné uniquement pour submission_kind=discipline_addition : le compte pour lequel une 3e discipline (ou plus) est demandée.';
comment on column payment_submissions.discipline_subject_id is
  'Renseigné uniquement pour submission_kind=discipline_addition : la discipline supplémentaire demandée.';

-- --- 4. report_cards a le même problème qu'assessments avant cette migration
-- (une seule ligne par class_id+student_id+school_period_id, sans notion de
-- discipline) : un compte qui couvre 2 disciplines sur la même classe
-- écraserait l'appréciation de l'une avec celle de l'autre. Même correction
-- que pour assessments.

alter table report_cards add column if not exists subject_id uuid references subjects(id);

with majority_subject as (
  select distinct on (teacher_id, class_id)
    teacher_id, class_id, subject_id
  from (
    select teacher_id, class_id, subject_id, count(*) as slot_count
    from schedule_slots
    where subject_id is not null
    group by teacher_id, class_id, subject_id
  ) counted
  order by teacher_id, class_id, slot_count desc
),
-- report_cards n'a pas de teacher_id : on retrouve le professeur via les
-- évaluations déjà migrées ci-dessus (assessments.subject_id), la classe et
-- la discipline majoritaire.
class_subject as (
  select distinct class_id, subject_id from assessments where subject_id is not null
)
update report_cards rc
set subject_id = cs.subject_id
from class_subject cs
where rc.class_id = cs.class_id
  and rc.subject_id is null
  -- ne backfille que si la classe n'a qu'une seule discipline connue à ce
  -- stade (cas d'avant ce lot) : sinon on ne devine pas laquelle des deux
  -- appartient à cette ligne report_cards déjà existante (Convention §7/§19).
  and (select count(distinct subject_id) from assessments a2 where a2.class_id = rc.class_id) = 1;

alter table report_cards drop constraint if exists report_cards_class_id_student_id_school_period_id_key;
alter table report_cards add constraint report_cards_class_student_period_subject_key
  unique (class_id, student_id, school_period_id, subject_id);

comment on column report_cards.subject_id is
  'Discipline de cette appréciation/bulletin. Peut rester null pour une ligne créée avant ce lot sur une classe qui avait déjà 2 disciplines mêlées (cas rare, non deviné) — à corriger manuellement si rencontré.';

-- ============================================================================
-- 0004_pedagogie.sql
-- Boucle de valeur : progression -> cours -> evaluation -> notes -> analyse
-- -> remediation. Convention §76 : 4 choses toujours distinctes -
-- (1) referentiel officiel [migration 0002], (2) planification du prof
-- (teacher_progressions, lessons), (3) historique reel (lesson_sessions),
-- (4) recommandation IA (content_origin = 'ai_generated' partout).
-- ============================================================================

-- (2) Ce que le professeur PREVOIT par rapport au referentiel officiel.
create table teacher_progressions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  curriculum_unit_id uuid not null references curriculum_units(id),
  status progression_status not null default 'planned',
  planned_start_date date,
  planned_end_date date,
  completed_at date,
  updated_at timestamptz not null default now(),
  unique (class_id, curriculum_unit_id)
);

-- Bibliotheque du professeur : cours / exercices / devoirs / interrogations /
-- corriges / fiches. `origin` distingue toujours prof vs IA (Convention §6).
create table lessons (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  teacher_id uuid not null references auth.users(id),
  class_id uuid references classes(id) on delete set null,
  curriculum_unit_id uuid references curriculum_units(id),
  title text not null,
  content jsonb not null default '{}'::jsonb, -- objectifs, activites, exemples, synthese...
  origin content_origin not null default 'teacher',
  version int not null default 1,             -- Convention §49 : versionnage des contenus
  duration_minutes int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- (3) Ce que le professeur a REELEMENT fait, seance par seance (cahier de texte).
create table lesson_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  lesson_id uuid references lessons(id) on delete set null,
  class_id uuid not null references classes(id) on delete cascade,
  schedule_slot_id uuid references schedule_slots(id) on delete set null,
  session_date date not null,
  content_summary text,
  homework text,
  observations text,
  created_at timestamptz not null default now()
);

create table exercises (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  teacher_id uuid not null references auth.users(id),
  curriculum_unit_id uuid references curriculum_units(id),
  competency_id uuid references competencies(id),
  statement text not null,
  answer text,
  correction text,
  difficulty smallint check (difficulty between 1 and 5),
  origin content_origin not null default 'teacher',
  created_at timestamptz not null default now()
);

create table assessments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  teacher_id uuid not null references auth.users(id),
  class_id uuid not null references classes(id) on delete cascade,
  title text not null,
  assessment_type assessment_type not null default 'interrogation',
  assessment_date date not null default current_date,
  max_score numeric(5,2) not null default 20,
  coefficient numeric(4,2) not null default 1,
  duration_minutes int,
  origin content_origin not null default 'teacher',
  published boolean not null default false, -- §50 : jamais publie automatiquement par l'IA
  created_at timestamptz not null default now()
);

create table assessment_units (
  assessment_id uuid not null references assessments(id) on delete cascade,
  curriculum_unit_id uuid not null references curriculum_units(id) on delete cascade,
  primary key (assessment_id, curriculum_unit_id)
);

create table assessment_questions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references assessments(id) on delete cascade,
  exercise_id uuid references exercises(id) on delete set null,
  competency_id uuid references competencies(id),
  statement text not null,
  max_points numeric(5,2) not null default 1,
  ordering int not null default 0
);

-- Notes : structurees et validees (Convention §31/§43).
create table results (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  assessment_id uuid not null references assessments(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  score numeric(5,2),
  is_absent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assessment_id, student_id),
  constraint result_score_within_bounds check (
    score is null or (score >= 0)
  )
);

-- Traçabilite des analyses/recommandations IA (Convention §24).
create table ai_recommendations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  class_id uuid references classes(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  curriculum_unit_id uuid references curriculum_units(id),
  kind text not null,                      -- 'remediation', 'progression_alert', 'difficulty_alert', ...
  summary text not null,
  based_on jsonb not null default '{}'::jsonb, -- ids evaluations/questions utilises
  accepted boolean,
  created_at timestamptz not null default now()
);

create table remediations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  curriculum_unit_id uuid references curriculum_units(id),
  scope text not null default 'group',     -- 'individual' | 'group' | 'class'
  content jsonb not null default '{}'::jsonb,
  origin content_origin not null default 'ai_generated',
  created_at timestamptz not null default now()
);

create table remediation_students (
  remediation_id uuid not null references remediations(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  primary key (remediation_id, student_id)
);

create index idx_lessons_class on lessons(class_id);
create index idx_results_student on results(student_id);
create index idx_results_assessment on results(assessment_id);
create index idx_teacher_progressions_class on teacher_progressions(class_id);

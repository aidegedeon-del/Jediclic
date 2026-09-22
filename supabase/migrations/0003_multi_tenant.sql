-- ============================================================================
-- 0003_multi_tenant.sql
-- Le "dossier pedagogique" cote organisation : Organization -> Establishment
-- -> Teachers -> Classes -> Students. Convention §25/§26 : une organisation
-- ne doit jamais acceder aux donnees d'une autre (isole plus tard par RLS
-- dans 0006_rls_policies.sql).
-- ============================================================================

-- Une organisation = soit un professeur individuel (auto-organisation),
-- soit un etablissement scolaire. Convention §33 : Organization -> Subscription.
create table organizations (
  id uuid primary key default gen_random_uuid(),
  kind account_kind not null,
  name text not null,
  country_id uuid not null references countries(id),
  default_locale text not null default 'fr',
  created_at timestamptz not null default now()
);

create table establishments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  city text,
  created_at timestamptz not null default now()
);

-- Profil utilisateur, lie 1:1 a auth.users. Les ROLES sont geres a part
-- (organization_members), jamais comme un simple champ libre (Convention §66).
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  preferred_locale text not null default 'fr',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role user_role not null default 'teacher',
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  suspended_at timestamptz,
  unique (organization_id, user_id)
);

create table classes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  establishment_id uuid references establishments(id) on delete set null,
  teacher_id uuid not null references auth.users(id),
  education_level_id uuid not null references education_levels(id),
  school_year_id uuid not null references school_years(id),
  name text not null,                      -- ex: "3e A"
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create table students (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  full_name text not null,
  student_number text,                     -- matricule etablissement, optionnel
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create table schedule_slots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  teacher_id uuid not null references auth.users(id),
  class_id uuid not null references classes(id) on delete cascade,
  subject_id uuid not null references subjects(id),
  weekday smallint not null check (weekday between 0 and 6), -- 0 = lundi
  start_time time not null,
  end_time time not null,
  room text,
  recurring boolean not null default true,
  created_at timestamptz not null default now(),
  constraint schedule_time_order check (end_time > start_time)
);

create index idx_classes_org on classes(organization_id);
create index idx_students_class on students(class_id);
create index idx_schedule_teacher on schedule_slots(teacher_id, weekday);

-- Detection de conflits (Convention §13/§18) : un meme professeur ne peut pas
-- avoir deux creneaux qui se chevauchent le meme jour. Applique en base pour
-- ne pas reposer uniquement sur l'interface (§26).
create extension if not exists btree_gist;
alter table schedule_slots
  add constraint no_teacher_overlap
  exclude using gist (
    teacher_id with =,
    weekday with =,
    tsrange(
      ('2000-01-01'::date + start_time)::timestamp,
      ('2000-01-01'::date + end_time)::timestamp
    ) with &&
  );

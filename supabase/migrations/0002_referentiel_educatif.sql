-- ============================================================================
-- 0002_referentiel_educatif.sql
-- Le "cerveau referentiel" : connaissance du systeme educatif, generique et
-- multi-pays. Convention §7, §8, §9 : AUCUNE table specifique par pays
-- (interdiction explicite de senegal_tables / benin_tables / togo_tables).
-- Tout est parametre par des lignes de donnees, pas par le schema.
-- Hierarchie : Country -> EducationSystem -> SchoolYear (global) -> Cycle ->
-- Level -> Subject -> Curriculum (version) -> CurriculumUnit -> Competency
-- -> OfficialProgressionStep
-- ============================================================================

create table countries (
  id uuid primary key default gen_random_uuid(),
  iso_code text not null unique,           -- 'CI', 'SN', 'BJ', ...
  name text not null,
  default_locale text not null default 'fr',
  created_at timestamptz not null default now()
);

create table education_systems (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references countries(id) on delete cascade,
  name text not null,                      -- ex: "Systeme educatif ivoirien"
  authority_name text,                     -- ex: "MENA / DPFC"
  created_at timestamptz not null default now(),
  unique (country_id, name)
);

-- Annees scolaires : globales, reutilisees par tous les referentiels et par
-- les donnees d'organisation (Convention §37).
create table school_years (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references countries(id) on delete cascade,
  label text not null,                     -- ex: "2026-2027"
  starts_on date not null,
  ends_on date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  unique (country_id, label)
);

create table education_cycles (
  id uuid primary key default gen_random_uuid(),
  education_system_id uuid not null references education_systems(id) on delete cascade,
  name text not null,                      -- ex: "College", "Lycee"
  ordering int not null default 0
);

create table education_levels (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references education_cycles(id) on delete cascade,
  name text not null,                      -- ex: "3e", "Terminale D"
  ordering int not null default 0,
  unique (cycle_id, name)
);

create table subjects (
  id uuid primary key default gen_random_uuid(),
  education_system_id uuid not null references education_systems(id) on delete cascade,
  name text not null,                      -- ex: "Mathematiques"
  code text,
  created_at timestamptz not null default now(),
  unique (education_system_id, name)
);

-- Un programme officiel est VERSIONNE (Convention §10) : jamais ecrase, une
-- nouvelle annee = une nouvelle ligne curricula, l'historique reste lisible.
create table curricula (
  id uuid primary key default gen_random_uuid(),
  education_level_id uuid not null references education_levels(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  school_year_id uuid not null references school_years(id) on delete cascade,
  version_label text not null,             -- ex: "Version 2026-2027"
  source_document_url text,                -- lien vers le document officiel DPFC
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (education_level_id, subject_id, school_year_id, version_label)
);

create table curriculum_units (
  id uuid primary key default gen_random_uuid(),
  curriculum_id uuid not null references curricula(id) on delete cascade,
  parent_unit_id uuid references curriculum_units(id) on delete cascade,
  title text not null,                     -- chapitre ou notion
  ordering int not null default 0,
  recommended_hours numeric(5,2),
  created_at timestamptz not null default now()
);

create table competencies (
  id uuid primary key default gen_random_uuid(),
  curriculum_unit_id uuid not null references curriculum_units(id) on delete cascade,
  title text not null,
  description text
);

-- La progression OFFICIELLE : a quelle date/semaine une unite devrait etre
-- traitee selon le referentiel. Convention §11 : ne jamais fusionner avec la
-- progression reelle du professeur (table teacher_progressions, migration 4).
create table official_progression_steps (
  id uuid primary key default gen_random_uuid(),
  curriculum_id uuid not null references curricula(id) on delete cascade,
  curriculum_unit_id uuid not null references curriculum_units(id) on delete cascade,
  expected_week int,                       -- semaine indicative dans l'annee scolaire
  expected_start_date date,
  expected_end_date date,
  ordering int not null default 0
);

create index idx_curriculum_units_curriculum on curriculum_units(curriculum_id);
create index idx_official_progression_curriculum on official_progression_steps(curriculum_id);

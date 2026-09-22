-- ============================================================================
-- 0011_periodes_bulletins.sql
-- EF-NOTES-02 : périodes scolaires officielles (trimestres/semestres) et
-- bulletins (notes + moyennes + appréciations + observations, PRD §49).
--
-- Convention §9 : générique multi-pays, aucune table par pays — une période
-- est une ligne de donnée rattachée à `school_years` (elle-même par pays),
-- pas un schéma dédié à la Côte d'Ivoire.
-- Convention §6/§54 : ces dates ne sont "officielles" que si elles sont
-- réellement chargées. Cette migration ne pré-remplit AUCUNE date pour la
-- Côte d'Ivoire (même logique que le squelette référentiel de 0007) : les
-- vraies dates DPFC/MENA doivent être saisies avant utilisation réelle,
-- jamais inventées ici. Tant qu'aucune ligne n'existe pour une année
-- scolaire donnée, l'application doit le dire plutôt que de permettre un
-- bulletin sur une période fictive.
-- ============================================================================

create table school_periods (
  id uuid primary key default gen_random_uuid(),
  school_year_id uuid not null references school_years(id) on delete cascade,
  label text not null,             -- ex: "Trimestre 1"
  ordering int not null default 0,
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now(),
  unique (school_year_id, label),
  constraint school_period_date_order check (ends_on > starts_on)
);

create index idx_school_periods_year on school_periods(school_year_id);

-- Bulletin = l'état "professeur" par élève x période x classe : appréciation
-- + observations. Les notes/moyennes elles-mêmes ne sont JAMAIS dupliquées
-- ici (source de vérité = `results`, comme la page Notes existante) —
-- calculées à la volée en filtrant les évaluations publiées dont la date
-- tombe dans la période (même principe que EF-PROG-03 : jamais deux
-- implémentations qui pourraient diverger).
create table report_cards (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  school_period_id uuid not null references school_periods(id) on delete cascade,
  appreciation text,
  observations text,
  origin content_origin not null default 'teacher',
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, student_id, school_period_id)
);

create index idx_report_cards_period on report_cards(school_period_id);
create index idx_report_cards_student on report_cards(student_id);

alter table school_periods enable row level security;
alter table report_cards enable row level security;

-- Référentiel : même politique que school_years/curricula (0006) — lecture
-- authentifiée libre, écriture réservée à service_role (admin plateforme).
create policy "referentiel_read_authenticated" on school_periods for select using (auth.role() = 'authenticated');

create policy "report_cards_org_members" on report_cards for all
  using (is_org_member(organization_id)) with check (is_org_member(organization_id));

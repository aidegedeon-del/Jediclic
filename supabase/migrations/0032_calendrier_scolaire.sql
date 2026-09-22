-- ============================================================================
-- 0032_calendrier_scolaire.sql
-- Suite de la discussion du 25 août 2026 : le "découpage de l'année
-- scolaire" publié chaque année par le MENA/DELC (trimestres, congés,
-- vacances, dates d'examens, journées pédagogiques) — pas un calendrier
-- générique, LE découpage officiel ivoirien, republié dans les mêmes
-- termes chaque rentrée.
--
-- Même schéma de principe que `school_periods` (0011) : rattaché à
-- `school_years` (référentiel par pays, Convention §9), lecture libre,
-- écriture réservée à service_role (0006) — un enseignant ou un
-- établissement ne saisit jamais ces dates lui-même. Quand le découpage
-- d'une nouvelle année devient officiel, il est chargé une fois par une
-- migration (comme celle-ci), et l'app entière le reflète automatiquement
-- (dashboard, assistant, etc.) — sans aucune action de la part des
-- utilisateurs, exactement la demande de l'utilisateur.
--
-- Convention §6/§54 : cette migration ne pré-remplit AUCUNE date pour
-- 2026-2027. Vérifié le 25 août 2026 : le MENA n'a pas encore publié le
-- découpage officiel de l'année scolaire 2026-2027 au moment où ce lot est
-- construit (seule la date de rentrée, lundi 14 septembre 2026, circule
-- déjà largement) — la publication officielle du DELC a lieu chaque année
-- lors de la "grande réunion de rentrée" (début septembre, ex. 1er
-- septembre pour 2025-2026). Les vraies dates 2026-2027 devront être
-- chargées dans une migration séparée dès leur publication officielle,
-- jamais estimées ni inventées ici.
-- ============================================================================

create type school_calendar_event_category as enum ('ferie', 'conge', 'examen', 'pedagogique');

create table school_calendar_events (
  id uuid primary key default gen_random_uuid(),
  school_year_id uuid not null references school_years(id) on delete cascade,
  category school_calendar_event_category not null,
  label text not null,             -- ex: "Congés de Noël et du Nouvel An", "Tabaski", "BEPC (session normale)"
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now(),
  constraint school_calendar_event_date_order check (ends_on >= starts_on)
);

create index idx_school_calendar_events_year on school_calendar_events(school_year_id);
create index idx_school_calendar_events_dates on school_calendar_events(starts_on, ends_on);

alter table school_calendar_events enable row level security;

create policy "referentiel_read_authenticated" on school_calendar_events for select using (auth.role() = 'authenticated');

comment on table school_calendar_events is
  'Découpage officiel de l''année scolaire (congés, jours fériés, dates d''examens, journées pédagogiques), publié chaque année par le MENA/DELC. Référentiel par pays via school_year_id — jamais saisi par un enseignant ou un établissement (écriture réservée à service_role, comme school_years/school_periods).';

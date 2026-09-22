-- ============================================================================
-- 0038_performance_queries.sql
-- Complément d'indexation ciblé sur les requêtes fréquentes du dashboard.
-- Aucun changement de logique métier ou de sécurité/RLS.
-- ============================================================================

-- Dashboard : cours du jour filtrés par organisation + jour puis triés par heure.
create index if not exists idx_schedule_slots_org_weekday_start
  on schedule_slots(organization_id, weekday, start_time);

-- Programme/progression : lecture fréquente des progressions d'une organisation
-- et d'une classe. L'index conserve les colonnes les plus sélectives en tête.
create index if not exists idx_teacher_progressions_org_class
  on teacher_progressions(organization_id, class_id);

-- Calendrier : chaque tableau de l'année est lu par school_year_id et trié par date.
create index if not exists idx_school_calendar_events_year_start
  on school_calendar_events(school_year_id, starts_on);

-- Année scolaire courante : recherche par pays + is_current très fréquente.
create index if not exists idx_school_years_country_current
  on school_years(country_id)
  where is_current = true;

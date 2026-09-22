-- =============================================================================
-- GRANTs équivalents à ceux posés par défaut sur une vraie instance Supabase
-- =============================================================================
--
-- CONTEXTE : cette base locale (`jediclic_test`, PostgreSQL 17 installé via
-- apt) simule Supabase pour permettre l'exécution réelle des migrations et
-- des tests RLS, SANS l'infrastructure managée Supabase. Les schémas `auth`
-- et `storage` sont des stubs minimalistes créés pour cette validation, et
-- les rôles Postgres `anon` / `authenticated` / `service_role` existent
-- (créés lors du bootstrap de l'environnement de test), mais SANS les GRANTs
-- table-level que Supabase pose automatiquement sur ces rôles.
--
-- CONSÉQUENCE SI CE SCRIPT N'EST PAS APPLIQUÉ : toute requête exécutée avec
-- `SET ROLE authenticated` (ou `anon`) échoue immédiatement avec
-- `ERROR: permission denied for table ...`, AVANT même que PostgreSQL
-- n'évalue les policies RLS. Un tel échec ne prouve donc RIEN sur l'état
-- réel des policies RLS — il masque le test au lieu de le faire réussir ou
-- échouer pour de bonnes raisons.
--
-- CE SCRIPT NE MODIFIE AUCUNE POLICY RLS ET N'AFFAIBLIT AUCUNE SÉCURITÉ :
-- il donne uniquement aux rôles `anon`/`authenticated` le droit de *tenter*
-- une opération sur une table (condition nécessaire pour que RLS soit même
-- évalué) — exactement comme le fait Supabase par défaut. L'isolation
-- multi-tenant réelle continue de dépendre entièrement des policies RLS
-- définies dans les migrations 0001-0038.
--
-- À exécuter UNE FOIS après la création de la base de test locale et
-- l'application des migrations, avant de lancer supabase/tests/*.test.sql :
--
--   PGPASSWORD=postgres psql -h 127.0.0.1 -U postgres -d jediclic_test \
--     -v ON_ERROR_STOP=1 -f supabase/local-dev/grants_postgrest_equivalent.sql
-- =============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- service_role : sur une vraie instance Supabase, ce rôle a TOUJOURS
-- rolbypassrls=true (il contourne RLS par conception — c'est le rôle
-- utilisé par createAdminClient() côté serveur). Le stub local ne le
-- posait pas par défaut : corrigé ici le 2026-09-11 après avoir constaté
-- qu'un test réel (audit SECURITY DEFINER de expire_overdue_subscriptions)
-- montrait le CHEMIN LÉGITIME service_role échouer silencieusement à cause
-- de cet écart de stub, ce qui aurait rendu tout test utilisant
-- service_role non représentatif du comportement réel de production.
ALTER ROLE service_role BYPASSRLS;

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- anon / authenticated : accès table-level identique à Supabase (RLS
-- reste l'unique mécanisme de filtrage par ligne).
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

-- Pour toute table créée ultérieurement (migrations futures) sans GRANT
-- explicite dans la migration elle-même.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;

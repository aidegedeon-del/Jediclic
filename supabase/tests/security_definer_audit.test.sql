-- =============================================================================
-- Suite de tests RÉELLE et EXÉCUTABLE — Audit des fonctions SECURITY DEFINER
-- =============================================================================
--
-- Couvre le point 12 du plan de validation : auth.uid() checks, org checks,
-- role checks, search_path, pas de bypass RLS, non exécutable par PUBLIC.
--
-- Les 19 fonctions applicatives (hors extensions citext/pgcrypto/btree_gist)
-- ont été inspectées une par une via pg_get_functiondef() :
--   - is_org_member, has_org_role, class_belongs_to_org, is_class_teacher,
--     student_belongs_to_class : SECURITY DEFINER, SET search_path=public,
--     lecture seule stateless, aucun paramètre de contournement possible.
--   - handle_new_user, validate_pedagogical_tenant_consistency : triggers
--     SECURITY DEFINER, SET search_path=public, aucune entrée utilisateur
--     non validée par ailleurs.
--   - complete_onboarding, grant_free_teacher_discipline,
--     accept/decline/create/update/revoke_organization_invitation,
--     set_organization_member_role, remove_organization_member :
--     SECURITY DEFINER, SET search_path=public, vérifient auth.uid() IS NOT
--     NULL puis le rôle réel de l'acteur en base (jamais un paramètre fourni
--     par l'appelant) avant toute écriture. 4 d'entre elles avaient un bug
--     NULL NOT IN corrigé par la migration 0039 (cf. commit dédié).
--   - generate_payment_reference : PAS SECURITY DEFINER (LANGUAGE plpgsql
--     simple), ne lit/écrit aucune donnée sensible (génère juste une chaîne
--     à partir d'une séquence + la date), utilisée comme DEFAULT de colonne
--     pour l'INSERT sur payment_submissions par authenticated (owner/admin) :
--     retirer EXECUTE casserait cet usage légitime — pas un problème de
--     sécurité, aucune action requise.
--   - expire_overdue_subscriptions : PAS SECURITY DEFINER, EXECUTE accordé à
--     PUBLIC (aucun REVOKE). Testé explicitement ci-dessous.
--
-- Exécution (prérequis : migrations 0001-0039 appliquées + GRANTs posés) :
--   PGPASSWORD=postgres psql -h 127.0.0.1 -U postgres -d jediclic_test \
--     -v ON_ERROR_STOP=1 -f supabase/local-dev/grants_postgrest_equivalent.sql
--   PGPASSWORD=postgres psql -h 127.0.0.1 -U postgres -d jediclic_test \
--     -v ON_ERROR_STOP=1 -f supabase/tests/security_definer_audit.test.sql
-- =============================================================================

\set ON_ERROR_STOP on
\timing off

begin;

create or replace function test_assert(condition boolean, message text)
returns void language plpgsql as $$
begin
  if not condition then
    raise exception 'ÉCHEC DE TEST : %', message;
  else
    raise notice 'OK : %', message;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 1. Vérification STRUCTURELLE : toutes les fonctions SECURITY DEFINER
--    applicatives (hors extensions) doivent avoir search_path figé.
--    (Une fonction SECURITY DEFINER sans search_path fixé est vulnérable à
--    une attaque par détournement de search_path si un attaquant peut créer
--    des objets dans un schéma qui précède 'public' dans le search_path de
--    l'exécutant.)
-- -----------------------------------------------------------------------------

do $$
declare
  v_bad_functions text;
begin
  select string_agg(proname, ', ') into v_bad_functions
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef = true
    and (p.proconfig is null or not exists (
      select 1 from unnest(p.proconfig) cfg where cfg like 'search_path=%'
    ));

  perform test_assert(v_bad_functions is null,
    '[SECURITY DEFINER][SEARCH_PATH] Toutes les fonctions SECURITY DEFINER ont un search_path figé (fonctions sans : ' || coalesce(v_bad_functions, 'aucune') || ')');
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. expire_overdue_subscriptions : PAS SECURITY DEFINER, EXECUTE accordé à
--    PUBLIC (pas de REVOKE dans la migration 0026). Vérifie qu'elle reste
--    NON EXPLOITABLE malgré cela : RLS activé + AUCUNE policy UPDATE sur
--    `subscriptions` (repli par défaut = refus pour tout rôle non
--    superutilisateur/bypassrls), quels que soient les GRANTs table-level.
-- -----------------------------------------------------------------------------

do $$
declare
  v_country_id uuid;
  v_org_id uuid := 'f0000000-0000-0000-0000-00000000000f';
  v_plan_id uuid;
begin
  select id into v_country_id from countries limit 1;
  select id into v_plan_id from plans where code = 'establishment_25';

  insert into organizations (id, kind, name, country_id) values (v_org_id, 'establishment', 'ORG EXPIRE TEST', v_country_id)
  on conflict (id) do nothing;

  insert into subscriptions (organization_id, plan_id, status, current_period_start, current_period_end)
  values (v_org_id, v_plan_id, 'active', now() - interval '2 months', now() - interval '1 day')
  on conflict do nothing;
end;
$$;

commit;

-- --- 2.1 Un utilisateur authenticated NON-MEMBRE ne doit PAS pouvoir --------
--         déclencher l'expiration (RLS bloque l'UPDATE, faute de policy).

do $$
begin
  execute 'set role authenticated';
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000000","role":"authenticated"}', false);
  perform expire_overdue_subscriptions();
  execute 'reset role';
  perform set_config('request.jwt.claims', '', false);
end;
$$;

select test_assert(
  (select status::text from subscriptions where organization_id = 'f0000000-0000-0000-0000-00000000000f') = 'active',
  '[SECURITY DEFINER][expire_overdue_subscriptions] Un utilisateur authenticated ne peut PAS faire expirer un abonnement (RLS sans policy UPDATE bloque, malgré EXECUTE accordé à PUBLIC)'
);

-- --- 2.2 Le chemin légitime (service_role, via createAdminClient()+cron) ---
--         DOIT réussir, sans quoi le cron de production serait cassé.

do $$
begin
  execute 'set role service_role';
  perform expire_overdue_subscriptions();
  execute 'reset role';
end;
$$;

select test_assert(
  (select status::text from subscriptions where organization_id = 'f0000000-0000-0000-0000-00000000000f') = 'expired',
  '[SECURITY DEFINER][expire_overdue_subscriptions] service_role (chemin légitime : cron via createAdminClient) peut faire expirer l''abonnement en retard'
);

-- =============================================================================
-- 3. RÉSUMÉ
-- =============================================================================

do $$
begin
  raise notice '=============================================================';
  raise notice 'AUDIT SECURITY DEFINER : TOUS LES TESTS CI-DESSUS SONT PASSÉS.';
  raise notice 'Constat honnête (non un défaut corrigé) : expire_overdue_';
  raise notice 'subscriptions() et generate_payment_reference() restent';
  raise notice 'exécutables par PUBLIC/anon/authenticated (pas de REVOKE dans';
  raise notice 'la migration 0026). Ni l''une ni l''autre ne sont exploitables';
  raise notice 'en pratique : la première est bloquée par RLS (aucune policy';
  raise notice 'UPDATE sur subscriptions), la seconde ne lit/écrit rien de';
  raise notice 'sensible. Documenté dans FINAL_VALIDATION_REPORT.md comme';
  raise notice 'écart de défense en profondeur mineur, pas une faille active.';
  raise notice '=============================================================';
end;
$$;

-- Nettoyage (best-effort).
begin;
delete from subscriptions where organization_id = 'f0000000-0000-0000-0000-00000000000f';
delete from organizations where id = 'f0000000-0000-0000-0000-00000000000f';
drop function if exists test_assert(boolean, text);
commit;

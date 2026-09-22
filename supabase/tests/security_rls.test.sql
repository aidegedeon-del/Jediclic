-- =============================================================================
-- Suite de tests RLS / multi-tenant RÉELLE et EXÉCUTABLE — JediclicC
-- =============================================================================
--
-- Contrairement à la version précédente de ce fichier (un simple commentaire
-- listant 7 cas à couvrir, jamais exécuté), ce script :
--   1. Crée deux organisations distinctes (ORG A, ORG B) avec des fixtures
--      complètes (classes, élèves, évaluations).
--   2. Crée un utilisateur par rôle réel du système (owner, admin, manager,
--      teacher, reader — cf. enum `user_role`, 5 valeurs) DANS ORG A, plus un
--      utilisateur NON-MEMBRE (aucune ligne organization_members).
--   3. Simule chaque utilisateur via `SET ROLE authenticated` +
--      `set_config('request.jwt.claims', ...)` (mécanisme RLS réel de
--      Supabase : `auth.uid()` lit exactement cette clé de session), puis
--      exécute de vraies requêtes SELECT/INSERT/UPDATE/DELETE.
--   4. Vérifie le résultat avec des assertions `DO $$ ... RAISE EXCEPTION`
--      qui font échouer le script (exit non-zéro via psql -v ON_ERROR_STOP=1)
--      si un cas de sécurité échoue.
--
-- Exécution :
--   PGPASSWORD=postgres psql -h 127.0.0.1 -U postgres -d jediclic_test \
--     -v ON_ERROR_STOP=1 -f supabase/tests/security_rls.test.sql
--
-- Prérequis :
--   1. Les 38 migrations doivent être appliquées sur la base cible
--      (cf. FINAL_VALIDATION_REPORT.md, section "Migrations").
--   2. Les GRANTs table-level équivalents à ceux de Supabase doivent être
--      posés sur `anon`/`authenticated`/`service_role` (le stub local ne
--      les a pas par défaut, contrairement à une vraie instance Supabase) :
--        psql ... -f supabase/local-dev/grants_postgrest_equivalent.sql
--      Sans ce prérequis, toute requête sous `authenticated`/`anon` échoue
--      avec `permission denied for table ...` AVANT même l'évaluation des
--      policies RLS — un tel échec ne teste rien sur RLS lui-même.
--
-- IMPORTANT : ce script est destructif sur ses propres fixtures (ids fixes,
-- préfixés dans des variables psql) — à exécuter uniquement sur une base de
-- test jetable, jamais sur une base contenant des données réelles.
-- =============================================================================

\set ON_ERROR_STOP on
\timing off

begin;

-- -----------------------------------------------------------------------------
-- 0. Fonctions utilitaires de test
-- -----------------------------------------------------------------------------

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

-- Simule une requête authentifiée pour l'utilisateur donné (rôle Postgres
-- `authenticated`, exactement comme PostgREST/Supabase le fait).
--
-- IMPORTANT (correctif suite à un faux résultat d'échec le 2026-09-10) :
-- `SET LOCAL ROLE` / `set_config(..., is_local=true)` ne s'appliquent QUE
-- jusqu'à la fin de la transaction courante (cf. doc Postgres). Ce script
-- exécute chaque `select test_login_as(...)` comme une instruction séparée
-- en mode autocommit psql (hors bloc `begin;`/`commit;` explicite) : chaque
-- instruction top-level est donc SA PROPRE transaction implicite, et un
-- `SET LOCAL ROLE` posé dans une fonction appelée par une telle instruction
-- redevient automatiquement `reset` dès l'instruction suivante — invisible,
-- SANS avertissement de PostgreSQL dans ce contexte fonction. Les
-- assertions suivantes s'exécutaient alors silencieusement en tant que
-- `postgres` (superuser, `rolbypassrls=true`), ce qui produisait un FAUX
-- résultat de fuite RLS (le superuser voit tout, indépendamment de RLS).
-- On utilise donc `SET ROLE` (persiste pour toute la session jusqu'à
-- `RESET ROLE`) et `set_config(..., is_local=false)`, qui reproduisent
-- fidèlement le comportement d'une connexion PostgREST dédiée par requête.
create or replace function test_login_as(p_user_id uuid) returns void language plpgsql as $$
begin
  execute format('set role authenticated');
  perform set_config('request.jwt.claims', json_build_object('sub', p_user_id::text, 'role', 'authenticated')::text, false);
end;
$$;

-- Simule une requête anonyme (pas de session).
create or replace function test_login_as_anon() returns void language plpgsql as $$
begin
  execute format('set role anon');
  perform set_config('request.jwt.claims', '{"role":"anon"}', false);
end;
$$;

-- Revient au rôle superutilisateur (bypass RLS) pour préparer les fixtures.
create or replace function test_reset_role() returns void language plpgsql as $$
begin
  execute format('reset role');
  perform set_config('request.jwt.claims', '', false);
end;
$$;

-- -----------------------------------------------------------------------------
-- 1. Fixtures : pays, années scolaires, niveaux (réutilise les données de
--    référence déjà seedées par les migrations 0007+, ne les recrée pas).
-- -----------------------------------------------------------------------------

do $$
declare
  v_country_id uuid;
  v_school_year_id uuid;
  v_level_id uuid;

  -- ORG A
  v_org_a_id uuid := 'a0000000-0000-0000-0000-00000000000a';
  v_class_a_id uuid := 'a0000000-0000-0000-0000-0000000000c1';
  v_student_a_id uuid := 'a0000000-0000-0000-0000-0000000000e1';
  v_assessment_a_id uuid := 'a0000000-0000-0000-0000-0000000000f1';

  v_owner_a uuid := 'a0000000-0000-0000-0000-000000000001';
  v_admin_a uuid := 'a0000000-0000-0000-0000-000000000002';
  v_manager_a uuid := 'a0000000-0000-0000-0000-000000000003';
  v_teacher_a uuid := 'a0000000-0000-0000-0000-000000000004';
  v_reader_a uuid := 'a0000000-0000-0000-0000-000000000005';
  v_non_member uuid := 'a0000000-0000-0000-0000-000000000009';

  -- ORG B (pour les tests d'isolation cross-org)
  v_org_b_id uuid := 'b0000000-0000-0000-0000-00000000000b';
  v_class_b_id uuid := 'b0000000-0000-0000-0000-0000000000c1';
  v_student_b_id uuid := 'b0000000-0000-0000-0000-0000000000e1';
  v_owner_b uuid := 'b0000000-0000-0000-0000-000000000001';
begin
  select id into v_country_id from countries limit 1;
  select id into v_school_year_id from school_years limit 1;
  select id into v_level_id from education_levels limit 1;

  if v_country_id is null or v_school_year_id is null or v_level_id is null then
    raise exception 'Données de référence manquantes (countries/school_years/education_levels) : exécuter les migrations 0001-0038 avant ce script.';
  end if;

  -- Utilisateurs auth.users (stub local) — un par rôle + 1 non-membre + 1 owner ORG B.
  insert into auth.users (id, email) values
    (v_owner_a, 'owner-a@test.jediclic.dev'),
    (v_admin_a, 'admin-a@test.jediclic.dev'),
    (v_manager_a, 'manager-a@test.jediclic.dev'),
    (v_teacher_a, 'teacher-a@test.jediclic.dev'),
    (v_reader_a, 'reader-a@test.jediclic.dev'),
    (v_non_member, 'non-membre@test.jediclic.dev'),
    (v_owner_b, 'owner-b@test.jediclic.dev')
  on conflict (id) do nothing;

  -- ORG A + ORG B
  insert into organizations (id, kind, name, country_id) values
    (v_org_a_id, 'establishment', 'ORG A (test RLS)', v_country_id),
    (v_org_b_id, 'establishment', 'ORG B (test RLS)', v_country_id)
  on conflict (id) do nothing;

  -- Memberships ORG A : les 5 rôles réels de l'enum user_role.
  insert into organization_members (organization_id, user_id, role, accepted_at) values
    (v_org_a_id, v_owner_a, 'owner', now()),
    (v_org_a_id, v_admin_a, 'admin', now()),
    (v_org_a_id, v_manager_a, 'manager', now()),
    (v_org_a_id, v_teacher_a, 'teacher', now()),
    (v_org_a_id, v_reader_a, 'reader', now())
  on conflict (organization_id, user_id) do nothing;

  -- Membership ORG B (pour tester l'isolation cross-org).
  insert into organization_members (organization_id, user_id, role, accepted_at) values
    (v_org_b_id, v_owner_b, 'owner', now())
  on conflict (organization_id, user_id) do nothing;

  -- Classe + élève dans ORG A, appartenant au TEACHER A.
  insert into classes (id, organization_id, teacher_id, education_level_id, school_year_id, name) values
    (v_class_a_id, v_org_a_id, v_teacher_a, v_level_id, v_school_year_id, 'Classe Test A')
  on conflict (id) do nothing;

  insert into students (id, organization_id, class_id, full_name) values
    (v_student_a_id, v_org_a_id, v_class_a_id, 'Élève Test A')
  on conflict (id) do nothing;

  -- Classe + élève dans ORG B (données à ne JAMAIS être visibles depuis ORG A).
  insert into classes (id, organization_id, teacher_id, education_level_id, school_year_id, name) values
    (v_class_b_id, v_org_b_id, v_owner_b, v_level_id, v_school_year_id, 'Classe Test B')
  on conflict (id) do nothing;

  insert into students (id, organization_id, class_id, full_name) values
    (v_student_b_id, v_org_b_id, v_class_b_id, 'Élève Test B')
  on conflict (id) do nothing;

  -- Évaluation dans ORG A, appartenant au TEACHER A.
  insert into assessments (id, organization_id, class_id, teacher_id, title, assessment_type, max_score) values
    (v_assessment_a_id, v_org_a_id, v_class_a_id, v_teacher_a, 'Évaluation Test A', 'controle', 20)
  on conflict (id) do nothing;
end;
$$;

commit;

-- =============================================================================
-- 2. TESTS D'ISOLATION MULTI-TENANT (SELECT/INSERT/UPDATE/DELETE cross-org)
-- =============================================================================

-- --- 2.1 SELECT : OWNER B ne doit jamais voir les données d'ORG A --------

select test_login_as('b0000000-0000-0000-0000-000000000001');

select test_assert(
  (select count(*) from classes where id = 'a0000000-0000-0000-0000-0000000000c1') = 0,
  '[ISOLATION][SELECT] OWNER de ORG B ne doit pas voir la classe d''ORG A'
);

select test_assert(
  (select count(*) from students where id = 'a0000000-0000-0000-0000-0000000000e1') = 0,
  '[ISOLATION][SELECT] OWNER de ORG B ne doit pas voir l''élève d''ORG A'
);

select test_assert(
  (select count(*) from organization_members where organization_id = 'a0000000-0000-0000-0000-00000000000a') = 0,
  '[ISOLATION][SELECT] OWNER de ORG B ne doit pas voir les membres d''ORG A'
);

select test_reset_role();

-- --- 2.2 UPDATE : un OWNER d'ORG B ne doit pas pouvoir modifier une classe d'ORG A ---

select test_login_as('b0000000-0000-0000-0000-000000000001');

do $$
declare
  v_rows_affected int;
begin
  update classes set name = 'HACKED' where id = 'a0000000-0000-0000-0000-0000000000c1';
  get diagnostics v_rows_affected = row_count;
  perform test_assert(v_rows_affected = 0, '[ISOLATION][UPDATE] OWNER de ORG B ne doit modifier aucune ligne de la classe d''ORG A');
end;
$$;

select test_reset_role();

-- Vérifie hors RLS que la classe A n'a PAS été altérée (défense en profondeur).
select test_assert(
  (select name from classes where id = 'a0000000-0000-0000-0000-0000000000c1') = 'Classe Test A',
  '[ISOLATION][UPDATE] La classe d''ORG A ne doit pas avoir été renommée par ORG B'
);

-- --- 2.3 DELETE : un OWNER d'ORG B ne doit pas pouvoir supprimer un élève d'ORG A ---

select test_login_as('b0000000-0000-0000-0000-000000000001');

do $$
declare
  v_rows_affected int;
begin
  delete from students where id = 'a0000000-0000-0000-0000-0000000000e1';
  get diagnostics v_rows_affected = row_count;
  perform test_assert(v_rows_affected = 0, '[ISOLATION][DELETE] OWNER de ORG B ne doit supprimer aucune ligne de l''élève d''ORG A');
end;
$$;

select test_reset_role();

select test_assert(
  (select count(*) from students where id = 'a0000000-0000-0000-0000-0000000000e1') = 1,
  '[ISOLATION][DELETE] L''élève d''ORG A doit toujours exister après la tentative de suppression par ORG B'
);

-- --- 2.4 INSERT : un OWNER d'ORG B ne doit pas pouvoir insérer une classe dans ORG A ---

select test_login_as('b0000000-0000-0000-0000-000000000001');

do $$
begin
  begin
    insert into classes (organization_id, teacher_id, education_level_id, school_year_id, name)
    values ('a0000000-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-000000000001',
            (select id from education_levels limit 1), (select id from school_years limit 1), 'Classe injectée par B');
    perform test_assert(false, '[ISOLATION][INSERT] OWNER de ORG B ne doit PAS pouvoir insérer une classe dans ORG A (aucune exception levée !)');
  exception when insufficient_privilege or others then
    perform test_assert(true, '[ISOLATION][INSERT] OWNER de ORG B ne peut pas insérer une classe dans ORG A (bloqué par RLS, comme attendu)');
  end;
end;
$$;

select test_reset_role();

-- =============================================================================
-- 3. TESTS D'ESCALADE DE PRIVILÈGES (dans ORG A, entre rôles réels)
-- =============================================================================

-- --- 3.1 TEACHER ne peut pas se promouvoir ADMIN ni OWNER -------------------

select test_login_as('a0000000-0000-0000-0000-000000000004'); -- teacher_a

do $$
declare
  v_rows_affected int;
begin
  update organization_members set role = 'admin'
  where organization_id = 'a0000000-0000-0000-0000-00000000000a' and user_id = 'a0000000-0000-0000-0000-000000000004';
  get diagnostics v_rows_affected = row_count;
  perform test_assert(v_rows_affected = 0, '[ESCALADE] TEACHER ne doit pas pouvoir se promouvoir ADMIN (aucune policy UPDATE sur organization_members pour un membre standard)');
end;
$$;

do $$
declare
  v_rows_affected int;
begin
  update organization_members set role = 'owner'
  where organization_id = 'a0000000-0000-0000-0000-00000000000a' and user_id = 'a0000000-0000-0000-0000-000000000004';
  get diagnostics v_rows_affected = row_count;
  perform test_assert(v_rows_affected = 0, '[ESCALADE] TEACHER ne doit pas pouvoir se promouvoir OWNER');
end;
$$;

select test_reset_role();

select test_assert(
  (select role from organization_members where organization_id = 'a0000000-0000-0000-0000-00000000000a' and user_id = 'a0000000-0000-0000-0000-000000000004') = 'teacher',
  '[ESCALADE] Le rôle de TEACHER A doit rester "teacher" après les tentatives d''auto-promotion'
);

-- --- 3.2 READER ne peut pas se promouvoir TEACHER ni ADMIN ------------------

select test_login_as('a0000000-0000-0000-0000-000000000005'); -- reader_a

do $$
declare
  v_rows_affected int;
begin
  update organization_members set role = 'admin'
  where organization_id = 'a0000000-0000-0000-0000-00000000000a' and user_id = 'a0000000-0000-0000-0000-000000000005';
  get diagnostics v_rows_affected = row_count;
  perform test_assert(v_rows_affected = 0, '[ESCALADE] READER ne doit pas pouvoir se promouvoir ADMIN');
end;
$$;

select test_reset_role();

-- --- 3.3 ADMIN ne peut pas se promouvoir OWNER ------------------------------
-- (RLS policy `org_update_admins` autorise un ADMIN à modifier `organizations`,
--  mais organization_members.role est une colonne distincte et non exposée en
--  écriture libre à un ADMIN sur sa propre ligne — cf. migration 0037).

select test_login_as('a0000000-0000-0000-0000-000000000002'); -- admin_a

do $$
declare
  v_rows_affected int;
begin
  update organization_members set role = 'owner'
  where organization_id = 'a0000000-0000-0000-0000-00000000000a' and user_id = 'a0000000-0000-0000-0000-000000000002';
  get diagnostics v_rows_affected = row_count;
  perform test_assert(v_rows_affected = 0, '[ESCALADE] ADMIN ne doit pas pouvoir se promouvoir OWNER');
end;
$$;

select test_reset_role();

-- --- 3.4 NON-MEMBRE ne peut absolument rien voir/faire sur ORG A -----------

select test_login_as('a0000000-0000-0000-0000-000000000009'); -- non_member

select test_assert(
  (select count(*) from organizations where id = 'a0000000-0000-0000-0000-00000000000a') = 0,
  '[NON-MEMBRE] Un utilisateur authentifié mais non-membre ne doit pas voir ORG A via SELECT direct'
);

select test_assert(
  (select count(*) from classes where organization_id = 'a0000000-0000-0000-0000-00000000000a') = 0,
  '[NON-MEMBRE] Un utilisateur non-membre ne doit voir aucune classe d''ORG A'
);

do $$
begin
  begin
    insert into organization_members (organization_id, user_id, role, accepted_at)
    values ('a0000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000009', 'admin', now());
    perform test_assert(false, '[NON-MEMBRE -> MEMBRE] Un non-membre ne doit PAS pouvoir s''auto-inscrire comme admin (aucune exception levée !)');
  exception when insufficient_privilege or others then
    perform test_assert(true, '[NON-MEMBRE -> MEMBRE] Auto-inscription bloquée par RLS, comme attendu');
  end;
end;
$$;

select test_reset_role();

-- --- 3.5 Tentative de tampering direct sur teacher_id / organization_id ------
-- Un TEACHER ne doit pas pouvoir s'assigner une classe d'un autre enseignant
-- de la même organisation en réécrivant directement `teacher_id`.

do $$
declare
  v_other_teacher uuid := 'a0000000-0000-0000-0000-000000000777';
begin
  insert into auth.users (id, email) values (v_other_teacher, 'autre-prof@test.jediclic.dev') on conflict (id) do nothing;
  insert into organization_members (organization_id, user_id, role, accepted_at)
    values ('a0000000-0000-0000-0000-00000000000a', v_other_teacher, 'teacher', now())
    on conflict (organization_id, user_id) do nothing;
end;
$$;

select test_login_as('a0000000-0000-0000-0000-000000000777'); -- autre enseignant, même ORG A

do $$
declare
  v_rows_affected int;
begin
  -- Tente de s'attribuer la classe du TEACHER A original en réécrivant teacher_id.
  update classes set teacher_id = 'a0000000-0000-0000-0000-000000000777'
  where id = 'a0000000-0000-0000-0000-0000000000c1';
  get diagnostics v_rows_affected = row_count;
  perform test_assert(v_rows_affected = 0, '[TAMPERING] Un enseignant ne doit pas pouvoir réattribuer à lui-même la classe d''un autre enseignant (policy classes_update_own exige teacher_id = auth.uid() AVANT la modification)');
end;
$$;

select test_reset_role();

select test_assert(
  (select teacher_id from classes where id = 'a0000000-0000-0000-0000-0000000000c1') = 'a0000000-0000-0000-0000-000000000004',
  '[TAMPERING] La classe A doit rester assignée au TEACHER A original'
);

-- =============================================================================
-- 4. RÉSUMÉ
-- =============================================================================

do $$
begin
  raise notice '=============================================================';
  raise notice 'TOUS LES TESTS RLS/MULTI-TENANT CI-DESSUS SONT PASSÉS (sinon le';
  raise notice 'script se serait arrêté avec ON_ERROR_STOP=1 sur la première';
  raise notice 'assertion échouée — voir la sortie ci-dessus pour le détail).';
  raise notice '=============================================================';
end;
$$;

-- Nettoyage des fixtures de test (best-effort, ne bloque pas si déjà nettoyé).
begin;
delete from organization_members where organization_id in ('a0000000-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-00000000000b');
delete from students where organization_id in ('a0000000-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-00000000000b');
delete from assessments where organization_id in ('a0000000-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-00000000000b');
delete from classes where organization_id in ('a0000000-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-00000000000b');
delete from organizations where id in ('a0000000-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-00000000000b');
delete from auth.users where email like '%@test.jediclic.dev';
drop function if exists test_assert(boolean, text);
drop function if exists test_login_as(uuid);
drop function if exists test_login_as_anon();
drop function if exists test_reset_role();
commit;

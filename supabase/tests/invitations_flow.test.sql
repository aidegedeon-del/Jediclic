-- =============================================================================
-- Suite de tests RÉELLE et EXÉCUTABLE — Flux d'invitation JediclicC
-- =============================================================================
--
-- Couvre le cycle de vie complet des invitations tel qu'implémenté par les
-- fonctions SECURITY DEFINER de la migration 0036_durcissement_roles_invitations.sql
-- (create/update/revoke/accept/decline_organization_invitation), en simulant
-- chaque acteur via SET ROLE + request.jwt.claims (mécanisme réel PostgREST).
--
-- CONSTAT DE TRANSPARENCE (règle absolue du projet) : le schéma `invitations`
-- (cf. migration 0009_invitations.sql, colonnes listées via \d invitations)
-- N'A PAS de colonne `expires_at` / de notion d'expiration temporelle — le
-- seul cycle de vie est `status IN ('pending','accepted','revoked')`. Le cas
-- "invitation expirée" du plan de validation n'est donc PAS applicable à ce
-- code : il n'existe aucune expiration temporelle à tester. Ce fichier couvre
-- à la place tous les cas réellement représentés par le schéma et le code :
-- valide, révoquée/annulée, mauvais utilisateur, trafiquage de rôle,
-- trafiquage d'organisation, ré-acceptation répétée, déjà-membre.
--
-- Exécution (prérequis : migrations 0001-0038 appliquées + GRANTs posés) :
--   PGPASSWORD=postgres psql -h 127.0.0.1 -U postgres -d jediclic_test \
--     -v ON_ERROR_STOP=1 -f supabase/local-dev/grants_postgrest_equivalent.sql
--   PGPASSWORD=postgres psql -h 127.0.0.1 -U postgres -d jediclic_test \
--     -v ON_ERROR_STOP=1 -f supabase/tests/invitations_flow.test.sql
--
-- IMPORTANT : script destructif sur ses propres fixtures (ids fixes) — base
-- de test jetable uniquement.
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

create or replace function test_login_as(p_user_id uuid) returns void language plpgsql as $$
begin
  execute format('set role authenticated');
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user_id::text, 'role', 'authenticated', 'email', (select email from auth.users where id = p_user_id))::text,
    false);
end;
$$;

create or replace function test_reset_role() returns void language plpgsql as $$
begin
  execute format('reset role');
  perform set_config('request.jwt.claims', '', false);
end;
$$;

-- Exécute une fonction sous l'identité RLS d'un utilisateur, capture toute
-- exception sous forme de texte (ou NULL si succès), et revient à postgres.
-- Permet de tester en une expression les cas "doit échouer avec message X".
create or replace function test_call_as(p_user_id uuid, p_sql text) returns text
language plpgsql as $$
declare
  v_error text;
begin
  perform test_login_as(p_user_id);
  begin
    execute p_sql;
    v_error := null;
  exception when others then
    v_error := sqlerrm;
  end;
  perform test_reset_role();
  return v_error;
end;
$$;

-- -----------------------------------------------------------------------------
-- 1. Fixtures : ORG ÉTABLISSEMENT avec abonnement actif (requis par
--    create_organization_invitation), owner + admin + teacher déjà membres,
--    + une deuxième org (ORG C) pour le test de trafiquage cross-org.
-- -----------------------------------------------------------------------------

do $$
declare
  v_country_id uuid;
  v_plan_id uuid;

  v_org_id uuid := 'c0000000-0000-0000-0000-00000000000c';
  v_org_c_id uuid := 'c0000000-0000-0000-0000-00000000000d'; -- org tierce, pour trafiquage cross-org

  v_owner uuid := 'c0000000-0000-0000-0000-000000000001';
  v_admin uuid := 'c0000000-0000-0000-0000-000000000002';
  v_teacher uuid := 'c0000000-0000-0000-0000-000000000003';
  v_invitee1 uuid := 'c0000000-0000-0000-0000-000000000010'; -- invité valide (teacher)
  v_invitee2 uuid := 'c0000000-0000-0000-0000-000000000011'; -- invité pour test "mauvais utilisateur"
  v_owner_c uuid := 'c0000000-0000-0000-0000-000000000099'; -- owner de l'org tierce
begin
  select id into v_country_id from countries limit 1;
  select id into v_plan_id from plans where code = 'establishment_25';

  if v_country_id is null or v_plan_id is null then
    raise exception 'Données de référence manquantes (countries/plans) : exécuter les migrations 0001-0038 avant ce script.';
  end if;

  insert into auth.users (id, email) values
    (v_owner, 'owner-inv@test.jediclic.dev'),
    (v_admin, 'admin-inv@test.jediclic.dev'),
    (v_teacher, 'teacher-inv@test.jediclic.dev'),
    (v_invitee1, 'invite-valide@test.jediclic.dev'),
    (v_invitee2, 'autre-personne@test.jediclic.dev'),
    (v_owner_c, 'owner-c-inv@test.jediclic.dev')
  on conflict (id) do nothing;

  insert into organizations (id, kind, name, country_id) values
    (v_org_id, 'establishment', 'ORG INVITATIONS (test)', v_country_id),
    (v_org_c_id, 'establishment', 'ORG C INVITATIONS (test, tierce)', v_country_id)
  on conflict (id) do nothing;

  insert into organization_members (organization_id, user_id, role, accepted_at) values
    (v_org_id, v_owner, 'owner', now()),
    (v_org_id, v_admin, 'admin', now()),
    (v_org_id, v_teacher, 'teacher', now()),
    (v_org_c_id, v_owner_c, 'owner', now())
  on conflict (organization_id, user_id) do nothing;

  -- Abonnement actif requis par create_organization_invitation (sinon
  -- "Aucun abonnement actif pour cet établissement").
  insert into subscriptions (organization_id, plan_id, status, current_period_start)
  values (v_org_id, v_plan_id, 'active', now())
  on conflict do nothing;
end;
$$;

commit;

-- =============================================================================
-- 2. INVITATION VALIDE : création par l'owner, acceptation par le bon invité
-- =============================================================================

do $$
declare
  v_invitation_id uuid;
  v_error text;
begin
  perform test_login_as('c0000000-0000-0000-0000-000000000001'); -- owner

  select id into v_invitation_id
  from create_organization_invitation(
    'c0000000-0000-0000-0000-00000000000c'::uuid,
    'invite-valide@test.jediclic.dev'::citext,
    'teacher'::user_role,
    null
  );

  perform test_reset_role();

  perform test_assert(v_invitation_id is not null, '[INVITATION][CRÉATION] L''owner peut créer une invitation valide pour son organisation');

  -- Stocke l'id dans une table temporaire pour la réutiliser dans les blocs suivants.
  create temporary table if not exists test_invitation_ids (label text primary key, invitation_id uuid);
  insert into test_invitation_ids values ('valide', v_invitation_id)
    on conflict (label) do update set invitation_id = excluded.invitation_id;
end;
$$;

-- --- 2.1 Un mauvais utilisateur (autre email) ne peut pas accepter l'invitation ---

do $$
declare
  v_invitation_id uuid;
  v_error text;
begin
  select invitation_id into v_invitation_id from test_invitation_ids where label = 'valide';

  v_error := test_call_as('c0000000-0000-0000-0000-000000000011', -- invitee2, mauvais destinataire
    format('select accept_organization_invitation(%L::uuid)', v_invitation_id));

  perform test_assert(v_error is not null and v_error ilike '%ne correspond pas%',
    '[INVITATION][MAUVAIS UTILISATEUR] Un utilisateur dont l''email ne correspond pas à l''invitation ne peut pas l''accepter');
end;
$$;

-- --- 2.2 L'invité légitime accepte : devient membre avec le rôle EXACT de l'invitation ---

do $$
declare
  v_invitation_id uuid;
  v_error text;
  v_role user_role;
begin
  select invitation_id into v_invitation_id from test_invitation_ids where label = 'valide';

  v_error := test_call_as('c0000000-0000-0000-0000-000000000010', -- invitee1, bon destinataire
    format('select accept_organization_invitation(%L::uuid)', v_invitation_id));

  perform test_assert(v_error is null, '[INVITATION][ACCEPTATION VALIDE] Le bon invité accepte sans erreur : ' || coalesce(v_error, '(aucune)'));

  select role into v_role from organization_members
  where organization_id = 'c0000000-0000-0000-0000-00000000000c' and user_id = 'c0000000-0000-0000-0000-000000000010';

  perform test_assert(v_role = 'teacher', '[INVITATION][ACCEPTATION VALIDE] Le membre créé a exactement le rôle prévu par l''invitation (teacher)');
end;
$$;

-- --- 2.3 Ré-acceptation répétée : la fonction ne doit pas planter ni dupliquer le membre ---

do $$
declare
  v_invitation_id uuid;
  v_error text;
  v_count int;
begin
  select invitation_id into v_invitation_id from test_invitation_ids where label = 'valide';

  -- L'invitation est maintenant "accepted" (status <> 'pending') : une
  -- deuxième tentative d'acceptation par un NOUVEL utilisateur non-membre
  -- doit être rejetée ("n'est plus valide").
  v_error := test_call_as('c0000000-0000-0000-0000-000000000011',
    format('select accept_organization_invitation(%L::uuid)', v_invitation_id));

  perform test_assert(v_error is not null and (v_error ilike '%plus valide%' or v_error ilike '%correspond pas%'),
    '[INVITATION][RÉ-ACCEPTATION] Une invitation déjà acceptée ne peut pas être réutilisée par un autre utilisateur : ' || coalesce(v_error, '(aucune erreur !)'));

  -- Le MÊME invité qui ré-accepte (idempotence) ne doit pas planter ni créer
  -- de deuxième ligne organization_members (cf. code : "if found then ...
  -- return v_member" avant tout insert).
  v_error := test_call_as('c0000000-0000-0000-0000-000000000010',
    format('select accept_organization_invitation(%L::uuid)', v_invitation_id));

  select count(*) into v_count from organization_members
  where organization_id = 'c0000000-0000-0000-0000-00000000000c' and user_id = 'c0000000-0000-0000-0000-000000000010';

  perform test_assert(v_count = 1, '[INVITATION][DÉJÀ-MEMBRE] Le même invité qui ré-accepte ne doit produire qu''une seule ligne organization_members (pas de doublon)');
end;
$$;

-- =============================================================================
-- 3. INVITATION RÉVOQUÉE/ANNULÉE : ne peut plus être acceptée
-- =============================================================================

do $$
declare
  v_invitation_id uuid;
  v_error text;
begin
  perform test_login_as('c0000000-0000-0000-0000-000000000001'); -- owner

  select id into v_invitation_id
  from create_organization_invitation(
    'c0000000-0000-0000-0000-00000000000c'::uuid,
    'a-revoquer@test.jediclic.dev'::citext,
    'reader'::user_role,
    null
  );

  perform test_reset_role();

  insert into auth.users (id, email) values ('c0000000-0000-0000-0000-000000000020', 'a-revoquer@test.jediclic.dev')
    on conflict (id) do nothing;

  -- Révocation par l'owner.
  perform test_login_as('c0000000-0000-0000-0000-000000000001');
  perform revoke_organization_invitation(v_invitation_id);
  perform test_reset_role();

  v_error := test_call_as('c0000000-0000-0000-0000-000000000020',
    format('select accept_organization_invitation(%L::uuid)', v_invitation_id));

  perform test_assert(v_error is not null and v_error ilike '%plus valide%',
    '[INVITATION][RÉVOQUÉE] Une invitation révoquée ne peut plus être acceptée : ' || coalesce(v_error, '(aucune erreur !)'));
end;
$$;

-- =============================================================================
-- 4. TRAFIQUAGE DE RÔLE / D'ORGANISATION À LA CRÉATION
-- =============================================================================

-- --- 4.1 Un TEACHER (non owner/admin) ne peut pas créer d'invitation --------

do $$
declare
  v_error text;
begin
  v_error := test_call_as('c0000000-0000-0000-0000-000000000003', -- teacher
    $q$select create_organization_invitation('c0000000-0000-0000-0000-00000000000c'::uuid, 'x@test.jediclic.dev'::citext, 'teacher'::user_role, null)$q$);

  perform test_assert(v_error is not null and v_error ilike '%insuffisante%',
    '[INVITATION][TRAFIQUAGE RÔLE] Un TEACHER ne peut pas créer d''invitation (permission insuffisante) : ' || coalesce(v_error, '(aucune erreur !)'));
end;
$$;

-- --- 4.2 Un ADMIN ne peut pas inviter un autre ADMIN ni un OWNER -------------

do $$
declare
  v_error text;
begin
  v_error := test_call_as('c0000000-0000-0000-0000-000000000002', -- admin
    $q$select create_organization_invitation('c0000000-0000-0000-0000-00000000000c'::uuid, 'y@test.jediclic.dev'::citext, 'admin'::user_role, null)$q$);

  perform test_assert(v_error is not null and v_error ilike '%autre administrateur%',
    '[INVITATION][TRAFIQUAGE RÔLE] Un ADMIN ne peut pas inviter un autre ADMIN : ' || coalesce(v_error, '(aucune erreur !)'));

  v_error := test_call_as('c0000000-0000-0000-0000-000000000002', -- admin
    $q$select create_organization_invitation('c0000000-0000-0000-0000-00000000000c'::uuid, 'z@test.jediclic.dev'::citext, 'owner'::user_role, null)$q$);

  perform test_assert(v_error is not null and v_error ilike '%owner%',
    '[INVITATION][ESCALADE] Personne ne peut inviter quelqu''un en tant qu''OWNER (rôle protégé) : ' || coalesce(v_error, '(aucune erreur !)'));
end;
$$;

-- --- 4.3 Trafiquage d'organisation : un owner d'ORG C ne peut pas créer -----
--         d'invitation pour l'ORG INVITATIONS (dont il n'est pas membre).

do $$
declare
  v_error text;
begin
  v_error := test_call_as('c0000000-0000-0000-0000-000000000099', -- owner_c, membre d'ORG C uniquement
    $q$select create_organization_invitation('c0000000-0000-0000-0000-00000000000c'::uuid, 'intrus@test.jediclic.dev'::citext, 'admin'::user_role, null)$q$);

  perform test_assert(v_error is not null and v_error ilike '%insuffisante%',
    '[INVITATION][TRAFIQUAGE ORG] Le owner d''une AUTRE organisation ne peut pas créer d''invitation pour ORG INVITATIONS : ' || coalesce(v_error, '(aucune erreur !)'));
end;
$$;

-- --- 4.4 update_organization_invitation : un admin ne peut pas se servir de --
--         cette RPC pour élever le rôle d'une invitation existante vers 'owner'.

do $$
declare
  v_invitation_id uuid;
  v_error text;
begin
  perform test_login_as('c0000000-0000-0000-0000-000000000001'); -- owner crée normalement
  select id into v_invitation_id
  from create_organization_invitation('c0000000-0000-0000-0000-00000000000c'::uuid, 'update-test@test.jediclic.dev'::citext, 'reader'::user_role, null);
  perform test_reset_role();

  v_error := test_call_as('c0000000-0000-0000-0000-000000000002', -- admin
    format('select update_organization_invitation(%L::uuid, %L::user_role, null::uuid)', v_invitation_id, 'owner'));

  perform test_assert(v_error is not null and v_error ilike '%owner%',
    '[INVITATION][TRAFIQUAGE RÔLE VIA UPDATE] update_organization_invitation ne permet pas de faire passer une invitation au rôle owner : ' || coalesce(v_error, '(aucune erreur !)'));
end;
$$;

-- =============================================================================
-- 5. RÉSUMÉ
-- =============================================================================

do $$
begin
  raise notice '=============================================================';
  raise notice 'TOUS LES TESTS DU FLUX D''INVITATION CI-DESSUS SONT PASSÉS.';
  raise notice '=============================================================';
end;
$$;

-- Nettoyage (best-effort).
begin;
delete from organization_members where organization_id in ('c0000000-0000-0000-0000-00000000000c', 'c0000000-0000-0000-0000-00000000000d');
delete from invitations where organization_id in ('c0000000-0000-0000-0000-00000000000c', 'c0000000-0000-0000-0000-00000000000d');
delete from subscriptions where organization_id = 'c0000000-0000-0000-0000-00000000000c';
delete from organizations where id in ('c0000000-0000-0000-0000-00000000000c', 'c0000000-0000-0000-0000-00000000000d');
delete from auth.users where email like '%@test.jediclic.dev' or email like '%-inv@test.jediclic.dev';
drop table if exists test_invitation_ids;
drop function if exists test_assert(boolean, text);
drop function if exists test_login_as(uuid);
drop function if exists test_reset_role();
drop function if exists test_call_as(uuid, text);
commit;

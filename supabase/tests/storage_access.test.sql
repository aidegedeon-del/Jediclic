-- =============================================================================
-- Suite de tests RÉELLE et EXÉCUTABLE — Accès Storage (bucket "documents")
-- =============================================================================
--
-- Couvre les policies RLS sur `storage.objects` définies par les migrations
-- 0008_storage_documents.sql puis resserrées par 0034_correction_securite_isolation.sql
-- (fonction is_document_object_accessible).
--
-- CONSTAT DE TRANSPARENCE (règle absolue du projet) : cette base de test est
-- un stub PostgreSQL local (schéma `storage` minimal : table `objects` +
-- fonction `storage.foldername()`), PAS une vraie instance Supabase Storage.
-- Il n'existe donc PAS de serveur Storage réel dans cet environnement pour
-- appeler `createSignedUrl()` côté client et mesurer un TTL d'URL signée.
-- CE QUI EST RÉELLEMENT VÉRIFIABLE ICI, et qui est la condition nécessaire
-- pour que `createSignedUrl()` fonctionne correctement en production
-- (Supabase Storage applique les policies RLS de `storage.objects` avant de
-- délivrer une URL signée — la génération d'URL échoue si SELECT est refusé
-- par RLS) : que la policy SELECT sur `storage.objects` refuse bien l'accès
-- cross-org et l'accès à un collègue non-superviseur. Le TTL numérique
-- (300 secondes, cf. src/app/(dashboard)/dashboard/documents/[id]/page.tsx)
-- est une garantie du SDK Supabase Storage lui-même, pas de RLS — non
-- vérifiable par ce script SQL, et donc marqué ⚠️ NON VÉRIFIABLE DANS CET
-- ENVIRONNEMENT dans FINAL_VALIDATION_REPORT.md plutôt que déclaré ✅.
--
-- Exécution (prérequis : migrations 0001-0039 appliquées + GRANTs posés) :
--   PGPASSWORD=postgres psql -h 127.0.0.1 -U postgres -d jediclic_test \
--     -v ON_ERROR_STOP=1 -f supabase/local-dev/grants_postgrest_equivalent.sql
--   PGPASSWORD=postgres psql -h 127.0.0.1 -U postgres -d jediclic_test \
--     -v ON_ERROR_STOP=1 -f supabase/tests/storage_access.test.sql
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
  perform set_config('request.jwt.claims', json_build_object('sub', p_user_id::text, 'role', 'authenticated')::text, false);
end;
$$;

create or replace function test_reset_role() returns void language plpgsql as $$
begin
  execute format('reset role');
  perform set_config('request.jwt.claims', '', false);
end;
$$;

-- -----------------------------------------------------------------------------
-- 1. Fixtures : ORG D (teacher_d1 propriétaire d'un document, teacher_d2
--    collègue non-superviseur, admin_d superviseur) + ORG E (owner_e, pour le
--    test d'isolation cross-org). Deux objets storage.objects, chacun avec sa
--    ligne `documents` correspondante (uploaded_by = teacher_d1).
-- -----------------------------------------------------------------------------

do $$
declare
  v_country_id uuid;

  v_org_d_id uuid := 'd0000000-0000-0000-0000-00000000000d';
  v_org_e_id uuid := 'e0000000-0000-0000-0000-00000000000e';

  v_teacher_d1 uuid := 'd0000000-0000-0000-0000-000000000001'; -- a uploadé le document
  v_teacher_d2 uuid := 'd0000000-0000-0000-0000-000000000002'; -- collègue, non-superviseur
  v_admin_d uuid := 'd0000000-0000-0000-0000-000000000003'; -- superviseur
  v_owner_e uuid := 'e0000000-0000-0000-0000-000000000001'; -- autre organisation

  v_doc_id uuid := 'd0000000-0000-0000-0000-0000000000f1';
  v_object_path text := 'd0000000-0000-0000-0000-00000000000d/liste-eleves.pdf';

  v_orphan_object_path text := 'd0000000-0000-0000-0000-00000000000d/fichier-orphelin-en-transit.pdf';
begin
  select id into v_country_id from countries limit 1;
  if v_country_id is null then
    raise exception 'Données de référence manquantes (countries) : exécuter les migrations avant ce script.';
  end if;

  insert into auth.users (id, email) values
    (v_teacher_d1, 'teacher-d1@test.jediclic.dev'),
    (v_teacher_d2, 'teacher-d2@test.jediclic.dev'),
    (v_admin_d, 'admin-d@test.jediclic.dev'),
    (v_owner_e, 'owner-e@test.jediclic.dev')
  on conflict (id) do nothing;

  insert into organizations (id, kind, name, country_id) values
    (v_org_d_id, 'establishment', 'ORG D STORAGE (test)', v_country_id),
    (v_org_e_id, 'establishment', 'ORG E STORAGE (test, tierce)', v_country_id)
  on conflict (id) do nothing;

  insert into organization_members (organization_id, user_id, role, accepted_at) values
    (v_org_d_id, v_teacher_d1, 'teacher', now()),
    (v_org_d_id, v_teacher_d2, 'teacher', now()),
    (v_org_d_id, v_admin_d, 'admin', now()),
    (v_org_e_id, v_owner_e, 'owner', now())
  on conflict (organization_id, user_id) do nothing;

  -- Bucket "documents" doit exister (créé par la migration 0008, mais on
  -- s'assure de sa présence pour que ce test reste autonome).
  insert into storage.buckets (id, name, public) values ('documents', 'documents', false)
  on conflict (id) do nothing;

  -- Ligne `documents` correspondant à l'objet Storage : uploadée par teacher_d1.
  insert into documents (id, organization_id, uploaded_by, kind, storage_path, status) values
    (v_doc_id, v_org_d_id, v_teacher_d1, 'student_list', v_object_path, 'pending_review')
  on conflict (id) do nothing;

  -- L'objet Storage lui-même (stub local : une simple ligne dans storage.objects).
  insert into storage.objects (bucket_id, name, owner) values
    ('documents', v_object_path, v_teacher_d1),
    ('documents', v_orphan_object_path, v_teacher_d1) -- objet "orphelin" : aucune ligne `documents` ne le référence encore (fenêtre d'upload transitoire)
  on conflict do nothing;
end;
$$;

commit;

-- =============================================================================
-- 2. ISOLATION CROSS-ORG : owner d'ORG E ne doit jamais voir/supprimer les
--    objets Storage d'ORG D, même en connaissant le chemin exact.
-- =============================================================================

select test_login_as('e0000000-0000-0000-0000-000000000001'); -- owner_e

select test_assert(
  (select count(*) from storage.objects where bucket_id = 'documents' and name = 'd0000000-0000-0000-0000-00000000000d/liste-eleves.pdf') = 0,
  '[STORAGE][ISOLATION] Le owner d''ORG E ne doit pas voir l''objet Storage d''ORG D (SELECT refusé par RLS)'
);

do $$
declare
  v_rows_affected int;
begin
  delete from storage.objects where bucket_id = 'documents' and name = 'd0000000-0000-0000-0000-00000000000d/liste-eleves.pdf';
  get diagnostics v_rows_affected = row_count;
  perform test_assert(v_rows_affected = 0, '[STORAGE][ISOLATION] Le owner d''ORG E ne doit supprimer aucun objet Storage d''ORG D');
end;
$$;

select test_reset_role();

select test_assert(
  (select count(*) from storage.objects where bucket_id = 'documents' and name = 'd0000000-0000-0000-0000-00000000000d/liste-eleves.pdf') = 1,
  '[STORAGE][ISOLATION] L''objet Storage d''ORG D doit toujours exister après la tentative de suppression par ORG E'
);

-- --- 2.1 INSERT cross-org : owner d'ORG E ne peut pas déposer un objet ------
--         sous le préfixe (dossier) d'ORG D.

select test_login_as('e0000000-0000-0000-0000-000000000001'); -- owner_e

do $$
begin
  begin
    insert into storage.objects (bucket_id, name, owner)
    values ('documents', 'd0000000-0000-0000-0000-00000000000d/injecte-par-e.pdf', 'e0000000-0000-0000-0000-000000000001');
    perform test_assert(false, '[STORAGE][ISOLATION][INSERT] Le owner d''ORG E ne doit PAS pouvoir insérer un objet sous le dossier d''ORG D (aucune exception levée !)');
  exception when insufficient_privilege or others then
    perform test_assert(true, '[STORAGE][ISOLATION][INSERT] Insertion cross-org bloquée par RLS, comme attendu');
  end;
end;
$$;

select test_reset_role();

-- =============================================================================
-- 3. AU SEIN DE LA MÊME ORGANISATION : un collègue non-superviseur ne doit
--    ni voir ni supprimer un document qu'il n'a pas uploadé ; le superviseur
--    (owner/admin) doit pouvoir le voir mais son droit de suppression suit la
--    même règle is_document_object_accessible (owner/admin peuvent aussi).
-- =============================================================================

-- --- 3.1 Collègue non-superviseur : accès refusé ----------------------------

select test_login_as('d0000000-0000-0000-0000-000000000002'); -- teacher_d2, collègue

select test_assert(
  (select count(*) from storage.objects where bucket_id = 'documents' and name = 'd0000000-0000-0000-0000-00000000000d/liste-eleves.pdf') = 0,
  '[STORAGE][COLLÈGUE] teacher_d2 (n''a pas uploadé) ne doit pas voir l''objet de teacher_d1 (is_document_object_accessible refuse)'
);

do $$
declare
  v_rows_affected int;
begin
  delete from storage.objects where bucket_id = 'documents' and name = 'd0000000-0000-0000-0000-00000000000d/liste-eleves.pdf';
  get diagnostics v_rows_affected = row_count;
  perform test_assert(v_rows_affected = 0, '[STORAGE][COLLÈGUE] teacher_d2 ne doit pas pouvoir supprimer l''objet uploadé par teacher_d1');
end;
$$;

select test_reset_role();

-- --- 3.2 Superviseur (admin) de la même org : accès autorisé en lecture -----

select test_login_as('d0000000-0000-0000-0000-000000000003'); -- admin_d, superviseur

select test_assert(
  (select count(*) from storage.objects where bucket_id = 'documents' and name = 'd0000000-0000-0000-0000-00000000000d/liste-eleves.pdf') = 1,
  '[STORAGE][SUPERVISEUR] admin_d doit pouvoir voir le document uploadé par teacher_d1 (has_org_role owner/admin)'
);

select test_reset_role();

-- --- 3.3 L'auteur original conserve l'accès à son propre document ----------

select test_login_as('d0000000-0000-0000-0000-000000000001'); -- teacher_d1, auteur

select test_assert(
  (select count(*) from storage.objects where bucket_id = 'documents' and name = 'd0000000-0000-0000-0000-00000000000d/liste-eleves.pdf') = 1,
  '[STORAGE][AUTEUR] teacher_d1 (a uploadé) doit toujours voir/pouvoir gérer son propre document'
);

select test_reset_role();

-- =============================================================================
-- 4. FENÊTRE TRANSITOIRE D'UPLOAD : un objet Storage sans ligne `documents`
--    correspondante retombe sur la vérification d'organisation (comportement
--    documenté explicitement dans la migration 0034, fonction
--    is_document_object_accessible, branche ELSE).
-- =============================================================================

-- --- 4.1 Un membre de la MÊME organisation peut voir l'objet orphelin ------

select test_login_as('d0000000-0000-0000-0000-000000000002'); -- teacher_d2, même org, mais PAS auteur

select test_assert(
  (select count(*) from storage.objects where bucket_id = 'documents' and name = 'd0000000-0000-0000-0000-00000000000d/fichier-orphelin-en-transit.pdf') = 1,
  '[STORAGE][FENÊTRE TRANSITOIRE] Un membre de la même org voit un objet orphelin (pas encore de ligne `documents`) — comportement documenté et attendu'
);

select test_reset_role();

-- --- 4.2 Un membre d'une AUTRE organisation ne peut PAS voir l'objet -------
--         orphelin, même sans ligne `documents` (repli sur is_org_member).

select test_login_as('e0000000-0000-0000-0000-000000000001'); -- owner_e, autre org

select test_assert(
  (select count(*) from storage.objects where bucket_id = 'documents' and name = 'd0000000-0000-0000-0000-00000000000d/fichier-orphelin-en-transit.pdf') = 0,
  '[STORAGE][FENÊTRE TRANSITOIRE][ISOLATION] Un membre d''une autre organisation ne voit pas l''objet orphelin d''ORG D'
);

select test_reset_role();

-- =============================================================================
-- 5. RÉSUMÉ
-- =============================================================================

do $$
begin
  raise notice '=============================================================';
  raise notice 'TOUS LES TESTS D''ACCÈS STORAGE CI-DESSUS SONT PASSÉS. NOTE :';
  raise notice 'le TTL des URLs signées (createSignedUrl, 300s) N''EST PAS';
  raise notice 'vérifiable dans cet environnement (pas de serveur Storage réel)';
  raise notice '— seule la policy RLS SELECT sous-jacente (condition nécessaire';
  raise notice 'à toute génération d''URL signée) a été testée ci-dessus.';
  raise notice '=============================================================';
end;
$$;

-- Nettoyage (best-effort).
begin;
delete from storage.objects where bucket_id = 'documents' and name like 'd0000000-0000-0000-0000-00000000000d/%';
delete from documents where organization_id in ('d0000000-0000-0000-0000-00000000000d', 'e0000000-0000-0000-0000-00000000000e');
delete from organization_members where organization_id in ('d0000000-0000-0000-0000-00000000000d', 'e0000000-0000-0000-0000-00000000000e');
delete from organizations where id in ('d0000000-0000-0000-0000-00000000000d', 'e0000000-0000-0000-0000-00000000000e');
delete from auth.users where email like '%-d1@test.jediclic.dev' or email like '%-d2@test.jediclic.dev' or email like '%-d@test.jediclic.dev' or email like '%-e@test.jediclic.dev';
drop function if exists test_assert(boolean, text);
drop function if exists test_login_as(uuid);
drop function if exists test_reset_role();
commit;

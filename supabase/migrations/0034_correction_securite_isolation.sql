-- ============================================================================
-- 0034_correction_securite_isolation.sql
-- Audit de sécurité (isolation organisation / isolation professeur-professeur)
-- demandé explicitement par l'utilisateur. Convention §26 : la RLS est la
-- vraie barrière, jamais le frontend seul. Convention §15/§48 : on ne modifie
-- jamais une migration déjà livrée, on corrige par une nouvelle migration.
--
-- Cette migration ne désactive JAMAIS RLS, ne supprime AUCUNE fonctionnalité :
-- elle resserre exclusivement des policies devenues trop permissives après la
-- migration 0029 (isolation professeur/superviseur), qui n'avait pas couvert
-- 4 tables créées avant ou après elle, plus une faille d'accès indirect sur
-- le bucket Storage `documents` jamais mise à jour après 0029.
--
-- Vulnérabilités corrigées :
--   1. assistant_messages (0010)         — tout membre lisait/écrivait/effaçait
--                                           les conversations IA de N'IMPORTE
--                                           QUEL autre professeur de l'org.
--   2. student_profiles (0031)           — tout membre pouvait MODIFIER/EFFACER
--                                           la fiche permanente d'un élève,
--                                           alors qu'aucune fonctionnalité de
--                                           l'application ne fait jamais
--                                           d'UPDATE/DELETE sur cette table.
--   3. teacher_discipline_grants (0027)  — la lecture (SELECT) exposait à tout
--                                           membre les disciplines autorisées
--                                           de TOUS les collègues.
--   4. payment_submissions (0025)        — la lecture (SELECT) exposait à tout
--                                           membre (pas seulement owner/admin)
--                                           tout l'historique de facturation de
--                                           l'organisation (montants, téléphone
--                                           Wave, références de paiement).
--   5. storage.objects bucket "documents" (0008) — accès en lecture/suppression
--                                           restait scopé à l'organisation
--                                           entière, jamais resserré après que
--                                           0029 a restreint la table
--                                           `documents` elle-même au
--                                           professeur ayant importé le
--                                           fichier (uploaded_by) — accès
--                                           indirect classique via une relation
--                                           non protégée (Storage vs table).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. assistant_messages : conversations de l'assistant IA.
--    Chaque professeur ne doit voir/écrire que SES PROPRES messages.
--    Owner/admin conservent une supervision en LECTURE SEULE (même principe
--    que 0029 pour les autres tables pédagogiques). Aucune UPDATE/DELETE
--    n'est utilisée par l'application (une conversation n'est jamais
--    modifiée après coup, comportement cohérent avec audit_logs) : on ne
--    recrée donc volontairement aucune policy pour ces deux opérations —
--    RLS activée + absence de policy = refus par défaut pour tout le monde,
--    y compris owner/admin, ce qui est le comportement souhaité pour un
--    historique traçable.
-- ----------------------------------------------------------------------------
drop policy if exists "assistant_messages_org_members" on assistant_messages;

create policy "assistant_messages_select_own_or_supervisor" on assistant_messages for select
  using (user_id = auth.uid() or has_org_role(organization_id, array['owner','admin']::user_role[]));

create policy "assistant_messages_insert_own" on assistant_messages for insert
  with check (user_id = auth.uid() and is_org_member(organization_id));

-- ----------------------------------------------------------------------------
-- 2. student_profiles : fiche permanente d'élève, partagée par conception
--    entre professeurs/années pour permettre le rapprochement lors d'un
--    import "depuis une classe archivée" (voir commentaire de la migration
--    0031 : recherche par organization_id + student_number, PAS par classe
--    ni par professeur). Restreindre la LECTURE à "mes élèves uniquement"
--    casserait cette fonctionnalité de rapprochement inter-années — on
--    conserve donc SELECT et INSERT au niveau organisation, conformément à
--    l'intention documentée de cette table.
--
--    En revanche, AUCUNE fonctionnalité de l'application ne fait jamais
--    d'UPDATE ni de DELETE sur student_profiles (vérifié : seuls des
--    insert/upsert existent dans le code). La policy "for all" d'origine
--    donnait pourtant ce droit à N'IMPORTE QUEL membre de l'organisation —
--    un professeur aurait pu, en appelant directement l'API Supabase (en
--    contournant totalement le frontend), modifier ou supprimer la fiche
--    permanente d'un élève qu'il ne suit même pas. On retire ce droit aux
--    professeurs et on le réserve à owner/admin (seuls rôles ayant une
--    légitimité de gestion sur les données d'établissement).
-- ----------------------------------------------------------------------------
drop policy if exists "student_profiles_all_org_members" on student_profiles;

create policy "student_profiles_select_org" on student_profiles for select
  using (is_org_member(organization_id));

create policy "student_profiles_insert_org" on student_profiles for insert
  with check (is_org_member(organization_id));

create policy "student_profiles_update_admins" on student_profiles for update
  using (has_org_role(organization_id, array['owner','admin']::user_role[]))
  with check (has_org_role(organization_id, array['owner','admin']::user_role[]));

create policy "student_profiles_delete_admins" on student_profiles for delete
  using (has_org_role(organization_id, array['owner','admin']::user_role[]));

-- ----------------------------------------------------------------------------
-- 3. teacher_discipline_grants : quelles disciplines un compte est autorisé
--    à utiliser. La lecture doit rester possible pour SOI-MÊME (nécessaire à
--    getTeacherDisciplineGrants(organizationId, teacherId), appelé avec
--    l'identifiant du professeur connecté depuis la page Évaluations — ne
--    pas restreindre à owner/admin uniquement sous peine de casser cette
--    fonctionnalité), et pour owner/admin (supervision, décision de valider
--    un supplément). Elle ne doit PAS révéler à un professeur les
--    disciplines débloquées de ses collègues.
--    L'INSERT (déjà correctement scopé à teacher_id = auth.uid() et
--    source='free' depuis la migration 0027) n'est pas modifié.
-- ----------------------------------------------------------------------------
drop policy if exists "teacher_discipline_grants_select_org" on teacher_discipline_grants;

create policy "teacher_discipline_grants_select_own_or_supervisor" on teacher_discipline_grants for select
  using (teacher_id = auth.uid() or has_org_role(organization_id, array['owner','admin']::user_role[]));

-- ----------------------------------------------------------------------------
-- 4. payment_submissions : historique des déclarations de paiement Wave
--    (montants dus, référence de transaction, numéro de téléphone Wave
--    utilisé). Aucune fonctionnalité de l'application n'affiche ceci à un
--    professeur simple : etablissement/page.tsx et abonnement/page.tsx ne
--    l'interrogent que derrière un contrôle applicatif `canManage`
--    (owner/admin) — la policy SELECT doit refléter la même restriction
--    côté base, sans quoi un professeur appelant directement l'API Supabase
--    pourrait lire toutes les données de facturation de l'établissement.
--    L'INSERT (déjà correctement réservé à owner/admin depuis la migration
--    0025) n'est pas modifié. Toujours aucune policy UPDATE/DELETE côté
--    client, à dessein (seule la validation serveur avec service_role peut
--    faire passer une soumission à 'confirmed'/'rejected').
-- ----------------------------------------------------------------------------
drop policy if exists "payment_submissions_select_org" on payment_submissions;

create policy "payment_submissions_select_admins" on payment_submissions for select
  using (has_org_role(organization_id, array['owner','admin']::user_role[]));

-- ----------------------------------------------------------------------------
-- 5. Storage bucket "documents" (storage.objects) : la migration 0029 a
--    restreint la table `documents` à uploaded_by = auth.uid() (ou
--    owner/admin), mais les policies Storage définies en 0008 n'ont JAMAIS
--    été mises à jour en conséquence — elles ne vérifiaient que
--    l'appartenance à l'organisation (premier segment du chemin). Résultat :
--    même si un professeur ne voit plus la LIGNE `documents` d'un collègue,
--    il pouvait toujours télécharger ou supprimer directement le FICHIER
--    BRUT dans Storage (liste d'élèves photographiée, feuille de notes...)
--    s'il pouvait construire/deviner le chemin — accès indirect classique
--    via une relation non protégée (cf. Convention "l'isolation ne doit pas
--    reposer sur le frontend seul", §26).
--
--    Nouvelle fonction utilitaire : reconnecte un chemin Storage à la ligne
--    `documents` correspondante pour appliquer la même règle d'appartenance
--    que la table. Écrite avec `exists` (pas une sous-requête scalaire) pour
--    rester correcte même si `storage_path` n'a pas de contrainte UNIQUE
--    déclarée en base (elle ne l'a pas) et qu'un doublon existait : on
--    autorise l'accès si AU MOINS UNE ligne correspondante appartient à
--    l'utilisateur ou à un superviseur — jamais d'erreur SQL, jamais d'accès
--    accordé par défaut. Cas particulier couvert : à l'instant de l'upload,
--    le fichier existe dans Storage avant que la ligne `documents` soit
--    insérée (voir uploadStudentList/uploadOtherDocument) — dans ce cas
--    transitoire, aucune ligne ne correspond encore : on retombe sur la
--    vérification d'organisation, seule possible à ce stade, cohérente avec
--    la policy INSERT (qui reste, elle, nécessairement scopée à
--    l'organisation puisqu'aucune ligne `documents` n'existe encore pour
--    vérifier une propriété plus fine).
-- ----------------------------------------------------------------------------
create or replace function is_document_object_accessible(object_name text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select case
    when exists (select 1 from documents d where d.storage_path = object_name) then
      exists (
        select 1 from documents d
        where d.storage_path = object_name
          and (
            d.uploaded_by = auth.uid()
            or has_org_role(d.organization_id, array['owner','admin']::user_role[])
          )
      )
    else
      -- Aucune ligne `documents` ne correspond encore à ce chemin (fenêtre
      -- d'upload transitoire, ou fichier orphelin) : seule vérification
      -- possible à ce stade, l'appartenance à l'organisation.
      is_org_member((storage.foldername(object_name))[1]::uuid)
  end;
$$;

drop policy if exists "documents_bucket_select_org_members" on storage.objects;
drop policy if exists "documents_bucket_insert_org_members" on storage.objects;
drop policy if exists "documents_bucket_delete_org_members" on storage.objects;

create policy "documents_bucket_select_own_or_supervisor" on storage.objects for select
using (
  bucket_id = 'documents'
  and is_document_object_accessible(name)
);

-- INSERT reste scopé à l'organisation : au moment de l'upload, la ligne
-- `documents` correspondante n'existe pas encore (elle est créée juste
-- après par le code applicatif), donc aucune vérification plus fine que
-- l'appartenance à l'organisation n'est possible à ce stade. C'est
-- exactement le même chemin que 0008, recréé ici à l'identique pour que
-- cette migration reste autonome et complète.
create policy "documents_bucket_insert_org_members" on storage.objects for insert
with check (
  bucket_id = 'documents'
  and is_org_member((storage.foldername(name))[1]::uuid)
);

create policy "documents_bucket_delete_own_or_supervisor" on storage.objects for delete
using (
  bucket_id = 'documents'
  and is_document_object_accessible(name)
);

-- ============================================================================
-- Fin de la correction. Aucune ligne existante n'est modifiée par cette
-- migration (uniquement des policies) : aucune donnée n'est perdue, aucun
-- comportement fonctionnel visible ne change pour un usage légitime.
-- ============================================================================

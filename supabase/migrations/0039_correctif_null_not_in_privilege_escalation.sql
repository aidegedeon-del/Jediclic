-- ============================================================================
-- 0039_correctif_null_not_in_privilege_escalation.sql
--
-- CORRECTIF DE SÉCURITÉ CRITIQUE — contournement du contrôle d'accès pour
-- tout utilisateur NON-MEMBRE de l'organisation cible.
--
-- Trouvé le 2026-09-11 en exécutant réellement supabase/tests/invitations_flow.test.sql
-- (cf. section "Le owner d'une AUTRE organisation ne peut pas créer
-- d'invitation pour ORG INVITATIONS") : le test a révélé qu'un utilisateur
-- authentifié mais NON-MEMBRE de l'organisation ciblée pouvait appeler
-- create_organization_invitation() SANS recevoir l'exception "Permission
-- insuffisante" attendue.
--
-- CAUSE RACINE (les 4 fonctions ci-dessous, migration 0036, utilisent le
-- même pattern défectueux) :
--
--   select role into v_actor_role from organization_members
--   where organization_id = ... and user_id = v_actor_id
--     and accepted_at is not null and suspended_at is null;
--
--   if v_actor_role not in ('owner','admin') then
--     raise exception 'Permission insuffisante';
--   end if;
--
-- Si l'acteur N'EST PAS membre de l'organisation, le SELECT ne trouve
-- aucune ligne : `v_actor_role` reste NULL (jamais assigné, PAS d'erreur).
-- En SQL, `NULL NOT IN ('owner','admin')` s'évalue à NULL (ni TRUE ni
-- FALSE — sémantique NULL de NOT IN dès qu'un opérande est NULL). En
-- PL/pgSQL, `IF NULL THEN ... END IF` NE DÉCLENCHE PAS le bloc (seul TRUE
-- déclenche IF) : l'exception "Permission insuffisante" n'est donc JAMAIS
-- levée pour un non-membre, et l'exécution continue avec les privilèges du
-- SECURITY DEFINER (généralement `postgres`, qui contourne RLS).
--
-- IMPACT RÉEL PAR FONCTION AVANT CE CORRECTIF :
--   - create_organization_invitation : un non-membre pouvait créer une
--     invitation pour N'IMPORTE QUELLE organisation (sous réserve d'un
--     abonnement actif existant pour cette organisation), potentiellement
--     avec le rôle 'admin' (le seul rôle bloqué explicitement est 'owner').
--   - update_organization_invitation : un non-membre pouvait modifier le
--     rôle/la classe de N'IMPORTE QUELLE invitation pending existante.
--   - revoke_organization_invitation : un non-membre pouvait révoquer
--     N'IMPORTE QUELLE invitation pending (déni de service ciblé).
--   - remove_organization_member : un non-membre pouvait supprimer
--     N'IMPORTE QUELLE ligne organization_members (hors owner, protégé par
--     un garde séparé), de N'IMPORTE QUELLE organisation.
--
-- CORRECTIF : remplacer `v_actor_role not in (...)` par une forme qui gère
-- explicitement le cas NULL — soit `v_actor_role is null or v_actor_role
-- not in (...)`, soit l'opérateur `is distinct from` combiné à `= any(...)`.
-- On utilise ici la forme la plus explicite et la plus lisible :
-- `v_actor_role is null or v_actor_role not in ('owner','admin')`.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. remove_organization_member
-- ---------------------------------------------------------------------------
create or replace function remove_organization_member(p_member_id uuid)
returns organization_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_target organization_members;
  v_actor_role user_role;
begin
  if v_actor_id is null then
    raise exception 'Utilisateur non authentifié';
  end if;

  select * into v_target
  from organization_members
  where id = p_member_id
  for update;

  if not found then
    raise exception 'Membre introuvable';
  end if;

  if v_target.user_id = v_actor_id then
    raise exception 'Impossible de se retirer soi-même';
  end if;

  if v_target.role = 'owner' then
    raise exception 'Le propriétaire ne peut pas être retiré';
  end if;

  select role into v_actor_role
  from organization_members
  where organization_id = v_target.organization_id
    and user_id = v_actor_id
    and accepted_at is not null
    and suspended_at is null;

  -- CORRECTIF : v_actor_role NULL (non-membre) doit être rejeté explicitement.
  if v_actor_role is null or v_actor_role not in ('owner','admin') then
    raise exception 'Permission insuffisante';
  end if;

  -- Un admin ne peut pas retirer un autre admin.
  if v_actor_role = 'admin' and v_target.role = 'admin' then
    raise exception 'Un administrateur ne peut pas retirer un autre administrateur';
  end if;

  delete from organization_members where id = p_member_id;
  return v_target;
end;
$$;

revoke all on function remove_organization_member(uuid) from public;
grant execute on function remove_organization_member(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. create_organization_invitation
-- ---------------------------------------------------------------------------
create or replace function create_organization_invitation(
  p_organization_id uuid,
  p_email citext,
  p_role user_role,
  p_class_id uuid default null
)
returns invitations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_role user_role;
  v_org_kind account_kind;
  v_invitation invitations;
  v_subscription subscriptions;
  v_seats_limit int;
  v_seats_used int;
  v_needs_seat_payment boolean;
begin
  if v_actor_id is null then
    raise exception 'Utilisateur non authentifié';
  end if;

  select role into v_actor_role
  from organization_members
  where organization_id = p_organization_id
    and user_id = v_actor_id
    and accepted_at is not null
    and suspended_at is null;

  -- CORRECTIF : v_actor_role NULL (non-membre) doit être rejeté explicitement.
  if v_actor_role is null or v_actor_role not in ('owner','admin') then
    raise exception 'Permission insuffisante';
  end if;

  select kind into v_org_kind
  from organizations
  where id = p_organization_id;
  if v_org_kind is distinct from 'establishment' then
    raise exception 'Les invitations sont réservées aux établissements';
  end if;

  if p_role = 'owner' then
    raise exception 'Le rôle owner ne peut pas être invité';
  end if;
  if v_actor_role = 'admin' and p_role = 'admin' then
    raise exception 'Un administrateur ne peut pas inviter un autre administrateur';
  end if;

  select * into v_subscription
  from subscriptions s
  where s.organization_id = p_organization_id
    and s.status in ('active','past_due')
  order by s.created_at desc
  limit 1;

  if not found then
    raise exception 'Aucun abonnement actif pour cet établissement';
  end if;

  select seats into v_seats_limit
  from plans
  where id = v_subscription.plan_id;

  select
    (select count(*) from organization_members m where m.organization_id = p_organization_id and m.accepted_at is not null)
    +
    (select count(*) from invitations i where i.organization_id = p_organization_id and i.status = 'pending')
  into v_seats_used;

  if v_seats_limit is not null and v_seats_used >= v_seats_limit then
    raise exception 'Quota de licences atteint';
  end if;

  if exists (
    select 1 from invitations i
    where i.organization_id = p_organization_id
      and i.email = lower(p_email::text)::citext
      and i.status = 'pending'
  ) then
    raise exception 'Une invitation est déjà en attente pour cette adresse';
  end if;

  if p_class_id is not null and not exists (
    select 1 from classes c
    where c.id = p_class_id
      and c.organization_id = p_organization_id
      and c.teacher_id is null
  ) then
    raise exception 'Classe invalide pour cette invitation';
  end if;

  v_needs_seat_payment := v_subscription.status = 'active';

  insert into invitations (organization_id, email, role, invited_by, needs_seat_payment, class_id)
  values (p_organization_id, lower(p_email::text)::citext, p_role, v_actor_id, v_needs_seat_payment, p_class_id)
  returning * into v_invitation;

  return v_invitation;
end;
$$;

revoke all on function create_organization_invitation(uuid, citext, user_role, uuid) from public;
grant execute on function create_organization_invitation(uuid, citext, user_role, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. update_organization_invitation
-- ---------------------------------------------------------------------------
create or replace function update_organization_invitation(
  p_invitation_id uuid,
  p_role user_role,
  p_class_id uuid
)
returns invitations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_invitation invitations;
  v_actor_role user_role;
begin
  if v_actor_id is null then
    raise exception 'Utilisateur non authentifié';
  end if;

  select * into v_invitation
  from invitations
  where id = p_invitation_id
  for update;

  if not found then
    raise exception 'Invitation introuvable';
  end if;

  select role into v_actor_role
  from organization_members
  where organization_id = v_invitation.organization_id
    and user_id = v_actor_id
    and accepted_at is not null
    and suspended_at is null;

  -- CORRECTIF : v_actor_role NULL (non-membre) doit être rejeté explicitement.
  if v_actor_role is null or v_actor_role not in ('owner','admin') then
    raise exception 'Permission insuffisante';
  end if;

  if p_role = 'owner' then
    raise exception 'Le rôle owner ne peut pas être invité';
  end if;

  if v_actor_role = 'admin' and p_role = 'admin' then
    raise exception 'Un administrateur ne peut pas inviter un autre administrateur';
  end if;

  if v_invitation.status <> 'pending' then
    raise exception 'Seules les invitations en attente peuvent être modifiées';
  end if;

  if p_class_id is not null and not exists (
    select 1 from classes c
    where c.id = p_class_id
      and c.organization_id = v_invitation.organization_id
      and c.teacher_id is null
  ) then
    raise exception 'Classe invalide pour cette invitation';
  end if;

  update invitations
  set role = p_role,
      class_id = p_class_id
  where id = p_invitation_id
  returning * into v_invitation;

  return v_invitation;
end;
$$;

revoke all on function update_organization_invitation(uuid, user_role, uuid) from public;
grant execute on function update_organization_invitation(uuid, user_role, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. revoke_organization_invitation
-- ---------------------------------------------------------------------------
create or replace function revoke_organization_invitation(p_invitation_id uuid)
returns invitations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_invitation invitations;
  v_actor_role user_role;
begin
  if v_actor_id is null then
    raise exception 'Utilisateur non authentifié';
  end if;

  select * into v_invitation
  from invitations
  where id = p_invitation_id
  for update;

  if not found then
    raise exception 'Invitation introuvable';
  end if;

  select role into v_actor_role
  from organization_members
  where organization_id = v_invitation.organization_id
    and user_id = v_actor_id
    and accepted_at is not null
    and suspended_at is null;

  -- CORRECTIF : v_actor_role NULL (non-membre) doit être rejeté explicitement.
  if v_actor_role is null or v_actor_role not in ('owner','admin') then
    raise exception 'Permission insuffisante';
  end if;

  update invitations
  set status = 'revoked'
  where id = p_invitation_id
    and status = 'pending'
  returning * into v_invitation;

  return v_invitation;
end;
$$;

revoke all on function revoke_organization_invitation(uuid) from public;
grant execute on function revoke_organization_invitation(uuid) to authenticated;

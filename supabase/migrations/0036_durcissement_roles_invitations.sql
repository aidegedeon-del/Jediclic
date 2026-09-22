-- ============================================================================
-- 0036_durcissement_roles_invitations.sql
-- Durcissement de sécurité :
--   * aucun UPDATE client direct de organization_members
--   * changements de rôle via RPC sécurisée et hiérarchisée
--   * suppression de membre via RPC sécurisée
--   * aucun UPDATE client direct d'invitations par l'invité
--   * acceptation/refus d'invitation via RPC atomiques
--   * verrouillage des champs immuables (organization_id, email, role, etc.)
--   * protections explicites contre l'escalade de privilèges
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. organization_members : supprimer toute capacité UPDATE directe côté RLS.
-- ---------------------------------------------------------------------------
drop policy if exists "members_write_admins" on organization_members;
drop policy if exists "members_update_admins" on organization_members;
drop policy if exists "members_delete_admins" on organization_members;
-- Aucun DELETE client direct : la suppression passe par la fonction
-- remove_organization_member(), qui applique les mêmes contrôles métier et
-- empêche notamment la suppression de l'owner ou d'un autre admin par un admin.

-- Aucun UPDATE client : les rôles et champs sensibles ne sont mutables que
-- via les fonctions SECURITY DEFINER ci-dessous.

-- Supprimer aussi l'INSERT direct via invitation : le flux d'acceptation
-- doit passer uniquement par la fonction atomique ci-dessous.
drop policy if exists "members_insert_via_invitation" on organization_members;

-- ---------------------------------------------------------------------------
-- 2. Fonction de modification de rôle : hiérarchie stricte.
-- ---------------------------------------------------------------------------
create or replace function set_organization_member_role(
  p_member_id uuid,
  p_new_role user_role
)
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

  select role into v_actor_role
  from organization_members
  where organization_id = v_target.organization_id
    and user_id = v_actor_id
    and accepted_at is not null
    and suspended_at is null;

  if v_actor_role is null then
    raise exception 'Accès refusé';
  end if;

  -- Un owner peut gérer les rôles sauf se transformer en autre chose via
  -- cette fonction ; l'owner reste unique au niveau logique de l'application.
  if v_actor_role = 'admin' then
    -- Un admin peut gérer teacher/manager/reader, mais jamais créer/modifier
    -- un owner ni promouvoir qui que ce soit en admin.
    if v_target.role = 'owner' or p_new_role in ('owner','admin') then
      raise exception 'Un administrateur ne peut pas gérer le rôle owner/admin';
    end if;
  elsif v_actor_role = 'owner' then
    if p_new_role = 'owner' and v_target.user_id <> v_actor_id then
      raise exception 'Le rôle owner ne peut pas être attribué par cette opération';
    end if;
  else
    raise exception 'Permission insuffisante';
  end if;

  -- Impossible de modifier le rôle de l'owner existant.
  if v_target.role = 'owner' and v_target.user_id <> v_actor_id then
    raise exception 'Le rôle owner est protégé';
  end if;

  update organization_members
  set role = p_new_role
  where id = p_member_id
  returning * into v_target;

  return v_target;
end;
$$;

revoke all on function set_organization_member_role(uuid, user_role) from public;
grant execute on function set_organization_member_role(uuid, user_role) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Suppression sécurisée d'un membre.
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

  if v_actor_role not in ('owner','admin') then
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
-- 4. Invitations : aucune modification directe par l'invité.
-- ---------------------------------------------------------------------------
drop policy if exists "invitations_update_admins" on invitations;
drop policy if exists "invitations_accept_own" on invitations;

-- Les modifications d'administration passent désormais uniquement par RPC.

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

  if v_actor_role not in ('owner','admin') then
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

  if v_actor_role not in ('owner','admin') then
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

  if v_actor_role not in ('owner','admin') then
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

-- ---------------------------------------------------------------------------
-- 5. Acceptation atomique d'une invitation.
--    Les valeurs de rôle/organisation viennent exclusivement de la ligne
--    d'invitation verrouillée ; l'appelant ne peut pas les fournir.
-- ---------------------------------------------------------------------------
create or replace function accept_organization_invitation(p_invitation_id uuid)
returns organization_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_email citext;
  v_invitation invitations;
  v_member organization_members;
  v_seat_status text := 'paid';
begin
  if v_user_id is null then
    raise exception 'Utilisateur non authentifié';
  end if;

  select email into v_email from auth.users where id = v_user_id;
  if v_email is null then
    raise exception 'Compte utilisateur introuvable';
  end if;

  select * into v_invitation
  from invitations
  where id = p_invitation_id
  for update;

  if not found then
    raise exception 'Invitation introuvable';
  end if;

  if v_invitation.status <> 'pending' then
    raise exception 'Cette invitation n''est plus valide';
  end if;

  if lower(v_invitation.email::text) <> lower(v_email::text) then
    raise exception 'Cette invitation ne correspond pas au compte connecté';
  end if;

  select * into v_member
  from organization_members
  where organization_id = v_invitation.organization_id
    and user_id = v_user_id
  limit 1;

  if found then
    update invitations
    set status = 'accepted', accepted_at = coalesce(accepted_at, now())
    where id = v_invitation.id;
    return v_member;
  end if;

  if v_invitation.needs_seat_payment then
    if v_invitation.seat_payment_submission_id is null then
      v_seat_status := 'pending';
    else
      select case when status = 'confirmed' then 'paid' else 'pending' end
      into v_seat_status
      from payment_submissions
      where id = v_invitation.seat_payment_submission_id;
      v_seat_status := coalesce(v_seat_status, 'pending');
    end if;
  end if;

  insert into organization_members (
    organization_id,
    user_id,
    role,
    accepted_at,
    invitation_id,
    seat_payment_status
  ) values (
    v_invitation.organization_id,
    v_user_id,
    v_invitation.role,
    now(),
    v_invitation.id,
    v_seat_status
  )
  returning * into v_member;

  if v_invitation.class_id is not null then
    update classes
    set teacher_id = v_user_id
    where id = v_invitation.class_id
      and organization_id = v_invitation.organization_id
      and teacher_id is null;

    if not found then
      raise exception 'La classe ciblée n''est plus disponible';
    end if;
  end if;

  update invitations
  set status = 'accepted', accepted_at = now()
  where id = v_invitation.id;

  return v_member;
end;
$$;

revoke all on function accept_organization_invitation(uuid) from public;
grant execute on function accept_organization_invitation(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Refus d'une invitation : transition unique pending -> revoked.
-- ---------------------------------------------------------------------------
create or replace function decline_organization_invitation(p_invitation_id uuid)
returns invitations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_email citext;
  v_invitation invitations;
begin
  if v_user_id is null then
    raise exception 'Utilisateur non authentifié';
  end if;

  select email into v_email from auth.users where id = v_user_id;

  select * into v_invitation
  from invitations
  where id = p_invitation_id
  for update;

  if not found or lower(v_invitation.email::text) <> lower(v_email::text) then
    raise exception 'Invitation introuvable ou non destinée à ce compte';
  end if;

  if v_invitation.status <> 'pending' then
    return v_invitation;
  end if;

  update invitations
  set status = 'revoked'
  where id = p_invitation_id
  returning * into v_invitation;

  return v_invitation;
end;
$$;

revoke all on function decline_organization_invitation(uuid) from public;
grant execute on function decline_organization_invitation(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Invitations : aucun INSERT/UPDATE/DELETE direct depuis le client.
--    Création, modification, révocation, acceptation et refus passent par des
--    fonctions SECURITY DEFINER strictement contrôlées.
-- ---------------------------------------------------------------------------
drop policy if exists "invitations_insert_admins" on invitations;

-- ---------------------------------------------------------------------------
-- 8. Subscriptions : aucun écrit client. Les changements d'état de paiement
--    sont réservés aux flux serveur/plateforme utilisant service_role.
-- ---------------------------------------------------------------------------
drop policy if exists "subscriptions_write_admins" on subscriptions;

-- ---------------------------------------------------------------------------
-- 9. Ajouter les index utiles.
-- ---------------------------------------------------------------------------
create index if not exists idx_org_members_org_user
  on organization_members (organization_id, user_id);

create index if not exists idx_invitations_org_status
  on invitations (organization_id, status);

-- ---------------------------------------------------------------------------
-- 9. Tests de sécurité à exécuter avec Supabase CLI.
-- ---------------------------------------------------------------------------

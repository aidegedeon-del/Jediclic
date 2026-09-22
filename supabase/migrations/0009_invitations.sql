-- ============================================================================
-- 0009_invitations.sql
-- EF-ETAB-01 : espace établissement, invitation d'enseignants.
-- Convention §25/§27 : isolation stricte par organisation, RLS obligatoire.
-- ============================================================================

-- Une invitation cible un e-mail (pas encore forcément un compte existant).
-- Convention §22/§56 : rien n'est intégré automatiquement — l'invité doit
-- explicitement accepter (voir policy d'insertion sur organization_members
-- plus bas) avant de devenir membre effectif.
create table invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  email citext not null,
  role user_role not null default 'teacher',
  invited_by uuid not null references auth.users(id),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

-- Une seule invitation "pending" active à la fois pour un même e-mail dans
-- une même organisation (on peut réinviter après revocation/acceptation).
create unique index invitations_org_email_pending_uniq on invitations(organization_id, email) where status = 'pending';
create index idx_invitations_email on invitations(email) where status = 'pending';

alter table invitations enable row level security;

create policy "invitations_select_admins" on invitations for select
  using (has_org_role(organization_id, array['owner','admin']::user_role[]));

-- L'invité doit pouvoir voir ses propres invitations pour les accepter,
-- avant même d'être membre de l'organisation concernée.
create policy "invitations_select_own_email" on invitations for select
  using (email = (auth.jwt() ->> 'email')::citext);

create policy "invitations_insert_admins" on invitations for insert
  with check (has_org_role(organization_id, array['owner','admin']::user_role[]));

create policy "invitations_update_admins" on invitations for update
  using (has_org_role(organization_id, array['owner','admin']::user_role[]))
  with check (has_org_role(organization_id, array['owner','admin']::user_role[]));

-- L'invité peut faire passer SA PROPRE invitation de pending -> accepted
-- (jamais vers un autre statut, jamais l'invitation de quelqu'un d'autre).
create policy "invitations_accept_own" on invitations for update
  using (email = (auth.jwt() ->> 'email')::citext and status = 'pending')
  with check (email = (auth.jwt() ->> 'email')::citext and status = 'accepted');

-- ----------------------------------------------------------------------------
-- Correction : la policy "members_write_admins" (migration 0006) exige déjà
-- d'être owner/admin de l'organisation, ce qui rend impossible la toute
-- première insertion (le créateur de l'organisation n'est encore membre de
-- rien). Trouvé en construisant ce module — corrigé ici plutôt qu'ignoré,
-- car il bloquait l'onboarding standard (professeur individuel ou
-- établissement) avant même d'arriver à l'espace établissement.
-- ----------------------------------------------------------------------------
create policy "members_insert_first_owner" on organization_members for insert
  with check (
    user_id = auth.uid()
    and role = 'owner'
    and not exists (
      select 1 from organization_members m2 where m2.organization_id = organization_members.organization_id
    )
  );

-- Un invité peut créer SA PROPRE ligne de membre, uniquement si une
-- invitation "pending" correspondant à son e-mail existe pour cette
-- organisation, et avec le rôle exact prévu par l'invitation (pas de rôle
-- choisi librement).
create policy "members_insert_via_invitation" on organization_members for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from invitations i
      where i.organization_id = organization_members.organization_id
        and i.email = (auth.jwt() ->> 'email')::citext
        and i.status = 'pending'
        and i.role = organization_members.role
    )
  );

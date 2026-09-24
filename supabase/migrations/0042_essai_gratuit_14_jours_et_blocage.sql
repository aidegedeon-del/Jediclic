-- ============================================================================
-- 0042_essai_gratuit_14_jours_et_blocage.sql
-- Décision explicite de l'utilisateur (22 sept. 2026) : renverse la décision
-- antérieure "aucun essai gratuit" (cf. commentaires migration 0024). Toute
-- nouvelle organisation (individuelle ou établissement) démarre avec un
-- abonnement 'trialing' de 14 jours, période durant laquelle l'accès est
-- complet (mêmes droits qu'un abonnement actif). Passé ce délai sans
-- paiement confirmé, l'accès est totalement bloqué (même mécanisme que
-- pour un abonnement 'expired' — cf. src/lib/subscriptions/access.ts).
-- ============================================================================

create or replace function create_trial_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan_id uuid;
  v_plan_code text;
begin
  v_plan_code := case when new.kind = 'individual_teacher' then 'individual_monthly' else 'establishment_per_teacher' end;

  select id into v_plan_id
  from plans
  where code = v_plan_code and is_active = true
  limit 1;

  if v_plan_id is null then
    return new;
  end if;

  insert into subscriptions (organization_id, plan_id, status, provider, current_period_start, current_period_end)
  values (new.id, v_plan_id, 'trialing', 'trial', now(), now() + interval '14 days');

  return new;
end;
$$;

drop trigger if exists trg_create_trial_subscription on organizations;
create trigger trg_create_trial_subscription
after insert on organizations
for each row execute function create_trial_subscription();

create or replace function public.expire_overdue_subscriptions()
returns void
language plpgsql
set search_path = public
as $function$
begin
  update subscriptions
  set status = 'expired'
  where status in ('active', 'trialing')
    and current_period_end is not null
    and current_period_end < now();
end;
$function$;

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
    and s.status in ('active','past_due','trialing')
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

insert into subscriptions (organization_id, plan_id, status, provider, current_period_start, current_period_end)
select o.id,
  (select id from plans where code = case when o.kind = 'individual_teacher' then 'individual_monthly' else 'establishment_per_teacher' end and is_active = true limit 1),
  'trialing', 'trial', now(), now() + interval '14 days'
from organizations o
where not exists (select 1 from subscriptions s where s.organization_id = o.id)
  and (select id from plans where code = case when o.kind = 'individual_teacher' then 'individual_monthly' else 'establishment_per_teacher' end and is_active = true limit 1) is not null;

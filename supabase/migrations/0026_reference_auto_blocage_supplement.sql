-- ============================================================================
-- 0026_reference_auto_blocage_supplement.sql
-- À la demande explicite de l'utilisateur, trois changements sur EF-PAIEMENT-01 :
--   1. La référence de paiement n'est plus saisie par la personne inscrite :
--      l'application la génère elle-même (`app_reference`). `payer_reference`
--      (saisie manuelle, migration 0025) devient optionnelle et n'est plus
--      utilisée par le nouveau flux — jamais supprimée (§15/§48), pour ne pas
--      perdre les références déjà saisies avant ce lot.
--   2. Un établissement (ou un professeur individuel) dont la période payée
--      est dépassée doit voir son accès coupé — jusqu'ici `current_period_end`
--      existait mais rien ne s'en servait pour bloquer quoi que ce soit. Ajout
--      d'une coupure manuelle possible depuis la page plateforme, distincte de
--      l'expiration naturelle (traçabilité de qui a coupé et pourquoi).
--   3. Un enseignant ajouté par un établissement en cours de mois doit payer un
--      supplément immédiat (palier 2 tranches : plein tarif si ajouté dans la
--      1ère quinzaine, demi-tarif dans la 2ème) avant que son accès ne soit
--      pleinement actif — `payment_submissions` distingue donc désormais un
--      paiement d'abonnement normal d'un supplément lié à un enseignant précis.
-- Comme pour 0023/0024/0025 : on n'édite jamais une migration déjà livrée.
-- ============================================================================

-- --- 1. Référence générée par l'application --------------------------------

create sequence if not exists payment_submissions_reference_seq start 1;

create or replace function generate_payment_reference()
returns text
language plpgsql
as $$
begin
  return 'PAY-' || to_char(now(), 'YYYYMM') || '-' || lpad(nextval('payment_submissions_reference_seq')::text, 5, '0');
end;
$$;

alter table payment_submissions add column if not exists app_reference text;
update payment_submissions set app_reference = generate_payment_reference() where app_reference is null;
alter table payment_submissions alter column app_reference set default generate_payment_reference();
alter table payment_submissions alter column app_reference set not null;
alter table payment_submissions add constraint payment_submissions_app_reference_uniq unique (app_reference);

-- `payer_reference` (saisie manuelle) n'est plus alimentée par le nouveau
-- flux de soumission ("J'ai payé", sans champ de saisie) : elle devient
-- optionnelle plutôt que supprimée, pour préserver les lignes déjà créées
-- avant ce lot.
alter table payment_submissions alter column payer_reference drop not null;

comment on column payment_submissions.app_reference is
  'Référence générée par l''application (jamais saisie par la personne inscrite), affichée à la fois côté organisation et côté validation plateforme pour rapprochement avec la transaction Wave réelle.';
comment on column payment_submissions.payer_reference is
  'Ancien champ de saisie manuelle (migration 0025), conservé pour l''historique mais plus alimenté par le flux courant — remplacé par app_reference.';

-- --- 2. Blocage d'accès (expiration naturelle + coupure manuelle) ----------

alter table subscriptions add column if not exists access_blocked_at timestamptz;
alter table subscriptions add column if not exists access_blocked_by uuid references auth.users(id);
alter table subscriptions add column if not exists access_blocked_reason text;

comment on column subscriptions.access_blocked_at is
  'Coupure manuelle déclenchée depuis la page plateforme (/plateforme/paiements), distincte d''une expiration naturelle de current_period_end. Null = pas de coupure manuelle en cours.';

-- Expiration naturelle : fait passer un abonnement `active` dont la période
-- payée est dépassée à `expired`. Prévu pour être appelé par un job planifié
-- quotidien (pg_cron si disponible sur le projet, sinon une route serveur
-- déclenchée par un cron externe) — n'active/désactive rien d'autre, la
-- vérification d'accès elle-même vit côté application
-- (src/lib/subscriptions/access.ts), jamais uniquement en base (§26).
create or replace function expire_overdue_subscriptions()
returns void
language plpgsql
as $$
begin
  update subscriptions
  set status = 'expired'
  where status = 'active'
    and current_period_end is not null
    and current_period_end < now();
end;
$$;

-- --- 3. Supplément pour un enseignant ajouté en cours de mois --------------

alter table payment_submissions add column if not exists submission_kind text not null default 'subscription'
  check (submission_kind in ('subscription', 'seat_addition'));
alter table payment_submissions add column if not exists added_invitation_id uuid references invitations(id);
alter table payment_submissions add column if not exists pricing_tier text
  check (pricing_tier in ('full', 'half'));

comment on column payment_submissions.submission_kind is
  '''subscription'' = paiement/renouvellement normal (impacte subscriptions.current_period_end). ''seat_addition'' = supplément immédiat pour un enseignant invité en cours de mois (impacte uniquement organization_members.seat_payment_status de l''invitation concernée, jamais la période de l''abonnement).';
comment on column payment_submissions.pricing_tier is
  'Palier appliqué à un supplément seat_addition selon la quinzaine d''ajout : full = tarif plein (1ère quinzaine), half = demi-tarif (2ème quinzaine). Null pour un paiement submission_kind=subscription.';

-- Traçabilité de quelle invitation a déclenché un supplément, et si ce
-- supplément a déjà été payé — nécessaire pour bloquer l'accès de CE seul
-- enseignant (jamais tout l'établissement) tant que ce n'est pas confirmé.
alter table invitations add column if not exists needs_seat_payment boolean not null default false;
alter table invitations add column if not exists seat_payment_submission_id uuid references payment_submissions(id);

comment on column invitations.needs_seat_payment is
  'Vrai si cette invitation a été créée alors que l''abonnement établissement était déjà actif pour la période en cours (donc pas couverte par le dernier paiement) — un supplément payment_submissions (seat_addition) est alors requis avant accès complet.';

-- Un membre créé via une invitation qui nécessitait un supplément reste
-- `pending` (accès bloqué, lui seul) tant que le supplément n'est pas
-- confirmé ; `paid` sinon (cas normal, aucun supplément dû).
alter table organization_members add column if not exists seat_payment_status text not null default 'paid'
  check (seat_payment_status in ('paid', 'pending'));
alter table organization_members add column if not exists invitation_id uuid references invitations(id);

comment on column organization_members.seat_payment_status is
  '''pending'' bloque l''accès de CE membre uniquement (pas le reste de l''établissement) tant que le supplément seat_addition lié à son invitation n''est pas confirmé par la plateforme.';

create index if not exists idx_payment_submissions_kind on payment_submissions(submission_kind, status);
create index if not exists idx_organization_members_seat_payment on organization_members(seat_payment_status) where seat_payment_status = 'pending';

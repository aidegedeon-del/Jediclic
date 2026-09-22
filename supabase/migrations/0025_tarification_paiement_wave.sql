-- ============================================================================
-- 0025_tarification_paiement_wave.sql
-- Mise à jour tarifaire (§32) + collecte de paiement Wave à validation
-- manuelle, à la demande explicite de l'utilisateur :
--   - Professeur individuel : 2 500 FCFA / mois, 17 000 FCFA / an
--   - Établissement (par enseignant) : 1 500 FCFA / mois, 10 000 FCFA / an
--   - Le paiement se fait sur Wave (hors application) ; la personne inscrite
--     saisit la référence de la transaction, et l'abonnement est activé
--     après vérification. Convention §6 : jamais 'active' sans encaissement
--     réel — l'abonnement ne passe donc à 'active' qu'au moment de la
--     confirmation, jamais à la simple soumission.
--   - Qui effectue la vérification n'est jamais exposé côté professeur/
--     établissement : la page de validation (EF-PAIEMENT-01, hors dashboard
--     normal, réservée à la plateforme) et le vocabulaire côté utilisateur
--     restent volontairement génériques ("vérification en cours").
-- Comme pour 0023/0024 : on n'édite jamais une migration déjà livrée, on met
-- à jour les lignes existantes et on archive plutôt que supprimer (§15/§48).
-- ============================================================================

-- --- Tarifs à jour --------------------------------------------------------
update plans set price_minor_units = 2500 where code = 'individual_monthly';
update plans set price_minor_units = 17000 where code = 'individual_yearly';
update plans set price_minor_units = 1500 where code = 'establishment_per_teacher';

-- Nouvelle offre annuelle établissement (par enseignant), absente jusqu'ici.
insert into plans (code, name, seats, price_minor_units, currency, billing_period, audience, is_per_seat, is_active)
values (
  'establishment_per_teacher_yearly',
  'Établissement — par enseignant (annuel)',
  null,
  10000,
  'XOF',
  'yearly',
  'establishment',
  true,
  true
)
on conflict (code) do update set
  price_minor_units = excluded.price_minor_units,
  billing_period = excluded.billing_period,
  audience = excluded.audience,
  is_per_seat = excluded.is_per_seat,
  is_active = excluded.is_active;

-- --- Paiement Wave à validation manuelle -----------------------------------
-- Une ligne par tentative de paiement déclarée par l'organisation. Ne
-- remplace pas `subscriptions` : c'est un journal des déclarations de
-- paiement, distinct de l'état d'abonnement lui-même (même séparation que
-- documents/extracted_data vs students — §15/§56, jamais fusionner une
-- donnée brute déclarée avec la donnée validée qui en résulte).
create table payment_submissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  plan_id uuid not null references plans(id),
  billing_period text not null,                 -- copié du plan au moment de la soumission (traçabilité si le plan change ensuite)
  seats_snapshot int,                            -- pour un plan par siège : nombre de sièges utilisés/réservés au moment de la soumission
  amount_due_minor_units bigint not null,        -- montant annoncé au professeur/établissement, jamais recalculé après coup
  currency text not null default 'XOF',
  payment_method text not null default 'wave',
  payer_reference text not null,                 -- référence de transaction Wave saisie par l'utilisateur
  payer_phone text,                              -- numéro Wave utilisé pour payer (optionnel, aide à la vérification)
  status text not null default 'pending_review'
    check (status in ('pending_review', 'confirmed', 'rejected')),
  submitted_by uuid not null references auth.users(id),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_note text,                              -- note interne, jamais affichée telle quelle côté organisation
  subscription_id uuid references subscriptions(id),
  created_at timestamptz not null default now()
);

create index idx_payment_submissions_org on payment_submissions(organization_id, created_at desc);
create index idx_payment_submissions_status on payment_submissions(status, created_at);

alter table payment_submissions enable row level security;

-- L'organisation (owner/admin) peut voir et créer ses propres déclarations
-- de paiement, jamais celles d'une autre organisation.
create policy "payment_submissions_select_org" on payment_submissions for select
  using (is_org_member(organization_id));
create policy "payment_submissions_insert_admins" on payment_submissions for insert
  with check (has_org_role(organization_id, array['owner','admin']::user_role[]) and submitted_by = auth.uid());

-- Aucune policy UPDATE/DELETE côté client authentifié, à dessein : seule la
-- validation serveur (service_role, cf. src/lib/payments/wave.ts) peut faire
-- passer une soumission à 'confirmed'/'rejected' — même principe que
-- `audit_logs` (migration 0006), pour qu'une organisation ne puisse jamais
-- s'auto-valider un paiement.

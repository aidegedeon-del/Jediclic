-- ============================================================================
-- 0024_licences_par_enseignant.sql
-- Changement de modèle économique (§33), à la demande explicite de
-- l'utilisateur : un établissement n'a plus de plafond de sièges — il paie
-- 1500 FCFA par enseignant réellement inscrit (accepté ou invité en attente),
-- chaque mois. Et : plus aucune offre (individuelle ou établissement) ne
-- comporte d'essai gratuit — la valeur 'trialing' de `subscription_status`
-- n'est donc plus utilisée nulle part dans l'application à partir de ce lot.
--
-- Comme pour la bascule HG Terminale (migration 0023) : on n'édite jamais une
-- migration déjà livrée (0005) — les anciens plans à sièges plafonnés
-- (`establishment_25`, `establishment_50`) sont désactivés (`is_active =
-- false`), jamais supprimés (§15/§48), et remplacés par une nouvelle ligne.
-- ============================================================================

-- `plans` n'avait ni indicateur d'archivage, ni moyen explicite de
-- distinguer une offre individuelle d'une offre établissement autrement
-- qu'en devinant sur `seats is null` — fragile maintenant que le nouveau
-- plan établissement a *aussi* `seats = null` (aucun plafond). Modélisation
-- explicite plutôt qu'une inférence implicite (même principe que partout
-- ailleurs dans le référentiel : jamais deviner ce qui peut être déclaré).
alter table plans add column if not exists is_active boolean not null default true;
alter table plans add column if not exists audience text not null default 'individual'
  check (audience in ('individual', 'establishment'));
alter table plans add column if not exists is_per_seat boolean not null default false;

comment on column plans.price_minor_units is
  'Si is_per_seat = false : prix forfaitaire par période. '
  'Si is_per_seat = true : prix PAR ENSEIGNANT inscrit, par période — '
  'le montant réellement dû est ce prix multiplié par le nombre de sièges '
  'utilisés, toujours recalculé à la volée (src/lib/subscriptions/quota.ts), '
  'jamais stocké.';

update plans set audience = 'establishment' where code in ('establishment_25', 'establishment_50');
update plans set is_active = false where code in ('establishment_25', 'establishment_50');
-- Les plans individuels existants restent actifs, inchangés dans leur
-- tarification (forfait, jamais par siège — un professeur individuel n'a
-- qu'un seul siège, lui-même).

insert into plans (code, name, seats, price_minor_units, currency, billing_period, audience, is_per_seat, is_active)
values (
  'establishment_per_teacher',
  'Établissement — par enseignant',
  null,               -- aucun plafond : un établissement peut inviter autant d'enseignants qu'il le souhaite
  1500,               -- 1500 FCFA par enseignant, par mois (voir is_per_seat ci-dessus)
  'XOF',
  'monthly',
  'establishment',
  true,
  true
)
on conflict (code) do update set
  seats = excluded.seats,
  price_minor_units = excluded.price_minor_units,
  audience = excluded.audience,
  is_per_seat = excluded.is_per_seat,
  is_active = excluded.is_active;

-- Plus d'essai gratuit sur aucune offre : une toute nouvelle organisation
-- n'a par défaut aucune ligne `subscriptions` (comme avant), mais si une
-- ligne est un jour créée sans statut explicite, le défaut ne doit plus
-- suggérer un essai. 'past_due' reflète honnêtement l'état réel tant
-- qu'aucun paiement n'a été prélevé (EF-PAIEMENT-01 non livré) : un
-- engagement a été pris, le paiement est dû, mais rien n'a encore été
-- encaissé — jamais 'active' sans encaissement réel (Convention §6).
alter table subscriptions alter column status set default 'past_due';

-- ============================================================================
-- 0030_supplement_discipline_tarif_compte.sql
-- Documentation uniquement (§15/§48 : jamais d'édition d'une migration déjà
-- livrée) : le supplément "discipline_addition" (EF-DISCIPLINES-01, 0027) ne
-- reprend plus un montant fixe de 1500 FCFA par défaut. À la demande
-- explicite de l'utilisateur, le montant est désormais celui du plan que
-- l'organisation paie déjà (individual_monthly/individual_yearly si compte
-- individuel, establishment_per_teacher/establishment_per_teacher_yearly si
-- établissement), à la même périodicité que son abonnement en cours — comme
-- si l'enseignant ouvrait un nouveau compte. Voir src/lib/payments/wave.ts
-- (submitDisciplineAdditionPayment). Aucune colonne ni contrainte modifiée
-- ici : `pricing_tier` reste nullable et n'est simplement plus jamais
-- renseigné pour submission_kind='discipline_addition' (pas de palier
-- full/half : ce n'est pas une proratisation mi-mois).
-- ============================================================================

comment on column payment_submissions.pricing_tier is
  'Palier appliqué à un supplément seat_addition selon la quinzaine d''ajout : full = tarif plein (1ère quinzaine), half = demi-tarif (2ème quinzaine). Null pour submission_kind=subscription ou discipline_addition (ce dernier reprend le plein tarif du plan déjà payé par l''organisation, sans proratisation).';

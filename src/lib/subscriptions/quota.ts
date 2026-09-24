import { createClient } from "@/lib/supabase/server";

// EF-ETAB-01 (fin) : abonnement établissement (§33).
//
// `subscriptions.seats_used` existe en base (migration 0005) mais n'est
// volontairement jamais lu ni écrit ici : c'est une colonne prévue pour un
// futur webhook de paiement (EF-PAIEMENT-01), et une valeur stockée pourrait
// diverger du nombre réel de membres/invitations si une invitation est
// révoquée ou un import échoue à mi-chemin. Même principe que
// `src/lib/bulletins/compute.ts` (EF-NOTES-02) ou `src/lib/progress/drift.ts`
// (EF-PROG-03) : l'usage réel est toujours recalculé à la volée depuis la
// source de vérité (`organization_members` + `invitations`), jamais une
// deuxième donnée stockée qui pourrait désynchroniser.
//
// Modèle établissement (migration 0024, décision explicite de l'utilisateur) :
// aucun plafond de sièges — un établissement paie `plan.price_minor_units`
// par enseignant réellement inscrit (accepté ou invité en attente), chaque
// mois (`is_per_seat = true`).
//
// CORRECTION (22 sept. 2026, décision explicite de l'utilisateur, renverse
// 0024) : chaque organisation démarre désormais avec un essai gratuit de 14
// jours (`status: 'trialing'`, cf. migration 0042), qui donne les mêmes
// droits qu'un abonnement actif. 'trialing' est donc inclus ici.
const USABLE_STATUSES = ["active", "past_due", "trialing"] as const;

export interface LicenseStatus {
  hasSubscription: boolean;
  subscriptionId: string | null;
  subscriptionStatus: string | null;
  provider: string | null;
  currentPeriodEnd: string | null;
  plan: {
    id: string;
    code: string;
    name: string;
    seats: number | null; // null = pas de plafond
    isPerSeat: boolean;
    priceMinorUnits: number; // forfait si !isPerSeat, prix par enseignant si isPerSeat
    currency: string;
    billingPeriod: string;
  } | null;
  seatsLimit: number | null; // null = illimité
  acceptedCount: number; // membres ayant accepté (siège réellement occupé)
  pendingInvitationsCount: number; // invitations en attente (siège réservé)
  seatsUsed: number; // acceptedCount + pendingInvitationsCount
  hasCapacity: boolean; // reste au moins un siège disponible pour une nouvelle invitation (toujours vrai si seatsLimit est null)
  estimatedAmountDueMinorUnits: number | null; // seatsUsed × prix par siège, si plan à la place ; null si plan forfaitaire ou pas d'abonnement
}

export async function getOrgLicenseStatus(organizationId: string): Promise<LicenseStatus> {
  const supabase = await createClient();

  const [{ data: subscription }, { count: acceptedCount }, { count: pendingCount }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("id, status, provider, current_period_end, plans(id, code, name, seats, is_per_seat, price_minor_units, currency, billing_period)")
      .eq("organization_id", organizationId)
      .in("status", USABLE_STATUSES)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("organization_members")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .not("accepted_at", "is", null),
    supabase
      .from("invitations")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "pending"),
  ]);

  const rawPlan = subscription?.plans ?? null;
  const plan = rawPlan
    ? {
        id: rawPlan.id,
        code: rawPlan.code,
        name: rawPlan.name,
        seats: rawPlan.seats,
        isPerSeat: rawPlan.is_per_seat,
        priceMinorUnits: rawPlan.price_minor_units,
        currency: rawPlan.currency,
        billingPeriod: rawPlan.billing_period,
      }
    : null;
  const seatsLimit: number | null = plan?.seats ?? null;
  const accepted = acceptedCount ?? 0;
  const pending = pendingCount ?? 0;
  const seatsUsed = accepted + pending;

  return {
    hasSubscription: !!subscription,
    subscriptionId: subscription?.id ?? null,
    subscriptionStatus: subscription?.status ?? null,
    provider: subscription?.provider ?? null,
    currentPeriodEnd: subscription?.current_period_end ?? null,
    plan,
    seatsLimit,
    acceptedCount: accepted,
    pendingInvitationsCount: pending,
    seatsUsed,
    hasCapacity: seatsLimit === null ? true : seatsUsed < seatsLimit,
    estimatedAmountDueMinorUnits: plan?.isPerSeat ? seatsUsed * plan.priceMinorUnits : null,
  };
}

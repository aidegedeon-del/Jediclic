import { createClient } from "@/lib/supabase/server";

// EF-PAIEMENT-01 (suite) : à la demande explicite de l'utilisateur, un
// abonnement expiré (naturellement ou coupé manuellement depuis la page
// plateforme) bloque la CONNEXION de tous les comptes de l'organisation —
// pas seulement certaines actions. Utilisé par le layout dashboard, qui
// redirige vers /dashboard/abonnement-expire plutôt que de rendre la page
// demandée avec des boutons désactivés ça et là.
//
// Distinct du blocage par siège (`seat_payment_status`) : celui-ci ne
// concerne QUE le membre dont l'invitation a généré un supplément non payé
// (un enseignant ajouté en cours de mois), jamais le reste de l'établissement.

export type AccessGateReason = "org_expired" | "seat_payment_pending" | null;

export interface AccessGateResult {
  blocked: boolean;
  reason: AccessGateReason;
}

export interface RenewalReminder {
  daysRemaining: number;
  currentPeriodEnd: string;
}

// Fenêtre de relance : à la demande explicite de l'utilisateur ("le cron
// d'expiration"), en complément du blocage déjà livré — prévenir avant que
// l'accès ne soit coupé, pas seulement le jour où il l'est. Aucune
// infrastructure d'e-mail transactionnel n'existe dans ce projet (seul
// Supabase Auth envoie des e-mails, uniquement pour les invitations) : la
// relance est donc un bandeau in-app, même mécanisme que le bandeau
// "invitations en attente" déjà affiché dans le layout dashboard — décision
// prise pour rester cohérent avec l'existant plutôt que d'introduire un
// fournisseur d'e-mail non demandé (Convention §19).
const RENEWAL_REMINDER_WINDOW_DAYS = 7;

export function computeRenewalReminder(subscription: {
  status: string;
  current_period_end: string | null;
} | null): RenewalReminder | null {
  if (!subscription || subscription.status !== "active" || !subscription.current_period_end) {
    return null;
  }

  const msRemaining = new Date(subscription.current_period_end).getTime() - Date.now();
  const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));

  if (daysRemaining < 0 || daysRemaining > RENEWAL_REMINDER_WINDOW_DAYS) {
    return null;
  }

  return { daysRemaining, currentPeriodEnd: subscription.current_period_end };
}

export async function getRenewalReminder(organizationId: string): Promise<RenewalReminder | null> {
  const supabase = await createClient();
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("status, current_period_end")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return computeRenewalReminder(subscription);
}

// CORRECTION (22 sept. 2026, décision explicite de l'utilisateur, renverse
// le commentaire précédent) : chaque organisation reçoit désormais un
// abonnement d'essai de 14 jours à sa création (migration 0042, trigger
// `create_trial_subscription`). L'absence totale de ligne `subscriptions`
// est donc anormale (essai jamais créé, plan introuvable au moment de la
// création) et doit bloquer l'accès au même titre qu'un essai/abonnement
// expiré, plutôt que de laisser un accès illimité par défaut.
export async function getAccessGateStatus(
  organizationId: string,
  membershipId: string
): Promise<AccessGateResult> {
  const supabase = await createClient();

  const [{ data: subscription }, { data: membership }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("id, status")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("organization_members").select("seat_payment_status").eq("id", membershipId).maybeSingle(),
  ]);

  if (membership?.seat_payment_status === "pending") {
    return { blocked: true, reason: "seat_payment_pending" };
  }

  if (!subscription || subscription.status === "expired") {
    return { blocked: true, reason: "org_expired" };
  }

  return { blocked: false, reason: null };
}

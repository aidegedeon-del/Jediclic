import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit/log";
import { getOrgLicenseStatus } from "@/lib/subscriptions/quota";

// EF-PAIEMENT-01 — collecte Wave à validation manuelle.
//
// CORRECTION FIABILITÉ :
// - confirmWavePayment : vérification idempotente du statut avant traitement
//   (protection contre double confirmation d'une même déclaration)
// - Erreurs détaillées à chaque étape critique
// - Journalisation best-effort (ne bloque pas l'action principale)

export interface WaveInstructions {
  configured: boolean;
  phone: string | null;
  name: string | null;
}

export function getWaveInstructions(): WaveInstructions {
  const phone = process.env.WAVE_PAYMENT_PHONE || null;
  const name = process.env.WAVE_PAYMENT_NAME || null;
  return { configured: !!phone, phone, name };
}

export interface SubmitWavePaymentInput {
  organizationId: string;
  planCode: string;
  userId: string;
  payerPhone?: string | null;
}

// CORRECTION : Ajout de validation du planCode pour éviter une injection SQL
// via les filtres Supabase (protection en profondeur)
function validatePlanCode(code: string): void {
  if (!/^[a-z0-9_]+$/.test(code)) {
    throw new Error("Code de plan invalide.");
  }
}

export async function submitWavePayment(input: SubmitWavePaymentInput) {
  const supabase = await createClient();

  // CORRECTION : Validation du planCode
  validatePlanCode(input.planCode);

  const { data: plan, error: planError } = await supabase
    .from("plans")
    .select("id, code, name, seats, price_minor_units, currency, billing_period, is_per_seat, audience")
    .eq("code", input.planCode)
    .eq("is_active", true)
    .single();
  if (planError || !plan) throw new Error("Plan introuvable.");

  let seatsSnapshot: number | null = null;
  let amountDue = plan.price_minor_units;
  if (plan.is_per_seat) {
    const license = await getOrgLicenseStatus(input.organizationId);
    seatsSnapshot = license.seatsUsed;
    amountDue = license.seatsUsed * plan.price_minor_units;
    if (amountDue <= 0) {
      throw new Error("Aucun enseignant inscrit ou en attente : invitez au moins un enseignant avant de payer.");
    }
  }

  const { data: submission, error } = await supabase
    .from("payment_submissions")
    .insert({
      organization_id: input.organizationId,
      plan_id: plan.id,
      billing_period: plan.billing_period,
      seats_snapshot: seatsSnapshot,
      amount_due_minor_units: amountDue,
      currency: plan.currency,
      payment_method: "wave",
      submission_kind: "subscription",
      payer_phone: input.payerPhone?.trim() || null,
      submitted_by: input.userId,
    })
    .select("id, app_reference")
    .single();
  if (error) throw new Error(error.message);

  // Journalisation best-effort
  try {
    await logAudit({
      organizationId: input.organizationId,
      actorId: input.userId,
      action: "payment_submission.create",
      entityTable: "payment_submissions",
      entityId: submission!.id,
      beforeData: null,
      afterData: { planCode: plan.code, amountDue, billingPeriod: plan.billing_period, reference: submission!.app_reference },
    });
  } catch (auditErr) {
    console.error("[submitWavePayment] Audit best-effort échoué :", auditErr);
  }

  return { id: submission!.id as string, reference: submission!.app_reference as string };
}

export interface SubmitSeatAdditionPaymentInput {
  organizationId: string;
  invitationId: string;
  userId: string;
}

export async function submitSeatAdditionPayment(input: SubmitSeatAdditionPaymentInput) {
  const supabase = await createClient();

  const { data: invitation, error: invError } = await supabase
    .from("invitations")
    .select("id, organization_id, needs_seat_payment, seat_payment_submission_id")
    .eq("id", input.invitationId)
    .eq("organization_id", input.organizationId)
    .single();
  if (invError || !invitation) throw new Error("Invitation introuvable.");
  if (!invitation.needs_seat_payment) {
    throw new Error("Cette invitation ne nécessite pas de supplément.");
  }
  if (invitation.seat_payment_submission_id) {
    throw new Error("Un supplément a déjà été déclaré pour cette invitation.");
  }

  const { data: plan, error: planError } = await supabase
    .from("plans")
    .select("id, price_minor_units, currency, billing_period")
    .eq("code", "establishment_per_teacher")
    .eq("is_active", true)
    .single();
  if (planError || !plan) throw new Error("Plan établissement introuvable.");

  const dayOfMonth = new Date().getDate();
  const tier: "full" | "half" = dayOfMonth <= 15 ? "full" : "half";
  const amountDue = tier === "full" ? plan.price_minor_units : Math.round(plan.price_minor_units / 2);

  const now = new Date();
  const periodStart = now.toISOString();
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

  const { data: submission, error } = await supabase
    .from("payment_submissions")
    .insert({
      organization_id: input.organizationId,
      plan_id: plan.id,
      billing_period: plan.billing_period,
      amount_due_minor_units: amountDue,
      currency: plan.currency,
      payment_method: "wave",
      submission_kind: "seat_addition",
      added_invitation_id: input.invitationId,
      pricing_tier: tier,
      submitted_by: input.userId,
    })
    .select("id, app_reference")
    .single();
  if (error) throw new Error(error.message);

  const { error: updError } = await supabase
    .from("invitations")
    .update({ seat_payment_submission_id: submission!.id })
    .eq("id", input.invitationId);
  if (updError) {
    // CORRECTION : si la liaison invitation→submission échoue, supprimer la
    // soumission pour ne pas laisser de données orphelines
    await supabase.from("payment_submissions").delete().eq("id", submission!.id);
    throw new Error(`Liaison invitation impossible : ${updError.message}. Aucune déclaration créée.`);
  }

  // Journalisation best-effort
  try {
    await logAudit({
      organizationId: input.organizationId,
      actorId: input.userId,
      action: "payment_submission.create",
      entityTable: "payment_submissions",
      entityId: submission!.id,
      beforeData: null,
      afterData: { submissionKind: "seat_addition", amountDue, tier, reference: submission!.app_reference },
    });
  } catch (auditErr) {
    console.error("[submitSeatAdditionPayment] Audit best-effort échoué :", auditErr);
  }

  return { id: submission!.id as string, reference: submission!.app_reference as string };
}

export interface SubmitDisciplineAdditionPaymentInput {
  organizationId: string;
  teacherId: string;
  subjectId: string;
  userId: string;
}

export async function submitDisciplineAdditionPayment(input: SubmitDisciplineAdditionPaymentInput) {
  const supabase = await createClient();

  const { data: existingGrant } = await supabase
    .from("teacher_discipline_grants")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("teacher_id", input.teacherId)
    .eq("subject_id", input.subjectId)
    .maybeSingle();
  if (existingGrant) {
    throw new Error("Cette discipline est déjà débloquée pour ce compte.");
  }

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("kind")
    .eq("id", input.organizationId)
    .single();
  if (orgError || !org) throw new Error("Organisation introuvable.");

  const { data: activeSubscription } = await supabase
    .from("subscriptions")
    .select("plans(billing_period)")
    .eq("organization_id", input.organizationId)
    .in("status", ["active", "past_due"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const billingPeriod =
    (activeSubscription?.plans as { billing_period?: string } | null)?.billing_period === "yearly"
      ? "yearly"
      : "monthly";

  const referencePlanCode =
    org.kind === "establishment"
      ? billingPeriod === "yearly"
        ? "establishment_per_teacher_yearly"
        : "establishment_per_teacher"
      : billingPeriod === "yearly"
        ? "individual_yearly"
        : "individual_monthly";

  const { data: plan, error: planError } = await supabase
    .from("plans")
    .select("id, price_minor_units, currency, billing_period")
    .eq("code", referencePlanCode)
    .eq("is_active", true)
    .single();
  if (planError || !plan) throw new Error("Plan de référence introuvable.");

  const amountDue = plan.price_minor_units;

  const { data: submission, error } = await supabase
    .from("payment_submissions")
    .insert({
      organization_id: input.organizationId,
      plan_id: plan.id,
      billing_period: plan.billing_period,
      amount_due_minor_units: amountDue,
      currency: plan.currency,
      payment_method: "wave",
      submission_kind: "discipline_addition",
      discipline_teacher_id: input.teacherId,
      discipline_subject_id: input.subjectId,
      pricing_tier: null,
      submitted_by: input.userId,
    })
    .select("id, app_reference")
    .single();
  if (error) throw new Error(error.message);

  // Journalisation best-effort
  try {
    await logAudit({
      organizationId: input.organizationId,
      actorId: input.userId,
      action: "payment_submission.create",
      entityTable: "payment_submissions",
      entityId: submission!.id,
      beforeData: null,
      afterData: { submissionKind: "discipline_addition", amountDue, referencePlanCode, reference: submission!.app_reference },
    });
  } catch (auditErr) {
    console.error("[submitDisciplineAdditionPayment] Audit best-effort échoué :", auditErr);
  }

  return { id: submission!.id as string, reference: submission!.app_reference as string };
}

// --- Ce qui suit est réservé à la validation plateforme (service_role) ----

function periodLengthDays(billingPeriod: string): number {
  return billingPeriod === "yearly" ? 365 : 30;
}

// CORRECTION FIABILITÉ majeure : confirmWavePayment était une opération
// multi-étapes (update submission + update/insert subscription + logAudit)
// sans protection contre une double confirmation. On ajoute :
// 1. Vérification atomique du statut "pending_review" via un UPDATE conditionnel
//    (UPDATE ... WHERE status = 'pending_review') pour éviter la race condition
// 2. Journalisation best-effort (ne bloque pas la confirmation)
export async function confirmWavePayment(submissionId: string, adminUserId: string) {
  const admin = createAdminClient();

  // CORRECTION : Lecture + vérification du statut
  const { data: submission, error: subError } = await admin
    .from("payment_submissions")
    .select(
      "id, organization_id, plan_id, billing_period, status, amount_due_minor_units, submission_kind, added_invitation_id, discipline_teacher_id, discipline_subject_id"
    )
    .eq("id", submissionId)
    .single();
  if (subError || !submission) throw new Error("Déclaration de paiement introuvable.");

  // CORRECTION : Protection contre double confirmation
  if (submission.status === "confirmed") {
    // Déjà confirmé (double appel) : idempotent, on retourne sans erreur
    console.warn(`[confirmWavePayment] Soumission ${submissionId} déjà confirmée (idempotent).`);
    return;
  }
  if (submission.status !== "pending_review") {
    throw new Error(`Cette déclaration a déjà été traitée (statut : ${submission.status}).`);
  }

  // CORRECTION : Mise à jour atomique avec filtre sur le statut pour éviter
  // la race condition (deux admins confirment en même temps)
  const { error: confirmStatusError, data: updatedRows } = await admin
    .from("payment_submissions")
    .update({ status: "confirmed", reviewed_by: adminUserId, reviewed_at: new Date().toISOString() })
    .eq("id", submissionId)
    .eq("status", "pending_review") // Filtre atomique
    .select("id");

  // Si aucune ligne mise à jour, une autre confirmation a gagné la race → idempotent
  if (confirmStatusError) throw new Error(confirmStatusError.message);
  const updatedCount = updatedRows?.length ?? 0;
  if (updatedCount === 0) {
    console.warn(`[confirmWavePayment] Race condition détectée sur ${submissionId} : déjà confirmé par un autre admin.`);
    return;
  }

  // Supplément pour un enseignant ajouté en cours de mois
  if (submission.submission_kind === "seat_addition") {
    if (submission.added_invitation_id) {
      const { error: memberError } = await admin
        .from("organization_members")
        .update({ seat_payment_status: "paid" })
        .eq("invitation_id", submission.added_invitation_id);
      if (memberError) {
        console.error(`[confirmWavePayment] Mise à jour seat_payment_status échouée :`, memberError.message);
        // Ne pas re-lancer : la confirmation est déjà enregistrée
      }
    }

    try {
      await logAudit({
        organizationId: submission.organization_id,
        actorId: adminUserId,
        action: "payment_submission.confirm",
        entityTable: "payment_submissions",
        entityId: submissionId,
        beforeData: { status: "pending_review", submissionKind: "seat_addition" },
        afterData: { status: "confirmed" },
      });
    } catch (auditErr) {
      console.error("[confirmWavePayment] Audit best-effort échoué :", auditErr);
    }
    return;
  }

  // Supplément pour une 3e discipline
  if (submission.submission_kind === "discipline_addition") {
    if (submission.discipline_teacher_id && submission.discipline_subject_id) {
      const { error: grantError } = await admin
        .from("teacher_discipline_grants")
        .upsert(
          {
            organization_id: submission.organization_id,
            teacher_id: submission.discipline_teacher_id,
            subject_id: submission.discipline_subject_id,
            source: "payment_submission",
            payment_submission_id: submissionId,
          },
          { onConflict: "organization_id,teacher_id,subject_id" }
        );
      if (grantError) {
        console.error(`[confirmWavePayment] Grant discipline échoué :`, grantError.message);
      }
    }

    try {
      await logAudit({
        organizationId: submission.organization_id,
        actorId: adminUserId,
        action: "payment_submission.confirm",
        entityTable: "payment_submissions",
        entityId: submissionId,
        beforeData: { status: "pending_review", submissionKind: "discipline_addition" },
        afterData: { status: "confirmed" },
      });
    } catch (auditErr) {
      console.error("[confirmWavePayment] Audit best-effort échoué :", auditErr);
    }
    return;
  }

  // Abonnement standard
  const now = new Date();
  const periodEnd = new Date(now.getTime() + periodLengthDays(submission.billing_period) * 24 * 60 * 60 * 1000);

  const { data: existing } = await admin
    .from("subscriptions")
    .select("id")
    .eq("organization_id", submission.organization_id)
    .in("status", ["active", "past_due"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let subscriptionId: string;
  if (existing) {
    const { data: updated, error } = await admin
      .from("subscriptions")
      .update({
        plan_id: submission.plan_id,
        status: "active",
        provider: "wave",
        provider_reference: submissionId,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        access_blocked_at: null,
        access_blocked_by: null,
        access_blocked_reason: null,
      })
      .eq("id", existing.id)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    subscriptionId = updated!.id;
  } else {
    const { data: inserted, error } = await admin
      .from("subscriptions")
      .insert({
        organization_id: submission.organization_id,
        plan_id: submission.plan_id,
        status: "active",
        provider: "wave",
        provider_reference: submissionId,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    subscriptionId = inserted!.id;
  }

  // Lier la subscription à la soumission
  const { error: linkError } = await admin
    .from("payment_submissions")
    .update({ subscription_id: subscriptionId })
    .eq("id", submissionId);
  if (linkError) {
    console.error(`[confirmWavePayment] Liaison subscription→submission échouée (non bloquant) :`, linkError.message);
  }

  // Journalisation best-effort
  try {
    await logAudit({
      organizationId: submission.organization_id,
      actorId: adminUserId,
      action: "payment_submission.confirm",
      entityTable: "subscriptions",
      entityId: subscriptionId,
      beforeData: { paymentSubmissionId: submissionId, status: "pending_review" },
      afterData: { status: "active", provider: "wave", amountDue: submission.amount_due_minor_units },
    });
  } catch (auditErr) {
    console.error("[confirmWavePayment] Audit best-effort échoué :", auditErr);
  }
}

export async function rejectWavePayment(submissionId: string, adminUserId: string, note?: string) {
  const admin = createAdminClient();

  const { data: submission, error: subError } = await admin
    .from("payment_submissions")
    .select("id, organization_id, status")
    .eq("id", submissionId)
    .single();
  if (subError || !submission) throw new Error("Déclaration de paiement introuvable.");

  // CORRECTION : Idempotence — si déjà rejeté, ne pas relancer l'erreur
  if (submission.status === "rejected") {
    console.warn(`[rejectWavePayment] Soumission ${submissionId} déjà rejetée (idempotent).`);
    return;
  }
  if (submission.status !== "pending_review") {
    throw new Error(`Cette déclaration a déjà été traitée (statut : ${submission.status}).`);
  }

  const { error } = await admin
    .from("payment_submissions")
    .update({
      status: "rejected",
      reviewed_by: adminUserId,
      reviewed_at: new Date().toISOString(),
      review_note: note?.trim() || null,
    })
    .eq("id", submissionId);
  if (error) throw new Error(error.message);

  // Journalisation best-effort
  try {
    await logAudit({
      organizationId: submission.organization_id,
      actorId: adminUserId,
      action: "payment_submission.reject",
      entityTable: "payment_submissions",
      entityId: submissionId,
      beforeData: { status: "pending_review" },
      afterData: { status: "rejected" },
    });
  } catch (auditErr) {
    console.error("[rejectWavePayment] Audit best-effort échoué :", auditErr);
  }
}

export async function blockOrganizationAccess(subscriptionId: string, adminUserId: string, reason?: string) {
  const admin = createAdminClient();

  const { data: subscription, error: subError } = await admin
    .from("subscriptions")
    .select("id, organization_id, status")
    .eq("id", subscriptionId)
    .single();
  if (subError || !subscription) throw new Error("Abonnement introuvable.");

  const { error } = await admin
    .from("subscriptions")
    .update({
      status: "expired",
      access_blocked_at: new Date().toISOString(),
      access_blocked_by: adminUserId,
      access_blocked_reason: reason?.trim() || null,
    })
    .eq("id", subscriptionId);
  if (error) throw new Error(error.message);

  // Journalisation best-effort
  try {
    await logAudit({
      organizationId: subscription.organization_id,
      actorId: adminUserId,
      action: "subscription.access_block",
      entityTable: "subscriptions",
      entityId: subscriptionId,
      beforeData: { status: subscription.status },
      afterData: { status: "expired", accessBlockedManually: true },
    });
  } catch (auditErr) {
    console.error("[blockOrganizationAccess] Audit best-effort échoué :", auditErr);
  }
}

export async function reactivateOrganizationAccess(subscriptionId: string, adminUserId: string) {
  const admin = createAdminClient();

  const { data: subscription, error: subError } = await admin
    .from("subscriptions")
    .select("id, organization_id, status, plan_id, plans(billing_period)")
    .eq("id", subscriptionId)
    .single();
  if (subError || !subscription) throw new Error("Abonnement introuvable.");

  const now = new Date();
  const billingPeriod = subscription.plans?.billing_period ?? "monthly";
  const periodEnd = new Date(now.getTime() + periodLengthDays(billingPeriod) * 24 * 60 * 60 * 1000);

  const { error } = await admin
    .from("subscriptions")
    .update({
      status: "active",
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      access_blocked_at: null,
      access_blocked_by: null,
      access_blocked_reason: null,
    })
    .eq("id", subscriptionId);
  if (error) throw new Error(error.message);

  // Journalisation best-effort
  try {
    await logAudit({
      organizationId: subscription.organization_id,
      actorId: adminUserId,
      action: "subscription.access_reactivate",
      entityTable: "subscriptions",
      entityId: subscriptionId,
      beforeData: { status: subscription.status },
      afterData: { status: "active" },
    });
  } catch (auditErr) {
    console.error("[reactivateOrganizationAccess] Audit best-effort échoué :", auditErr);
  }
}

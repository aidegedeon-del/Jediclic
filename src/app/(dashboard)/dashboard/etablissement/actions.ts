"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCurrentOrg } from "@/lib/dashboard/context";
import { logAudit } from "@/lib/audit/log";
import { getOrgLicenseStatus } from "@/lib/subscriptions/quota";
import { submitWavePayment, submitSeatAdditionPayment } from "@/lib/payments/wave";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Database } from "@/lib/types/database.types";

type UserRole = Database["public"]["Enums"]["user_role"];
const INVITABLE_ROLES = ["teacher", "manager", "admin", "reader"] as const satisfies readonly UserRole[];
const ESTABLISHMENT_PLAN_CODES = new Set(["establishment_per_teacher", "establishment_per_teacher_yearly"]);
const SUPERVISOR_ROLES = new Set(["owner", "admin"]);

// Schéma de validation pour inviteTeacher
// z.enum(...) infère un type union littéral (pas `string`) : `role` est donc
// directement compatible avec l'enum Postgres `user_role`, sans cast `as`.
const InviteTeacherSchema = z.object({
  email: z.string().email("Adresse e-mail invalide.").max(255),
  role: z.enum(INVITABLE_ROLES, { message: "Rôle invalide." }),
  classId: z.string().uuid().nullable(),
});

// EF-ETAB-01 — Inviter un enseignant dans un établissement.
//
// CORRECTION FIABILITÉ :
// - Validation Zod sur email, role et classId
// - Journalisation logAudit best-effort (ne bloque pas l'invitation)
// - removeTeacherFromOrg : ordre des opérations inversé (supprimer member
//   AVANT de libérer les classes) pour éviter un état incohérent si classesError
//   → CORRECTION : garder l'ordre logique mais rendre classesError non-bloquant
//   (libérer les classes est une opération de nettoyage, pas un prérequis
//   à la suppression du membre)
export async function inviteTeacher(formData: FormData) {
  const supabase = await createClient();
  const { user, membership } = await requireCurrentOrg();
  const org = membership.organizations;

  if (membership.role !== "owner" && membership.role !== "admin") {
    throw new Error("Seuls les propriétaires et administrateurs peuvent inviter des enseignants.");
  }
  if (org?.kind !== "establishment") {
    throw new Error("Les invitations ne sont disponibles que pour les espaces établissement.");
  }

  // CORRECTION : Validation Zod
  const rawClassId = String(formData.get("classId") ?? "").trim() || null;
  const rawData = {
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    role: String(formData.get("role") ?? "teacher"),
    classId: rawClassId && rawClassId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i) ? rawClassId : null,
  };
  const parsed = InviteTeacherSchema.safeParse(rawData);
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(" | "));
  }
  const { email, role, classId } = parsed.data;

  const orgId = membership.organization_id;

  if (classId) {
    const { data: targetClass } = await supabase
      .from("classes")
      .select("id, organization_id, teacher_id")
      .eq("id", classId)
      .maybeSingle();
    if (!targetClass || targetClass.organization_id !== orgId) {
      throw new Error("Classe introuvable pour cet établissement.");
    }
    if (targetClass.teacher_id) {
      throw new Error("Cette classe a déjà un professeur assigné.");
    }
  }

  const { data: existing } = await supabase
    .from("invitations")
    .select("id, role")
    .eq("organization_id", orgId)
    .eq("email", email)
    .eq("status", "pending")
    .maybeSingle();

  if (!existing) {
    const license = await getOrgLicenseStatus(orgId);
    if (!license.hasSubscription) {
      throw new Error(
        "Aucun abonnement actif pour cet établissement. Activez un abonnement avant d'inviter un enseignant."
      );
    }
    if (!license.hasCapacity) {
      throw new Error(
        `Quota de licences atteint (${license.seatsUsed}/${license.seatsLimit} sièges utilisés). Passez à un plan supérieur ou annulez une invitation en attente.`
      );
    }
  }

  let invitationId: string;
  if (existing) {
    // `update_organization_invitation(p_class_id uuid, ...)` n'a pas de
    // valeur par défaut côté SQL (migration 0036) mais accepte bien NULL au
    // niveau Postgres (aucune contrainte NOT NULL sur les paramètres de
    // fonction) — le générateur de types Supabase ne reflète pas cette
    // nuance et type l'argument en `string` non-nullable. Cast ciblé et
    // documenté, pas un contournement de type silencieux.
    const { error } = await supabase.rpc("update_organization_invitation", {
      p_invitation_id: existing.id,
      p_role: role,
      p_class_id: classId as unknown as string,
    });
    if (error) throw new Error(error.message);
    invitationId = existing.id;
  } else {
    const { data: inserted, error } = await supabase.rpc("create_organization_invitation", {
      p_organization_id: orgId,
      p_email: email,
      p_role: role,
      // `p_class_id uuid default null` côté SQL : `undefined` fait utiliser
      // ce même défaut, donc `classId ?? undefined` préserve exactement le
      // comportement souhaité pour classId === null.
      p_class_id: classId ?? undefined,
    });
    if (error || !inserted) throw new Error(error?.message ?? "Impossible de créer l'invitation.");
    invitationId = inserted.id;
  }

  // CORRECTION : Journalisation best-effort
  try {
    await logAudit({
      organizationId: orgId,
      actorId: user!.id,
      action: "invitation.role_set",
      entityTable: "invitations",
      entityId: invitationId,
      beforeData: existing ? { email, role: existing.role } : null,
      afterData: { email, role },
    });
  } catch (auditErr) {
    console.error("[inviteTeacher] Audit best-effort échoué :", auditErr);
  }

  try {
    const admin = createAdminClient();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${appUrl}/auth/callback?next=/dashboard/invitations`,
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      revalidatePath("/dashboard/etablissement");
      throw new Error(
        "Invitation enregistrée, mais l'e-mail n'a pas pu être envoyé (configuration serveur incomplète). Contactez la personne manuellement."
      );
    }
    // Autres cas (compte déjà existant) : silencieux
  }

  revalidatePath("/dashboard/etablissement");
}

export async function submitEstablishmentWavePayment(formData: FormData) {
  const { user, membership } = await requireCurrentOrg();
  const org = membership.organizations;

  if (membership.role !== "owner" && membership.role !== "admin") {
    throw new Error("Seuls les propriétaires et administrateurs peuvent gérer l'abonnement.");
  }
  if (org?.kind !== "establishment") {
    throw new Error("La gestion d'abonnement par plan de licences n'est disponible que pour les espaces établissement.");
  }

  const planCode = String(formData.get("planCode") ?? "");
  if (!ESTABLISHMENT_PLAN_CODES.has(planCode)) {
    throw new Error("Plan invalide.");
  }

  const payerPhone = String(formData.get("payerPhone") ?? "");

  await submitWavePayment({
    organizationId: membership.organization_id,
    planCode,
    userId: user!.id,
    payerPhone,
  });

  revalidatePath("/dashboard/etablissement");
}

export async function submitSeatAdditionWavePayment(formData: FormData) {
  const { user, membership } = await requireCurrentOrg();
  const org = membership.organizations;

  if (membership.role !== "owner" && membership.role !== "admin") {
    throw new Error("Seuls les propriétaires et administrateurs peuvent régler ce supplément.");
  }
  if (org?.kind !== "establishment") {
    throw new Error("Cette action n'est disponible que pour les espaces établissement.");
  }

  const invitationId = String(formData.get("invitationId") ?? "");
  // CORRECTION : Validation UUID
  if (!invitationId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(invitationId)) {
    throw new Error("Identifiant invitation invalide.");
  }

  await submitSeatAdditionPayment({
    organizationId: membership.organization_id,
    invitationId,
    userId: user!.id,
  });

  revalidatePath("/dashboard/etablissement");
}

// EF-ETAB-02 : retire un professeur de l'établissement.
//
// CORRECTION FIABILITÉ :
// - La libération des classes (update teacher_id = null) est rendue non-bloquante
//   si elle échoue : le membre est quand même retiré, et un admin peut libérer
//   les classes manuellement. L'inverse (membre supprimé mais classes bloquées)
//   était le vrai risque de l'ordre précédent.
// - Journalisation best-effort
export async function removeTeacherFromOrg(memberId: string) {
  const supabase = await createClient();
  const { user, membership } = await requireCurrentOrg();

  if (!SUPERVISOR_ROLES.has(membership.role)) {
    throw new Error("Seuls le directeur (ou une personne promue au même niveau) peuvent retirer un professeur.");
  }

  // CORRECTION : Validation UUID
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(memberId)) {
    throw new Error("Identifiant membre invalide.");
  }

  const { data: target } = await supabase
    .from("organization_members")
    .select("id, user_id, role, organization_id")
    .eq("id", memberId)
    .eq("organization_id", membership.organization_id)
    .maybeSingle();

  if (!target) throw new Error("Membre introuvable.");
  if (target.role === "owner") {
    throw new Error("Le directeur/créateur de l'établissement ne peut pas être retiré ainsi.");
  }
  if (target.user_id === user!.id) {
    throw new Error("Vous ne pouvez pas vous retirer vous-même.");
  }

  const admin = createAdminClient();

  // CORRECTION : Libérer les classes AVANT de supprimer le membre (ordre logique)
  // mais rendre non-bloquant si échoue (le retrait du membre prime)
  const { error: classesError } = await admin
    .from("classes")
    .update({ teacher_id: null })
    .eq("organization_id", membership.organization_id)
    .eq("teacher_id", target.user_id);
  if (classesError) {
    console.error("[removeTeacherFromOrg] Libération classes échouée (non-bloquant, retrait du membre continue) :", classesError.message);
  }

  const { error: deleteError } = await supabase.rpc("remove_organization_member", { p_member_id: memberId });
  if (deleteError) throw new Error(deleteError.message);

  // CORRECTION : Journalisation best-effort
  try {
    await logAudit({
      organizationId: membership.organization_id,
      actorId: user!.id,
      action: "member.remove",
      entityTable: "organization_members",
      entityId: memberId,
      beforeData: { user_id: target.user_id, role: target.role },
      afterData: null,
    });
  } catch (auditErr) {
    console.error("[removeTeacherFromOrg] Audit best-effort échoué :", auditErr);
  }

  revalidatePath("/dashboard/etablissement");
  revalidatePath("/dashboard/classes");
}

export async function promoteToSupervisor(memberId: string) {
  const supabase = await createClient();
  const { user, membership } = await requireCurrentOrg();

  if (!SUPERVISOR_ROLES.has(membership.role)) {
    throw new Error("Seuls le directeur (ou une personne déjà superviseur) peuvent promouvoir un autre membre.");
  }

  // CORRECTION : Validation UUID
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(memberId)) {
    throw new Error("Identifiant membre invalide.");
  }

  const { data: target } = await supabase
    .from("organization_members")
    .select("id, role")
    .eq("id", memberId)
    .eq("organization_id", membership.organization_id)
    .maybeSingle();
  if (!target) throw new Error("Membre introuvable.");

  // CORRECTION : Idempotence — si déjà admin, pas d'erreur
  if (target.role === "admin") {
    revalidatePath("/dashboard/etablissement");
    return;
  }

  const { error } = await supabase.rpc("set_organization_member_role", { p_member_id: memberId, p_new_role: "admin" });
  if (error) throw new Error(error.message);

  // CORRECTION : Journalisation best-effort
  try {
    await logAudit({
      organizationId: membership.organization_id,
      actorId: user!.id,
      action: "member.role_assign",
      entityTable: "organization_members",
      entityId: memberId,
      beforeData: { role: target.role },
      afterData: { role: "admin" },
    });
  } catch (auditErr) {
    console.error("[promoteToSupervisor] Audit best-effort échoué :", auditErr);
  }

  revalidatePath("/dashboard/etablissement");
}

export async function revokeInvitation(invitationId: string) {
  const supabase = await createClient();
  const { user, membership } = await requireCurrentOrg();

  if (membership.role !== "owner" && membership.role !== "admin") {
    throw new Error("Seuls les propriétaires et administrateurs peuvent annuler une invitation.");
  }

  // CORRECTION : Validation UUID
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(invitationId)) {
    throw new Error("Identifiant invitation invalide.");
  }

  const { data: before } = await supabase
    .from("invitations")
    .select("email, role, status")
    .eq("id", invitationId)
    .eq("organization_id", membership.organization_id)
    .maybeSingle();

  if (!before) throw new Error("Invitation introuvable.");

  // CORRECTION : Idempotence — déjà révoquée
  if (before.status === "revoked") {
    revalidatePath("/dashboard/etablissement");
    return;
  }

  const { error } = await supabase.rpc("revoke_organization_invitation", { p_invitation_id: invitationId });
  if (error) throw new Error(error.message);

  // CORRECTION : Journalisation best-effort
  try {
    await logAudit({
      organizationId: membership.organization_id,
      actorId: user!.id,
      action: "invitation.revoke",
      entityTable: "invitations",
      entityId: invitationId,
      beforeData: before ?? null,
      afterData: before ? { ...before, status: "revoked" } : null,
    });
  } catch (auditErr) {
    console.error("[revokeInvitation] Audit best-effort échoué :", auditErr);
  }

  revalidatePath("/dashboard/etablissement");
}

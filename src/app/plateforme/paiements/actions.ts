"use server";

import { requirePlatformAdmin } from "@/lib/payments/platform-admin";
import { confirmWavePayment, rejectWavePayment, blockOrganizationAccess, reactivateOrganizationAccess } from "@/lib/payments/wave";
import { revalidatePath } from "next/cache";

export async function confirmPaymentSubmission(submissionId: string) {
  const admin = await requirePlatformAdmin();
  await confirmWavePayment(submissionId, admin.id);
  revalidatePath("/plateforme/paiements");
}

export async function rejectPaymentSubmission(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const submissionId = String(formData.get("submissionId") ?? "");
  const note = String(formData.get("note") ?? "");
  if (!submissionId) throw new Error("Déclaration de paiement manquante.");
  await rejectWavePayment(submissionId, admin.id, note);
  revalidatePath("/plateforme/paiements");
}

// « Stopper l'accès » et le réactiver, depuis le même écran (à la demande
// explicite de l'utilisateur), indépendamment d'une nouvelle déclaration de
// paiement — utile en fin de mois/année ou pour corriger une coupure faite
// par erreur.
export async function blockAccess(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const subscriptionId = String(formData.get("subscriptionId") ?? "");
  const reason = String(formData.get("reason") ?? "");
  if (!subscriptionId) throw new Error("Abonnement manquant.");
  await blockOrganizationAccess(subscriptionId, admin.id, reason);
  revalidatePath("/plateforme/paiements");
}

export async function reactivateAccess(subscriptionId: string) {
  const admin = await requirePlatformAdmin();
  await reactivateOrganizationAccess(subscriptionId, admin.id);
  revalidatePath("/plateforme/paiements");
}

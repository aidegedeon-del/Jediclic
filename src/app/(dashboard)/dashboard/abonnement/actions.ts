"use server";

import { requireCurrentOrg } from "@/lib/dashboard/context";
import { submitWavePayment } from "@/lib/payments/wave";
import { revalidatePath } from "next/cache";

const INDIVIDUAL_PLAN_CODES = new Set(["individual_monthly", "individual_yearly"]);

// EF-PAIEMENT-01 (professeur individuel). Contrairement à l'établissement,
// il n'y a ici qu'un seul membre (l'owner lui-même) : pas de vérification de
// rôle owner/admin séparée, mais on garde `requireCurrentOrg` pour s'assurer
// que l'utilisateur a bien un espace individuel.
export async function submitIndividualWavePayment(formData: FormData) {
  const { user, membership } = await requireCurrentOrg();
  const org = membership.organizations;

  if (org?.kind !== "individual_teacher") {
    throw new Error("Cette page est réservée aux espaces professeur individuel.");
  }

  const planCode = String(formData.get("planCode") ?? "");
  if (!INDIVIDUAL_PLAN_CODES.has(planCode)) throw new Error("Plan invalide.");

  const payerPhone = String(formData.get("payerPhone") ?? "");

  await submitWavePayment({
    organizationId: membership.organization_id,
    planCode,
    userId: user!.id,
    payerPhone,
  });

  revalidatePath("/dashboard/abonnement");
}

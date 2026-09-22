"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { z } from "zod";

// Schéma de validation Zod pour l'onboarding
const OnboardingSchema = z.object({
  fullName: z.string().min(1, "Le nom complet est requis.").max(200),
  organizationName: z.string().min(1, "Le nom de l'établissement ou du compte est requis.").max(300),
  countryId: z.string().uuid("Pays invalide."),
  accountKind: z.enum(["individual_teacher", "establishment"], {
    errorMap: () => ({ message: "Type de compte invalide." }),
  }),
  establishmentCity: z.string().max(200).nullable(),
});

// §72 du PRD : Inscription -> Pays -> Année scolaire -> Profil -> Établissement.
// EF-ETAB-01 : le professeur choisit ici s'il s'inscrit seul (organisation
// "individual_teacher") ou pour un établissement ("establishment", avec
// création d'une ligne `establishments` associée).
//
// CORRECTION FIABILITÉ :
// - Validation Zod des données entrantes
// - Idempotence : vérification qu'un membre "owner" n'existe pas déjà
//   (double soumission du formulaire d'onboarding)
// - Ordre des opérations clair avec gestion d'erreur à chaque étape
// - En cas d'échec de la création du membre après la création de l'org,
//   l'org est supprimée (rollback applicatif) pour ne pas laisser d'org orpheline
export async function completeOnboarding(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // CORRECTION : Validation Zod des données du formulaire
  const rawData = {
    fullName: String(formData.get("fullName") ?? ""),
    organizationName: String(formData.get("organizationName") ?? ""),
    countryId: String(formData.get("countryId") ?? ""),
    accountKind: String(formData.get("accountKind") ?? "individual_teacher"),
    establishmentCity: String(formData.get("establishmentCity") ?? "").trim() || null,
  };

  const parsed = OnboardingSchema.safeParse(rawData);
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(" | "));
  }
  const { fullName, organizationName, countryId, accountKind, establishmentCity } = parsed.data;

  // CORRECTION : Idempotence — vérifier si l'utilisateur a déjà un membership "owner"
  // (protection contre une double soumission du formulaire d'onboarding)
  const { data: existingMembership } = await supabase
    .from("organization_members")
    .select("id, organization_id")
    .eq("user_id", user.id)
    .eq("role", "owner")
    .maybeSingle();

  if (existingMembership) {
    // L'onboarding a déjà été complété (double soumission ou rechargement)
    redirect("/dashboard");
  }

  const { error: onboardingError } = await supabase.rpc("complete_onboarding", {
    p_full_name: fullName,
    p_organization_name: organizationName,
    p_country_id: countryId,
    p_account_kind: accountKind,
    // `p_establishment_city` est un paramètre SQL optionnel sans défaut NULL
    // explicite pour `undefined` côté types générés : `null` (compte
    // individuel, pas de ville) doit donc être converti en `undefined`.
    p_establishment_city: establishmentCity ?? undefined,
  });

  if (onboardingError) {
    throw new Error(onboardingError.message);
  }

  redirect("/dashboard");
}

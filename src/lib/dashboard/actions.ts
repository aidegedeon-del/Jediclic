"use server";

import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACTIVE_ORG_COOKIE } from "@/lib/dashboard/constants";

// Sélecteur multi-espaces (PRD §71) : un utilisateur peut être membre
// accepté de plusieurs organisations (ex. professeur individuel + membre
// d'un établissement, ou membre de plusieurs établissements). L'espace
// actif est stocké dans un cookie plutôt qu'en base — c'est une préférence
// de session, pas une donnée métier, même principe que les autres choix
// d'affichage non persistés en base dans ce projet.
export async function switchOrganization(organizationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Revérifié côté serveur avant d'écrire le cookie : on ne fait jamais
  // confiance à l'id reçu du client sans confirmer une appartenance réelle
  // et acceptée (même esprit que la RLS, défense en profondeur — §26).
  const { data: membership } = await supabase
    .from("organization_members")
    .select("id")
    .eq("user_id", user.id)
    .eq("organization_id", organizationId)
    .not("accepted_at", "is", null)
    .maybeSingle();

  if (!membership) {
    throw new Error("Vous n'êtes pas membre de cet espace.");
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORG_COOKIE, organizationId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  redirect("/dashboard");
}

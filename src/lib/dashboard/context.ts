import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ACTIVE_ORG_COOKIE } from "@/lib/dashboard/constants";
import { cache } from "react";

// Sélecteur multi-espaces (PRD §71) : un utilisateur peut être membre
// accepté de plusieurs organisations. `memberships` liste tout ce dont il
// est membre (le plus ancien en premier) ; `membership` reste l'espace
// actif unique déjà consommé par les 140+ appels existants dans le projet
// (organization_id/role/organizations) — ce champ n'a pas changé de forme,
// seule sa provenance change : le cookie ACTIVE_ORG_COOKIE si présent et
// valide, sinon le plus ancien membership (ordre stable, jamais aléatoire).
export const requireCurrentOrg = cache(async function requireCurrentOrg() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: allMemberships } = await supabase
    .from("organization_members")
    .select("id, organization_id, role, organizations(id, name, kind, country_id)")
    .eq("user_id", user!.id)
    .not("accepted_at", "is", null)
    .order("accepted_at", { ascending: true });

  const memberships = allMemberships ?? [];
  if (memberships.length === 0) redirect("/onboarding");

  const cookieStore = await cookies();
  const activeOrgId = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;

  const membership =
    (activeOrgId && memberships.find((m) => m.organization_id === activeOrgId)) ||
    memberships[0];

  return { user, membership, memberships };
});

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

// Validation des paiements Wave (EF-PAIEMENT-01) : réservée à la personne
// qui opère la plateforme, pas aux rôles owner/admin d'une organisation
// (eux gèrent leur propre établissement, pas les paiements des autres).
// Pas de table dédiée pour ce premier lot — une simple liste d'e-mails
// autorisés via variable d'environnement (`PLATFORM_ADMIN_EMAILS`, séparés
// par des virgules), jamais codée en dur (§7/§19). À faire évoluer vers un
// vrai rôle en base si le nombre de personnes amenées à valider grandit.
function platformAdminEmails(): string[] {
  return (process.env.PLATFORM_ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

// Ne redirige jamais vers une page expliquant pourquoi l'accès est refusé
// (`/dashboard` générique) : cette zone ne doit pas être découvrable par un
// professeur ou un établissement.
export async function requirePlatformAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const allowed = platformAdminEmails();
  if (!user || !user.email || !allowed.includes(user.email.toLowerCase())) {
    redirect("/dashboard");
  }

  return user;
}

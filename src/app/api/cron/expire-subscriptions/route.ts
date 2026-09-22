import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

// Déclenche expire_overdue_subscriptions() (migration 0026) : fait passer à
// `expired` tout abonnement `active` dont current_period_end est dépassé.
//
// Protégé par un secret partagé (`CRON_SECRET`), jamais codé en dur.
//
// CORRECTION FIABILITÉ :
// - Vérification que CRON_SECRET est configuré (évite une comparaison avec
//   undefined qui accepterait n'importe quelle valeur si secret est vide)
// - Logging de l'exécution pour traçabilité
// - Retour du détail de l'erreur dans les logs serveur sans l'exposer côté client
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  // CORRECTION : Si CRON_SECRET n'est pas configuré, refuser toutes les requêtes
  // (plutôt que d'accepter n'importe quelle valeur)
  if (!secret) {
    console.error("[cron/expire-subscriptions] CRON_SECRET non configuré. Requête refusée.");
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const admin = createAdminClient();

  try {
    const { error } = await admin.rpc("expire_overdue_subscriptions");
    if (error) {
      console.error("[cron/expire-subscriptions] Erreur RPC :", error.message, error.details);
      return NextResponse.json({ error: "Échec de l'expiration des abonnements." }, { status: 500 });
    }

    console.log("[cron/expire-subscriptions] Exécution réussie à", new Date().toISOString());
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[cron/expire-subscriptions] Exception inattendue :", err);
    return NextResponse.json({ error: "Erreur interne." }, { status: 500 });
  }
}

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database.types";

// ATTENTION : clé service_role — contourne RLS. Ce fichier ne doit JAMAIS
// être importé depuis un composant client ni exposé au navigateur. Réservé
// aux Server Actions/Route Handlers qui en ont explicitement besoin (ici :
// envoyer une invitation par e-mail via Supabase Auth Admin).
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY manquante : impossible d'envoyer des invitations par e-mail.");
  }

  return createSupabaseClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

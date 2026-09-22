import { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database.types";

// `school_years` est un référentiel par pays (Convention §9 : générique
// multi-pays), pas par organisation — écriture réservée à service_role
// (0006_rls_policies.sql). Ouvrir une nouvelle année scolaire est donc un
// geste plateforme (nouvelle migration de seed, comme 0007), jamais une
// action self-service dans l'app : quand la plateforme fait basculer
// `is_current` sur la nouvelle année, toutes les classes de l'année
// précédente basculent automatiquement (sans aucune action de
// l'utilisateur) dans les Archives — ce module est ce qui fait cette
// bascule côté lecture.

export type SchoolYear = { id: string; label: string; starts_on: string; ends_on: string; is_current: boolean };

// À utiliser sur toutes les pages "actives" (classes, élèves, emploi du
// temps, évaluations, notes, bulletins, analyse) : décision de principe du
// 22 août 2026, une nouvelle année scolaire = tout est reconstruit à zéro,
// donc ces pages ne doivent jamais montrer une classe d'une année passée.
export async function getCurrentSchoolYear(supabase: SupabaseClient<Database>, countryId: string): Promise<SchoolYear | null> {
  const { data } = await supabase
    .from("school_years")
    .select("id, label, starts_on, ends_on, is_current")
    .eq("country_id", countryId)
    .eq("is_current", true)
    .maybeSingle();
  return data ?? null;
}

// Pour les Archives : toute année qui n'est plus l'année en cours. Triée de
// la plus récente à la plus ancienne (le professeur consulte presque
// toujours l'année juste précédente en premier).
export async function listArchivedSchoolYears(supabase: SupabaseClient<Database>, countryId: string): Promise<SchoolYear[]> {
  const { data } = await supabase
    .from("school_years")
    .select("id, label, starts_on, ends_on, is_current")
    .eq("country_id", countryId)
    .eq("is_current", false)
    .order("starts_on", { ascending: false });
  return data ?? [];
}

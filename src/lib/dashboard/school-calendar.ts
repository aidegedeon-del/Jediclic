import { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database.types";

// Le découpage officiel de l'année scolaire (MENA/DELC) — congés, jours
// fériés, dates d'examens, journées pédagogiques. Référentiel par pays
// (comme school_years/school_periods), jamais saisi dans l'app par un
// enseignant ou un établissement : voir 0032_calendrier_scolaire.sql.

export type SchoolCalendarEvent = {
  id: string;
  category: "ferie" | "conge" | "examen" | "pedagogique";
  label: string;
  starts_on: string;
  ends_on: string;
};

export async function listSchoolCalendarEvents(
  supabase: SupabaseClient<Database>,
  schoolYearId: string
): Promise<SchoolCalendarEvent[]> {
  const { data } = await supabase
    .from("school_calendar_events")
    .select("id, category, label, starts_on, ends_on")
    .eq("school_year_id", schoolYearId)
    .order("starts_on");
  return data ?? [];
}

// À utiliser pour toute question du type "aujourd'hui, y a-t-il cours ?" —
// renvoie l'évènement (congé/férié/examen/journée pédagogique) qui couvre
// la date donnée, ou null si ce jour ne tombe dans aucun évènement connu
// (ce qui NE VEUT PAS DIRE qu'il y a cours : si le découpage n'a pas encore
// été chargé pour l'année en cours, ceci renvoie toujours null — l'appelant
// doit distinguer "jour normal" de "calendrier pas encore disponible" en
// vérifiant si listSchoolCalendarEvents() est vide pour l'année, comme pour
// school_periods, Convention §6/§54).
export function findCalendarEventForDate(
  events: SchoolCalendarEvent[],
  dateStr: string
): SchoolCalendarEvent | null {
  return events.find((e) => e.starts_on <= dateStr && dateStr <= e.ends_on) ?? null;
}

export const CALENDAR_CATEGORY_LABELS: Record<SchoolCalendarEvent["category"], string> = {
  ferie: "Jour férié",
  conge: "Congés / vacances",
  examen: "Période d'examens",
  pedagogique: "Journée pédagogique",
};

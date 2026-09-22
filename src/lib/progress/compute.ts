import { detectDrift, type DriftResult, type OfficialStep } from "./drift";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database.types";

// Une ligne = une progression de classe sur un chapitre, avec son statut
// manuel et le signal calculé (auto) en regard.
export type ProgressionDriftRow = {
  progressionId: string;
  classId: string;
  className: string;
  curriculumUnitId: string;
  unitTitle: string;
  status: string;
  completedAt: string | null;
  drift: DriftResult;
};

// EF-PROG-03. Une seule fonction de calcul, utilisée à la fois par la page
// "Programme & progression" (filtrée sur une classe) et par la page
// "Aujourd'hui" (filtrée sur les retards, toutes classes confondues) — pour
// ne jamais avoir deux implémentations de la comparaison qui divergent.
export async function computeOrgProgressionDrift(supabase: SupabaseClient<Database>, orgId: string): Promise<ProgressionDriftRow[]> {
  const { data: progressions } = await supabase
    .from("teacher_progressions")
    .select("id, class_id, curriculum_unit_id, status, completed_at, classes(name, school_year_id), curriculum_units(title)")
    .eq("organization_id", orgId);

  if (!progressions || progressions.length === 0) return [];

  const unitIds = [...new Set(progressions.map((p) => p.curriculum_unit_id))];
  const schoolYearIds = [...new Set(progressions.map((p) => p.classes?.school_year_id).filter((v): v is string => !!v))];

  const [{ data: steps }, { data: schoolYears }] = await Promise.all([
    supabase
      .from("official_progression_steps")
      .select("curriculum_unit_id, expected_start_date, expected_end_date, expected_week")
      .in("curriculum_unit_id", unitIds),
    schoolYearIds.length > 0
      ? supabase.from("school_years").select("id, starts_on").in("id", schoolYearIds)
      : Promise.resolve({ data: [] }),
  ]);

  const stepByUnit = new Map((steps ?? []).map((s) => [s.curriculum_unit_id, s]));
  const startsOnByYear = new Map((schoolYears ?? []).map((y) => [y.id, y.starts_on]));

  return progressions.map((p) => {
    const step = (stepByUnit.get(p.curriculum_unit_id) ?? null) as OfficialStep | null;
    const schoolYearStartsOn = (startsOnByYear.get(p.classes?.school_year_id) ?? null) as string | null;
    const drift = detectDrift({ status: p.status, completedAt: p.completed_at, step, schoolYearStartsOn });
    return {
      progressionId: p.id,
      classId: p.class_id,
      className: p.classes?.name ?? "",
      curriculumUnitId: p.curriculum_unit_id,
      unitTitle: p.curriculum_units?.title ?? "",
      status: p.status,
      completedAt: p.completed_at,
      drift,
    };
  });
}

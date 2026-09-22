import { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database.types";
import { computeAverage } from "@/lib/utils";

// EF-NOTES-02 : jamais de moyenne "période" stockée — toujours recalculée à
// la volée à partir de `results`/`assessments`, filtrés par les dates de la
// période officielle (school_periods.starts_on/ends_on).
export type BulletinAssessment = { id: string; title: string; maxScore: number; coefficient: number; date: string; score: number | null };

export type BulletinStudentRow = {
  studentId: string;
  fullName: string;
  average: number | null;
  rank: number | null;
  assessments: BulletinAssessment[];
  reportCard: { id: string; appreciation: string | null; observations: string | null; origin: string; version: number } | null;
};

export type SchoolPeriod = { id: string; label: string; starts_on: string; ends_on: string; ordering: number };

export async function listSchoolPeriods(supabase: SupabaseClient<Database>, schoolYearId: string): Promise<SchoolPeriod[]> {
  const { data } = await supabase
    .from("school_periods")
    .select("id, label, starts_on, ends_on, ordering")
    .eq("school_year_id", schoolYearId)
    .order("ordering");
  return data ?? [];
}

export async function getTeacherSubjectsForClass(
  supabase: SupabaseClient<Database>,
  params: { teacherId: string; classId: string }
): Promise<{ id: string; name: string }[]> {
  const { data } = await supabase
    .from("assessments")
    .select("subject_id, subjects(id, name)")
    .eq("teacher_id", params.teacherId)
    .eq("class_id", params.classId)
    .not("subject_id", "is", null);
  if (!data) return [];

  const bySubject = new Map<string, { id: string; name: string }>();
  for (const row of data) {
    if (!row.subjects) continue;
    bySubject.set(row.subjects.id, { id: row.subjects.id, name: row.subjects.name });
  }
  return [...bySubject.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// Classement décroissant sur la moyenne (méthode "compétition").
// CORRECTION : Utilisation de Number() robuste pour éviter des NaN en cas de
// valeur non numérique (défense en profondeur même si computeAverage retourne
// toujours number|null).
function withRanks(rows: Omit<BulletinStudentRow, "rank">[]): BulletinStudentRow[] {
  const ranked = [...rows]
    .filter((r) => r.average !== null && !isNaN(r.average as number))
    .sort((a, b) => (b.average as number) - (a.average as number));

  const rankByStudentId = new Map<string, number>();
  let lastAverage: number | null = null;
  let lastRank = 0;
  ranked.forEach((r, idx) => {
    if (r.average !== lastAverage) {
      lastRank = idx + 1;
      lastAverage = r.average;
    }
    rankByStudentId.set(r.studentId, lastRank);
  });

  return rows.map((r) => ({ ...r, rank: rankByStudentId.get(r.studentId) ?? null }));
}

// Moyenne de la discipline pour l'ensemble de la classe.
// CORRECTION : Exclusion des NaN potentiels (défense en profondeur)
export function computeClassAverage(rows: BulletinStudentRow[]): number | null {
  const values = rows
    .map((r) => r.average)
    .filter((a): a is number => a !== null && !isNaN(a));
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export async function computeClassBulletin(
  supabase: SupabaseClient<Database>,
  params: { classId: string; teacherId: string; subjectId: string; period: SchoolPeriod }
): Promise<BulletinStudentRow[]> {
  const { classId, teacherId, subjectId, period } = params;

  const [{ data: s, error: studentsError }, { data: a, error: assessmentsError }, { data: rc }] = await Promise.all([
    supabase
      .from("students")
      .select("id, full_name")
      .eq("class_id", classId)
      .is("archived_at", null)
      .order("full_name"),
    supabase
      .from("assessments")
      .select("id, title, max_score, coefficient, assessment_date")
      .eq("class_id", classId)
      .eq("teacher_id", teacherId)
      .eq("subject_id", subjectId)
      .eq("published", true)
      .gte("assessment_date", period.starts_on)
      .lte("assessment_date", period.ends_on)
      .order("assessment_date"),
    supabase
      .from("report_cards")
      .select("id, student_id, appreciation, observations, origin, version")
      .eq("class_id", classId)
      .eq("school_period_id", period.id)
      .eq("subject_id", subjectId),
  ]);

  // CORRECTION : Gestion des erreurs de lecture (non bloquant mais tracé)
  if (studentsError) {
    console.error("[computeClassBulletin] Erreur lecture élèves :", studentsError.message);
  }
  if (assessmentsError) {
    console.error("[computeClassBulletin] Erreur lecture évaluations :", assessmentsError.message);
  }

  const students = s ?? [];
  const assessments = a ?? [];
  const reportCardByStudent = new Map((rc ?? []).map((r) => [r.student_id, r]));

  type ResultRow = { student_id: string; assessment_id: string; score: number | null };
  let results: ResultRow[] = [];
  const assessmentIds = assessments.map((x) => x.id);
  if (assessmentIds.length > 0) {
    const { data: r, error: resultsError } = await supabase
      .from("results")
      .select("student_id, assessment_id, score")
      .in("assessment_id", assessmentIds);
    if (resultsError) {
      console.error("[computeClassBulletin] Erreur lecture résultats :", resultsError.message);
    }
    results = r ?? [];
  }

  // PERF : index O(1) par clé composite "studentId:assessmentId" plutôt que
  // .find() en O(N) répété pour chaque (élève, évaluation) — la boucle
  // ci-dessous passe ainsi de O(élèves × évaluations × résultats) à
  // O(élèves × évaluations), déterminant pour les grandes classes/le grand
  // nombre d'évaluations par période. Résultat strictement identique.
  const resultByKey = new Map<string, { score: number | null }>();
  for (const r of results) {
    resultByKey.set(`${r.student_id}:${r.assessment_id}`, r);
  }

  const rows = students.map((s) => {
    const studentAssessments: BulletinAssessment[] = assessments.map((a) => {
      const r = resultByKey.get(`${s.id}:${a.id}`);
      return {
        id: a.id,
        title: a.title,
        // CORRECTION : Number() avec fallback 0 pour les max_score/coefficient
        // potentiellement null/undefined (données incohérentes en base)
        maxScore: Number(a.max_score) || 20,
        coefficient: Number(a.coefficient) || 1,
        date: a.assessment_date,
        score: r?.score ?? null,
      };
    });
    const average = computeAverage(
      studentAssessments.map((x) => ({ score: x.score, maxScore: x.maxScore, coefficient: x.coefficient }))
    );
    const rcRow = reportCardByStudent.get(s.id) ?? null;
    return {
      studentId: s.id,
      fullName: s.full_name,
      average,
      assessments: studentAssessments,
      reportCard: rcRow
        ? { id: rcRow.id, appreciation: rcRow.appreciation, observations: rcRow.observations, origin: rcRow.origin, version: rcRow.version }
        : null,
    };
  });

  return withRanks(rows);
}

export async function computeStudentBulletin(
  supabase: SupabaseClient<Database>,
  params: { classId: string; teacherId: string; subjectId: string; studentId: string; period: SchoolPeriod }
): Promise<BulletinStudentRow | null> {
  const rows = await computeClassBulletin(supabase, params);
  return rows.find((r) => r.studentId === params.studentId) ?? null;
}

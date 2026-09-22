import { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database.types";
import { computeAverage } from "@/lib/utils";

// Convention §20/§28 : détection déterministe à partir des résultats en base.
// CORRECTION : Protection contre les divisions par zéro dans les moyennes
// de chapitre et les calculs par étudiant.
export const DIFFICULTY_THRESHOLD = 10;

export type ChapterStat = { unitId: string; title: string; average: number; evaluationsCount: number; studentsBelow: number };
export type StudentInDifficulty = {
  id: string;
  full_name: string;
  overall: number | null;
  unitsConcerned: { title: string; average: number }[];
};

export type ClassAnalysis = {
  hasData: boolean;
  chapterStats: ChapterStat[];
  studentsInDifficulty: StudentInDifficulty[];
};

export type ClassAverage = { hasData: boolean; average: number | null; studentsCount: number };

export async function computeClassAverage(supabase: SupabaseClient<Database>, classId: string): Promise<ClassAverage> {
  const [{ data: s, error: studentsError }, { data: a, error: assessmentsError }] = await Promise.all([
    supabase.from("students").select("id").eq("class_id", classId).is("archived_at", null),
    supabase.from("assessments").select("id, max_score, coefficient").eq("class_id", classId).eq("published", true),
  ]);

  if (studentsError) console.error("[computeClassAverage] Erreur élèves :", studentsError.message);
  if (assessmentsError) console.error("[computeClassAverage] Erreur évaluations :", assessmentsError.message);

  const students = s ?? [];
  const assessments = a ?? [];
  const assessmentIds = assessments.map((x) => x.id);

  if (assessmentIds.length === 0 || students.length === 0) {
    return { hasData: false, average: null, studentsCount: students.length };
  }

  const { data: r } = await supabase
    .from("results")
    .select("student_id, assessment_id, score, is_absent")
    .in("assessment_id", assessmentIds);
  const results = r ?? [];

  // PERF : index O(1) par clé composite au lieu d'un .find() en O(N) répété
  // pour chaque paire (élève, évaluation) — voir même correction dans
  // bulletins/compute.ts et computeClassAnalysis ci-dessous.
  const resultByKey = new Map<string, { score: number | null; is_absent: boolean }>();
  for (const res of results) {
    if (!res.is_absent) resultByKey.set(`${res.student_id}:${res.assessment_id}`, res);
  }

  const studentAverages = students
    .map((st) => {
      const scores = assessments.map((a) => {
        const res = resultByKey.get(`${st.id}:${a.id}`);
        return {
          score: res?.score ?? null,
          // CORRECTION : Protection contre max_score = 0 (computeAverage filtre, mais par sécurité)
          maxScore: Number(a.max_score) || 20,
          coefficient: Number(a.coefficient) || 1,
        };
      });
      return computeAverage(scores);
    })
    .filter((avg): avg is number => avg !== null && !isNaN(avg));

  if (studentAverages.length === 0) {
    return { hasData: false, average: null, studentsCount: students.length };
  }

  const average = studentAverages.reduce((acc, v) => acc + v, 0) / studentAverages.length;
  return { hasData: true, average, studentsCount: students.length };
}

export async function computeClassAnalysis(supabase: SupabaseClient<Database>, classId: string): Promise<ClassAnalysis> {
  const [{ data: s, error: studentsError }, { data: a, error: assessmentsError }] = await Promise.all([
    supabase.from("students").select("id, full_name").eq("class_id", classId).is("archived_at", null).order("full_name"),
    supabase.from("assessments").select("id, title, max_score, coefficient").eq("class_id", classId).eq("published", true),
  ]);

  if (studentsError) console.error("[computeClassAnalysis] Erreur élèves :", studentsError.message);
  if (assessmentsError) console.error("[computeClassAnalysis] Erreur évaluations :", assessmentsError.message);

  const students = s ?? [];
  const assessments = a ?? [];

  type ResultRow = { student_id: string; assessment_id: string; score: number | null; is_absent: boolean };
  type AssessmentUnitRow = { assessment_id: string; curriculum_unit_id: string; curriculum_units: { id: string; title: string } | null };
  let results: ResultRow[] = [];
  let assessmentUnits: AssessmentUnitRow[] = [];
  const assessmentIds = assessments.map((x) => x.id);
  if (assessmentIds.length > 0) {
    const [{ data: r }, { data: au }] = await Promise.all([
      supabase.from("results").select("student_id, assessment_id, score, is_absent").in("assessment_id", assessmentIds),
      supabase.from("assessment_units").select("assessment_id, curriculum_unit_id, curriculum_units(id, title)").in("assessment_id", assessmentIds),
    ]);
    results = r ?? [];
    assessmentUnits = au ?? [];
  }

  const assessmentById = new Map(assessments.map((a) => [a.id, a]));
  const unitsByAssessment = new Map<string, { id: string; title: string }[]>();
  for (const au of assessmentUnits) {
    const list = unitsByAssessment.get(au.assessment_id) ?? [];
    list.push({ id: au.curriculum_unit_id, title: au.curriculum_units?.title ?? "Chapitre" });
    unitsByAssessment.set(au.assessment_id, list);
  }

  // PERF : même correction qu'en 0 (bulletins/compute.ts) — index O(1) par
  // clé composite au lieu d'un .find() en O(N) répété pour chaque paire
  // (élève, évaluation). Sur une classe de 40 élèves × 20 évaluations, ceci
  // évite jusqu'à 800 parcours linéaires du tableau `results`.
  const resultByKey = new Map<string, { score: number | null; is_absent: boolean }>();
  for (const r of results) {
    resultByKey.set(`${r.student_id}:${r.assessment_id}`, r);
  }

  const studentOverallAvg = new Map<string, number | null>();
  for (const st of students) {
    const scores = assessments.map((a) => {
      const r = resultByKey.get(`${st.id}:${a.id}`);
      return {
        score: r?.score ?? null,
        maxScore: Number(a.max_score) || 20,
        coefficient: Number(a.coefficient) || 1,
      };
    });
    studentOverallAvg.set(st.id, computeAverage(scores));
  }

  const unitScores = new Map<string, { title: string; scores: number[] }>();
  const studentUnitScores = new Map<string, Map<string, { title: string; scores: number[] }>>();

  for (const r of results) {
    if (r.score === null || r.is_absent) continue;
    const assessment = assessmentById.get(r.assessment_id);
    if (!assessment) continue;
    // CORRECTION : Protection contre max_score = 0 (division par zéro)
    const maxScore = Number(assessment.max_score);
    if (maxScore <= 0) continue;
    const normalized = (Number(r.score) / maxScore) * 20;
    // CORRECTION : Ignorer les valeurs non finies
    if (!isFinite(normalized) || isNaN(normalized)) continue;

    const units = unitsByAssessment.get(r.assessment_id) ?? [];
    for (const u of units) {
      const stat = unitScores.get(u.id) ?? { title: u.title, scores: [] };
      stat.scores.push(normalized);
      unitScores.set(u.id, stat);

      const byStudent = studentUnitScores.get(r.student_id) ?? new Map();
      const studentStat = byStudent.get(u.id) ?? { title: u.title, scores: [] };
      studentStat.scores.push(normalized);
      byStudent.set(u.id, studentStat);
      studentUnitScores.set(r.student_id, byStudent);
    }
  }

  const chapterStats: ChapterStat[] = Array.from(unitScores.entries())
    .map(([unitId, { title, scores }]) => {
      // CORRECTION : Protection division par zéro
      if (scores.length === 0) return null;
      const average = scores.reduce((a, b) => a + b, 0) / scores.length;
      const studentsBelow = new Set(
        Array.from(studentUnitScores.entries())
          .filter(([, byUnit]) => {
            const u = byUnit.get(unitId);
            if (!u || u.scores.length === 0) return false;
            const avg = u.scores.reduce((a, b) => a + b, 0) / u.scores.length;
            return avg < DIFFICULTY_THRESHOLD;
          })
          .map(([studentId]) => studentId)
      );
      return { unitId, title, average, evaluationsCount: scores.length, studentsBelow: studentsBelow.size };
    })
    .filter((stat): stat is ChapterStat => stat !== null)
    .sort((a, b) => a.average - b.average);

  const studentsInDifficulty = students
    .map((st) => {
      const overall = studentOverallAvg.get(st.id) ?? null;
      const byUnit = studentUnitScores.get(st.id);
      const unitsConcerned = byUnit
        ? Array.from(byUnit.entries())
            .map(([, { title, scores }]) => {
              // CORRECTION : Protection division par zéro
              if (scores.length === 0) return null;
              return { title, average: scores.reduce((a, b) => a + b, 0) / scores.length };
            })
            .filter((u): u is { title: string; average: number } => u !== null)
            .filter((u) => u.average < DIFFICULTY_THRESHOLD)
        : [];
      const flagged = (overall !== null && !isNaN(overall) && overall < DIFFICULTY_THRESHOLD) || unitsConcerned.length > 0;
      return { ...st, overall, unitsConcerned, flagged };
    })
    .filter((st) => st.flagged)
    .sort((a, b) => (a.overall ?? 99) - (b.overall ?? 99));

  const hasData = results.some((r) => r.score !== null && !r.is_absent);

  return { hasData, chapterStats, studentsInDifficulty: studentsInDifficulty.map(({ flagged, ...rest }) => rest) };
}

// EF-PROG-03 : détection automatique retard/avance, par comparaison entre
// la progression réelle du professeur (`teacher_progressions`) et le
// référentiel officiel (`official_progression_steps`).
//
// Convention §11 : la progression officielle et la progression réelle ne
// sont JAMAIS fusionnées en une seule donnée stockée. Ce module ne fait que
// COMPARER les deux à la volée pour produire un signal affiché — il n'écrit
// jamais dans `teacher_progressions.status`. Le statut manuel choisi par le
// professeur (planned/in_progress/done/late/ahead) reste la seule donnée
// stockée ; le signal "auto" calculé ici s'affiche à côté, jamais à la place.
export type DriftKind = "late" | "ahead" | "on_track" | "unknown";

export type OfficialStep = {
  expected_start_date: string | null;
  expected_end_date: string | null;
  expected_week: number | null;
};

export type DriftInput = {
  status: string; // statut manuel actuel (teacher_progressions.status)
  completedAt: string | null;
  step: OfficialStep | null;
  schoolYearStartsOn: string | null; // pour résoudre expected_week si les dates exactes manquent
  today?: Date;
};

export type DriftResult = {
  kind: DriftKind;
  daysDiff: number | null; // toujours positif ; le sens est donné par `kind`
  expectedEndDate: string | null; // résolue (dates exactes ou déduite de expected_week), pour affichage
  expectedStartDate: string | null;
};

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((b.getTime() - a.getTime()) / msPerDay);
}

function resolveDate(exact: string | null, week: number | null, schoolYearStartsOn: string | null): Date | null {
  if (exact) return new Date(exact);
  if (week != null && schoolYearStartsOn) return addDays(new Date(schoolYearStartsOn), (week - 1) * 7);
  return null;
}

export function detectDrift({ status, completedAt, step, schoolYearStartsOn, today }: DriftInput): DriftResult {
  const now = today ?? new Date();

  if (!step) {
    return { kind: "unknown", daysDiff: null, expectedEndDate: null, expectedStartDate: null };
  }

  const expectedStart = resolveDate(step.expected_start_date, step.expected_week, schoolYearStartsOn);
  const expectedEnd = resolveDate(
    step.expected_end_date,
    step.expected_week != null ? step.expected_week + 1 : null, // une semaine de fenêtre si seule la semaine est connue
    schoolYearStartsOn
  );

  const expectedEndDate = expectedEnd ? expectedEnd.toISOString().slice(0, 10) : null;
  const expectedStartDate = expectedStart ? expectedStart.toISOString().slice(0, 10) : null;

  if (!expectedEnd) {
    return { kind: "unknown", daysDiff: null, expectedEndDate, expectedStartDate };
  }

  if (status === "done") {
    if (!completedAt) return { kind: "unknown", daysDiff: null, expectedEndDate, expectedStartDate };
    const completed = new Date(completedAt);
    if (expectedStart && completed < expectedStart) {
      return { kind: "ahead", daysDiff: daysBetween(completed, expectedStart), expectedEndDate, expectedStartDate };
    }
    if (completed > expectedEnd) {
      return { kind: "late", daysDiff: daysBetween(expectedEnd, completed), expectedEndDate, expectedStartDate };
    }
    return { kind: "on_track", daysDiff: null, expectedEndDate, expectedStartDate };
  }

  // Pas encore terminé : en retard uniquement si la date de fin officielle est déjà dépassée.
  if (now > expectedEnd) {
    return { kind: "late", daysDiff: daysBetween(expectedEnd, now), expectedEndDate, expectedStartDate };
  }
  return { kind: "on_track", daysDiff: null, expectedEndDate, expectedStartDate };
}

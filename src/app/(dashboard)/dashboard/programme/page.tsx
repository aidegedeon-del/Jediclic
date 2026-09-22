import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/dashboard/context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { detectDrift } from "@/lib/progress/drift";
import { upsertProgression } from "./actions";

const STATUS_LABEL: Record<string, { label: string; variant: "default" | "success" | "warning" | "danger" }> = {
  planned: { label: "Prévu", variant: "default" },
  in_progress: { label: "En cours", variant: "warning" },
  done: { label: "Terminé", variant: "success" },
  late: { label: "Retard", variant: "danger" },
  ahead: { label: "Avance", variant: "success" },
};

const DRIFT_LABEL: Record<string, { label: (days: number | null) => string; variant: "warning" | "success" }> = {
  late: { label: (d) => `Retard détecté${d ? ` — ${d} j` : ""}`, variant: "warning" },
  ahead: { label: (d) => `Avance détectée${d ? ` — ${d} j` : ""}`, variant: "success" },
};

function formatDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default async function ProgrammePage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string }>;
}) {
  const { classId } = await searchParams;
  const supabase = await createClient();
  const { membership } = await requireCurrentOrg();
  const orgId = membership.organization_id;

  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, education_level_id, school_year_id, school_years(starts_on)")
    .eq("organization_id", orgId)
    .is("archived_at", null);

  const activeClass = classes?.find((c) => c.id === classId) ?? classes?.[0];

  // Types locaux reflétant exactement les colonnes des `.select()`
  // ci-dessous — remplace les `any[]` précédents.
  type CurriculumUnitRow = { id: string; title: string; ordering: number; recommended_hours: number | null };
  type ProgressionStepRow = { curriculum_unit_id: string; expected_start_date: string | null; expected_end_date: string | null; expected_week: number | null };
  type ProgressionRow = { curriculum_unit_id: string; status: string; completed_at: string | null };

  let units: CurriculumUnitRow[] = [];
  let progressions: ProgressionRow[] = [];
  let stepsByUnit = new Map<string, ProgressionStepRow>();

  if (activeClass) {
    const { data: curricula } = await supabase
      .from("curricula")
      .select("id")
      .eq("education_level_id", activeClass.education_level_id)
      .eq("is_active", true);

    const curriculumIds = (curricula ?? []).map((c) => c.id);

    if (curriculumIds.length > 0) {
      const { data: u } = await supabase
        .from("curriculum_units")
        .select("id, title, ordering, recommended_hours")
        .in("curriculum_id", curriculumIds)
        .order("ordering");
      units = u ?? [];

      if (units.length > 0) {
        const { data: steps } = await supabase
          .from("official_progression_steps")
          .select("curriculum_unit_id, expected_start_date, expected_end_date, expected_week")
          .in("curriculum_unit_id", units.map((u) => u.id));
        stepsByUnit = new Map((steps ?? []).map((s) => [s.curriculum_unit_id, s]));
      }
    }

    const { data: p } = await supabase
      .from("teacher_progressions")
      .select("curriculum_unit_id, status, completed_at")
      .eq("class_id", activeClass.id);
    progressions = p ?? [];
  }

  const progressionByUnit = new Map(progressions.map((p) => [p.curriculum_unit_id, p]));
  const schoolYearStartsOn = activeClass?.school_years?.starts_on ?? null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-voice text-2xl font-semibold text-foreground">Programme & progression</h1>
        <p className="text-sm text-muted-foreground">
          Le référentiel officiel à gauche, votre avancement réel à droite — jamais confondus. Le retard ou l&apos;avance
          « détecté » est un signal calculé automatiquement, distinct du statut que vous choisissez vous-même.
        </p>
      </div>

      {/* Filtres de classes */}
      {(classes ?? []).length > 0 && (
        <nav aria-label="Sélection de la classe pour la progression">
          <ul className="flex flex-wrap gap-2" role="list">
            {(classes ?? []).map((c) => {
              const isActive = activeClass?.id === c.id;
              return (
                <li key={c.id}>
                  <a
                    href={`/dashboard/programme?classId=${c.id}`}
                    aria-current={isActive ? "page" : undefined}
                    className={`inline-flex rounded-full border px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 ${
                      isActive ? "border-primary bg-primary text-primary-foreground" : "border-border-strong hover:bg-muted"
                    }`}
                  >
                    {c.name}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Chapitres du programme officiel</CardTitle>
          <CardDescription>Mettez à jour votre statut au fil de l&apos;année.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {units.length === 0 && (
            <p className="text-sm text-muted-foreground" role="status">
              Aucun programme officiel chargé pour ce niveau pour l&apos;instant.
            </p>
          )}
          <ul role="list" className="space-y-2">
            {units.map((u) => {
              const progression = progressionByUnit.get(u.id);
              const status = progression?.status ?? "planned";
              const meta = STATUS_LABEL[status] ?? STATUS_LABEL.planned;
              const step = stepsByUnit.get(u.id) ?? null;
              const drift = detectDrift({
                status,
                completedAt: progression?.completed_at ?? null,
                step,
                schoolYearStartsOn,
              });
              const driftMeta = drift.kind !== "unknown" && drift.kind !== "on_track" ? DRIFT_LABEL[drift.kind] : null;
              // IDs uniques pour chaque select (WCAG 1.3.1)
              const selectId = `status-${u.id}`;

              return (
                <li key={u.id} className="rounded-lg border border-border bg-background-soft px-4 py-2.5 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span id={`unit-title-${u.id}`}>{u.title}</span>
                    <div className="flex items-center gap-2">
                      {driftMeta && (
                        <Badge variant={driftMeta.variant}>
                          {driftMeta.label(drift.daysDiff)}
                        </Badge>
                      )}
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                      {activeClass && (
                        <form
                          action={upsertProgression}
                          className="flex items-center gap-1"
                          aria-label={`Modifier le statut de progression pour : ${u.title}`}
                        >
                          <input type="hidden" name="classId" value={activeClass.id} />
                          <input type="hidden" name="curriculumUnitId" value={u.id} />
                          {/* Label sr-only relié au select (WCAG 1.3.1) */}
                          <Label htmlFor={selectId} className="sr-only">
                            Statut de {u.title}
                          </Label>
                          <Select
                            id={selectId}
                            name="status"
                            defaultValue={status}
                            className="h-8 w-auto px-2 text-xs"
                            aria-labelledby={`unit-title-${u.id}`}
                          >
                            <option value="planned">Prévu</option>
                            <option value="in_progress">En cours</option>
                            <option value="done">Terminé</option>
                            <option value="late">Retard</option>
                            <option value="ahead">Avance</option>
                          </Select>
                          <button
                            type="submit"
                            className="h-8 rounded-md border border-border-strong px-2 text-xs font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
                            aria-label={`Valider le statut de ${u.title}`}
                          >
                            OK
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                  {(step?.expected_start_date || step?.expected_end_date || step?.expected_week) && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Officiel : {formatDate(drift.expectedStartDate) ?? "?"} → {formatDate(drift.expectedEndDate) ?? "?"}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

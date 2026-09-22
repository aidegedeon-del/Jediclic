import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/dashboard/context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { saveResult, togglePublish } from "./actions";

export default async function AssessmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  await requireCurrentOrg();

  const { data: assessment } = await supabase
    .from("assessments")
    .select("id, title, max_score, coefficient, published, assessment_date, classes(id, name)")
    .eq("id", id)
    .single();

  if (!assessment) return (
    <p className="text-sm text-muted-foreground" role="alert">Évaluation introuvable.</p>
  );

  const [{ data: students }, { data: results }] = await Promise.all([
    supabase.from("students").select("id, full_name").eq("class_id", assessment.classes!.id).is("archived_at", null).order("full_name"),
    supabase.from("results").select("student_id, score, is_absent").eq("assessment_id", id),
  ]);

  const resultByStudent = new Map((results ?? []).map((r) => [r.student_id, r]));
  const publishAction = togglePublish.bind(null, id, !assessment.published);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-voice text-2xl font-semibold text-foreground">{assessment.title}</h1>
          <p className="text-sm text-muted-foreground">
            {assessment.classes?.name} · {assessment.assessment_date} · Barème {assessment.max_score} · Coeff. {assessment.coefficient}
          </p>
        </div>
        <form action={publishAction}>
          <Button type="submit" variant={assessment.published ? "secondary" : "primary"}>
            {assessment.published ? "Repasser en brouillon" : "Publier l'évaluation"}
          </Button>
        </form>
      </div>

      {/* Statut de publication — aria-live pour mise à jour dynamique (WCAG 4.1.3) */}
      <div role="status" aria-live="polite">
        <Badge variant={assessment.published ? "success" : "default"}>
          {assessment.published ? "Publiée — comptée dans les moyennes" : "Brouillon — invisible dans les moyennes"}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Saisie des notes</CardTitle>
          <CardDescription>Chaque note s&apos;enregistre indépendamment, aucun risque de tout perdre.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {(students ?? []).map((s) => {
            const result = resultByStudent.get(s.id);
            const saveForStudent = saveResult.bind(null, id);
            // IDs uniques pour lier labels et champs (WCAG 1.3.1)
            const scoreId = `score-${s.id}`;
            const absentId = `absent-${s.id}`;
            return (
              <form
                key={s.id}
                action={saveForStudent}
                className="flex items-center gap-3 rounded-lg border border-border bg-background-soft px-4 py-2 text-sm"
                aria-label={`Note de ${s.full_name}`}
              >
                <input type="hidden" name="studentId" value={s.id} />
                {/* Nom de l'élève comme en-tête de la ligne */}
                <span className="flex-1 font-medium" id={`student-name-${s.id}`}>{s.full_name}</span>

                {/* Case "Absent" avec label relié (WCAG 1.3.1) */}
                <div className="flex items-center gap-1.5">
                  <input
                    id={absentId}
                    type="checkbox"
                    name="isAbsent"
                    defaultChecked={result?.is_absent ?? false}
                    className="accent-accent w-4 h-4 cursor-pointer"
                    aria-label={`${s.full_name} — absent`}
                  />
                  <label
                    htmlFor={absentId}
                    className="text-xs text-muted-foreground cursor-pointer select-none"
                  >
                    Absent
                  </label>
                </div>

                {/* Champ de saisie de note avec label accessible */}
                <div className="flex items-center gap-1">
                  <Label htmlFor={scoreId} className="sr-only">
                    Note de {s.full_name} (sur {assessment.max_score})
                  </Label>
                  <Input
                    id={scoreId}
                    name="score"
                    type="number"
                    step="0.5"
                    min={0}
                    max={assessment.max_score}
                    defaultValue={result?.score ?? ""}
                    className="w-24"
                    placeholder={`/${assessment.max_score}`}
                    aria-label={`Note de ${s.full_name} sur ${assessment.max_score}`}
                  />
                </div>

                <Button type="submit" size="sm" variant="secondary">
                  <span className="sr-only">Enregistrer la note de {s.full_name}</span>
                  <span aria-hidden="true">Enregistrer</span>
                </Button>
              </form>
            );
          })}
          {(!students || students.length === 0) && (
            <p className="text-sm text-muted-foreground" role="status">
              Aucun élève dans cette classe.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

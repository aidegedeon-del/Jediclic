import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/dashboard/context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveAssessmentDraft, acceptAssessmentDraft, regenerateAssessmentAction, refuseAssessmentDraft } from "./actions";

const TYPE_LABELS: Record<string, string> = {
  interrogation: "Interrogation",
  controle: "Contrôle",
  composition: "Composition",
  diagnostic: "Diagnostic",
  formative: "Formative",
  sommative: "Sommative",
};

export default async function AssessmentDraftReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  await requireCurrentOrg();

  const { data: assessment } = await supabase
    .from("assessments")
    .select("id, title, assessment_type, max_score, duration_minutes, published, classes(name)")
    .eq("id", id)
    .single();

  if (!assessment) return <p className="text-sm text-muted-foreground">Cette évaluation n&apos;existe pas ou plus.</p>;

  const { data: questions } = await supabase
    .from("assessment_questions")
    .select("id, statement, max_points, ordering, exercise_id, exercises(correction)")
    .eq("assessment_id", id)
    .order("ordering");

  const { data: rec } = await supabase
    .from("ai_recommendations")
    .select("accepted")
    .eq("based_on->>contentId", id)
    .eq("based_on->>table", "assessments")
    .maybeSingle();

  const saveAction = saveAssessmentDraft.bind(null, id);
  const acceptAction = acceptAssessmentDraft.bind(null, id);
  const regenAction = regenerateAssessmentAction.bind(null, id);
  const refuseAction = refuseAssessmentDraft.bind(null, id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-voice text-2xl font-semibold text-foreground">{TYPE_LABELS[assessment.assessment_type] ?? assessment.assessment_type} proposée</h1>
          <p className="text-sm text-muted-foreground">
            {assessment.classes?.name} · Barème {assessment.max_score} · {questions?.length ?? 0} question(s)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="ai">Proposition IA</Badge>
          <Badge variant="default">Brouillon — non publiée</Badge>
          {rec?.accepted === true && <Badge variant="success">Accepté</Badge>}
          {rec?.accepted === false && <Badge variant="danger">Refusé</Badge>}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contenu (modifiable)</CardTitle>
          <CardDescription>Ajustez énoncés, points et corrections avant de vous en servir.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={saveAction} className="space-y-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Titre</label>
              <Input name="title" defaultValue={assessment.title} />
            </div>

            <div className="space-y-3">
              {(questions ?? []).map((q, i) => (
                <div key={q.id} className="rounded-lg border border-border-strong p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Question {i + 1}</span>
                    <span className="flex items-center gap-1">
                      Points
                      <Input name={`points_${q.id}`} type="number" step="0.5" defaultValue={q.max_points} className="w-16 font-data" />
                    </span>
                  </div>
                  <Textarea name={`statement_${q.id}`} className="min-h-16" defaultValue={q.statement} />
                  <label className="text-xs text-muted-foreground">Correction</label>
                  <Textarea name={`correction_${q.id}`} className="min-h-16" defaultValue={q.exercises?.correction ?? ""} />
                </div>
              ))}
              {(!questions || questions.length === 0) && (
                <p className="text-sm text-muted-foreground">Aucune question générée.</p>
              )}
            </div>

            <Button type="submit" variant="secondary">Enregistrer les modifications</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Que souhaitez-vous faire ?</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <form action={acceptAction}><Button type="submit" variant="primary">Accepter et saisir les notes</Button></form>
            <form action={refuseAction}><Button type="submit" variant="danger">Refuser et supprimer</Button></form>
          </div>
          <form action={regenAction} className="flex flex-wrap items-end gap-2 border-t border-border pt-4">
            <div className="flex flex-1 min-w-48 flex-col gap-1">
              <label className="text-xs text-muted-foreground">Régénérer entièrement avec une nouvelle consigne (facultatif)</label>
              <Input name="extraInstructions" placeholder="Ex. : 5 questions au lieu de 8, plus de calcul..." />
            </div>
            <Button type="submit" variant="secondary">Régénérer</Button>
          </form>
          <p className="text-xs text-muted-foreground">
            La publication (visible dans les moyennes) reste une action séparée et volontaire depuis la page
            Évaluations — jamais automatique.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

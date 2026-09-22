import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/dashboard/context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveExercise, acceptExercise, regenerateExercise, refuseExercise } from "./actions";

export default async function ExerciseReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  await requireCurrentOrg();

  const { data: exercise } = await supabase
    .from("exercises")
    .select("id, statement, answer, correction, difficulty, curriculum_units(title)")
    .eq("id", id)
    .single();

  if (!exercise) return <p className="text-sm text-muted-foreground">Cet exercice n&apos;existe pas ou plus.</p>;

  const { data: rec } = await supabase
    .from("ai_recommendations")
    .select("accepted")
    .eq("based_on->>contentId", id)
    .eq("based_on->>table", "exercises")
    .maybeSingle();

  const saveAction = saveExercise.bind(null, id);
  const acceptAction = acceptExercise.bind(null, id);
  const regenAction = regenerateExercise.bind(null, id);
  const refuseAction = refuseExercise.bind(null, id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-voice text-2xl font-semibold text-foreground">Exercice proposé</h1>
          <p className="text-sm text-muted-foreground">{exercise.curriculum_units?.title ?? "Chapitre non précisé"}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="ai">Proposition IA</Badge>
          {rec?.accepted === true && <Badge variant="success">Accepté</Badge>}
          {rec?.accepted === false && <Badge variant="danger">Refusé</Badge>}
          {rec?.accepted == null && <Badge variant="warning">À relire</Badge>}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contenu (modifiable)</CardTitle>
          <CardDescription>Corrigez l&apos;énoncé, la réponse ou la difficulté avant de l&apos;utiliser.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={saveAction} className="space-y-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Énoncé</label>
              <Textarea name="statement" className="min-h-20" defaultValue={exercise.statement} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Réponse attendue</label>
              <Textarea name="answer" className="min-h-16" defaultValue={exercise.answer ?? ""} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Correction détaillée</label>
              <Textarea name="correction" className="min-h-24" defaultValue={exercise.correction ?? ""} />
            </div>
            <div className="flex flex-col gap-1 max-w-xs">
              <label className="text-xs text-muted-foreground">Difficulté (1 à 5)</label>
              <Input name="difficulty" type="number" min={1} max={5} className="font-data" defaultValue={exercise.difficulty ?? 3} />
            </div>
            <Button type="submit" variant="secondary">Enregistrer les modifications</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Que souhaitez-vous faire ?</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <form action={acceptAction}><Button type="submit" variant="primary">Accepter</Button></form>
            <form action={refuseAction}><Button type="submit" variant="danger">Refuser et supprimer</Button></form>
          </div>
          <form action={regenAction} className="flex flex-wrap items-end gap-2 border-t border-border pt-4">
            <div className="flex flex-1 min-w-48 flex-col gap-1">
              <label className="text-xs text-muted-foreground">Régénérer avec une nouvelle consigne (facultatif)</label>
              <Input name="extraInstructions" placeholder="Ex. : plus difficile, avec un schéma décrit en texte..." />
            </div>
            <Button type="submit" variant="secondary">Régénérer</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

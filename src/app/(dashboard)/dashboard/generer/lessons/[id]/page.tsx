import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/dashboard/context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveLesson, acceptLesson, regenerateLessonAction, generateCorrigeAction, refuseLesson } from "./actions";

export default async function LessonReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  await requireCurrentOrg();

  const { data: lesson } = await supabase
    .from("lessons")
    .select("id, title, content, kind, origin, version, duration_minutes, classes(name), curriculum_units(title)")
    .eq("id", id)
    .single();

  if (!lesson) return <p className="text-sm text-muted-foreground">Ce contenu n&apos;existe pas ou plus.</p>;

  const { data: rec } = await supabase
    .from("ai_recommendations")
    .select("accepted")
    .eq("based_on->>contentId", id)
    .eq("based_on->>table", "lessons")
    .maybeSingle();

  // `content` est un JSON généré par l'IA, de structure libre selon le
  // type de leçon (cours/devoir) : pas de forme SQL stricte à typer.
  const content = (lesson.content ?? {}) as Record<string, unknown> & {
    titre?: string;
    objectifs?: string[];
    activites?: string[];
    exemples?: string[];
    synthese?: string;
    consignes?: string;
    exercices?: { enonce: string; points: number }[];
    duree_minutes?: number;
    duree_estimee_minutes?: number;
    corrige?: string;
  };
  const isDevoir = lesson.kind === "devoir";
  const saveAction = saveLesson.bind(null, id);
  const acceptAction = acceptLesson.bind(null, id);
  const regenAction = regenerateLessonAction.bind(null, id);
  const corrigeAction = generateCorrigeAction.bind(null, id);
  const refuseAction = refuseLesson.bind(null, id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-voice text-2xl font-semibold text-foreground">{isDevoir ? "Devoir proposé" : "Cours proposé"}</h1>
          <p className="text-sm text-muted-foreground">
            {lesson.classes?.name} · {lesson.curriculum_units?.title ?? "Chapitre non précisé"} · version {lesson.version}
          </p>
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
          <CardDescription>Ajustez librement chaque section — c&apos;est votre séance, telle que vous la voulez.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={saveAction} className="space-y-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Titre</label>
              <Input name="titre" defaultValue={content.titre ?? lesson.title} />
            </div>

            {!isDevoir && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Objectifs (un par ligne)</label>
                  <Textarea name="objectifs" className="min-h-20" defaultValue={(content.objectifs ?? []).join("\n")} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Activités (une par ligne)</label>
                  <Textarea name="activites" className="min-h-24" defaultValue={(content.activites ?? []).join("\n")} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Exemples (un par ligne)</label>
                  <Textarea name="exemples" className="min-h-20" defaultValue={(content.exemples ?? []).join("\n")} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Synthèse</label>
                  <Textarea name="synthese" className="min-h-20" defaultValue={content.synthese ?? ""} />
                </div>
              </>
            )}

            {isDevoir && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Consignes</label>
                  <Textarea name="consignes" className="min-h-20" defaultValue={content.consignes ?? ""} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Exercices (un par ligne, format « énoncé — points »)</label>
                  <Textarea
                    name="exercices"
                    className="min-h-28"
                    defaultValue={(content.exercices ?? []).map((e) => `${e.enonce} — ${e.points}`).join("\n")}
                  />
                </div>
              </>
            )}

            <div className="flex flex-col gap-1 max-w-xs">
              <label className="text-xs text-muted-foreground">Durée estimée (minutes)</label>
              <Input name="duree" type="number" className="font-data" defaultValue={content.duree_minutes ?? content.duree_estimee_minutes ?? lesson.duration_minutes ?? ""} />
            </div>

            <Button type="submit" variant="secondary">Enregistrer les modifications</Button>
          </form>
        </CardContent>
      </Card>

      {content.corrige && (
        <Card>
          <CardHeader><CardTitle>Corrigé</CardTitle></CardHeader>
          <CardContent><p className="whitespace-pre-wrap text-sm">{content.corrige}</p></CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Que souhaitez-vous faire ?</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <form action={acceptAction}><Button type="submit" variant="primary">Accepter</Button></form>
            <form action={corrigeAction}><Button type="submit" variant="secondary">{content.corrige ? "Régénérer le corrigé" : "Générer le corrigé"}</Button></form>
            <form action={refuseAction}><Button type="submit" variant="danger">Refuser et supprimer</Button></form>
          </div>
          <form action={regenAction} className="flex flex-wrap items-end gap-2 border-t border-border pt-4">
            <div className="flex flex-1 min-w-48 flex-col gap-1">
              <label className="text-xs text-muted-foreground">Régénérer entièrement avec une nouvelle consigne (facultatif)</label>
              <Input name="extraInstructions" placeholder="Ex. : plus court, insister sur les exemples concrets..." />
            </div>
            <Button type="submit" variant="secondary">Régénérer</Button>
          </form>
          <p className="text-xs text-muted-foreground">
            Une proposition de l&apos;assistant n&apos;est jamais considérée correcte par défaut — relisez-la avant
            de l&apos;utiliser en classe.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

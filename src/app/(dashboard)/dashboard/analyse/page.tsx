import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/dashboard/context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { computeClassAnalysis, DIFFICULTY_THRESHOLD } from "@/lib/analysis/compute";
import { createRemediation } from "./actions";
import type { Json } from "@/lib/types/database.types";

function badgeForAverage(avg: number): "danger" | "warning" | "success" {
  if (avg < DIFFICULTY_THRESHOLD) return "danger";
  if (avg < 14) return "warning";
  return "success";
}

// `content` est une colonne JSONB (`Json`, structure libre par
// construction) : on en extrait `objectifs`/`activites` de façon
// défensive et typée, sans jamais recourir à `any`.
function extractRemediationContent(content: Json): { objectifs: string[]; activites: string[] } {
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return { objectifs: [], activites: [] };
  }
  const obj = content as Record<string, Json>;
  const objectifs = Array.isArray(obj.objectifs) ? obj.objectifs.filter((v): v is string => typeof v === "string") : [];
  const activites = Array.isArray(obj.activites) ? obj.activites.filter((v): v is string => typeof v === "string") : [];
  return { objectifs, activites };
}

export default async function AnalysePage({
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
    .select("id, name")
    .eq("organization_id", orgId)
    .is("archived_at", null);

  const activeClass = classes?.find((c) => c.id === classId) ?? classes?.[0];

  let remediations: {
    id: string;
    scope: string;
    origin: string;
    content: Json;
    created_at: string;
    curriculum_unit_id: string | null;
    curriculum_units: { title: string } | null;
    remediation_students: { student_id: string }[];
  }[] = [];
  let hasData = false;
  let chapterStats: Awaited<ReturnType<typeof computeClassAnalysis>>["chapterStats"] = [];
  let studentsInDifficulty: Awaited<ReturnType<typeof computeClassAnalysis>>["studentsInDifficulty"] = [];

  if (activeClass) {
    const [{ data: rem }, analysis] = await Promise.all([
      supabase
        .from("remediations")
        .select("id, scope, origin, content, created_at, curriculum_unit_id, curriculum_units(title), remediation_students(student_id)")
        .eq("class_id", activeClass.id)
        .order("created_at", { ascending: false }),
      computeClassAnalysis(supabase, activeClass.id),
    ]);
    remediations = rem ?? [];
    hasData = analysis.hasData;
    chapterStats = analysis.chapterStats;
    studentsInDifficulty = analysis.studentsInDifficulty;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-voice text-2xl font-semibold text-foreground">Analyse & remédiation</h1>
        <p className="text-sm text-muted-foreground">
          Les élèves qui ont besoin d&apos;un coup de pouce, et les chapitres qui n&apos;ont pas encore été assimilés —
          repérés automatiquement à partir de vos évaluations publiées.
        </p>
      </div>

      {/* Filtres de classes */}
      {(classes ?? []).length > 0 && (
        <nav aria-label="Sélection de la classe pour l'analyse">
          <ul className="flex flex-wrap gap-2" role="list">
            {(classes ?? []).map((c) => {
              const isActive = activeClass?.id === c.id;
              return (
                <li key={c.id}>
                  <a
                    href={`/dashboard/analyse?classId=${c.id}`}
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

      {!hasData && (
        <Card>
          <CardContent className="pt-5" role="status">
            <p className="text-sm text-muted-foreground">
              Analyse impossible pour l&apos;instant : aucune note n&apos;est encore disponible pour cette classe.
            </p>
          </CardContent>
        </Card>
      )}

      {hasData && (
        <>
          {/* Chapitres à surveiller */}
          <Card>
            <CardHeader>
              <CardTitle>Chapitres à surveiller</CardTitle>
              <CardDescription>Les moyennes les plus basses par chapitre.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <ul role="list" className="space-y-2">
                {chapterStats.map((c) => (
                  <li key={c.unitId} className="flex items-center justify-between rounded-lg border border-border bg-background-soft px-4 py-2.5 text-sm">
                    <div>
                      <span>{c.title}</span>
                      <p className="text-xs text-muted-foreground">
                        {c.evaluationsCount} résultat(s) pris en compte · {c.studentsBelow} élève(s) en difficulté
                      </p>
                    </div>
                    <Badge
                      variant={badgeForAverage(c.average)}
                      aria-label={`Moyenne ${c.average.toFixed(1)} sur 20`}
                    >
                      {c.average.toFixed(1)}/20
                    </Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Élèves en difficulté */}
          <Card>
            <CardHeader>
              <CardTitle>Élèves qui ont besoin d&apos;un coup de pouce</CardTitle>
              <CardDescription>Cochez-les pour préparer une remédiation ciblée.</CardDescription>
            </CardHeader>
            <CardContent>
              {studentsInDifficulty.length === 0 && (
                <p className="text-sm text-muted-foreground" role="status">
                  Aucun élève ne présente de difficulté persistante sur les évaluations disponibles.
                </p>
              )}
              {studentsInDifficulty.length > 0 && activeClass && (
                <form action={createRemediation} className="space-y-4" aria-label="Formulaire de création de remédiation">
                  <input type="hidden" name="classId" value={activeClass.id} />

                  {/* Groupe de cases à cocher avec légende (WCAG 1.3.1) */}
                  <fieldset>
                    <legend className="sr-only">Sélectionnez les élèves à inclure dans la remédiation</legend>
                    <div className="space-y-2">
                      {studentsInDifficulty.map((s) => {
                        const checkboxId = `student-${s.id}`;
                        return (
                          <div
                            key={s.id}
                            className="flex items-start gap-3 rounded-lg border border-border bg-background-soft px-4 py-2.5 text-sm"
                          >
                            <input
                              id={checkboxId}
                              type="checkbox"
                              name="studentIds"
                              value={s.id}
                              className="mt-1 accent-accent w-4 h-4 cursor-pointer"
                            />
                            <label htmlFor={checkboxId} className="flex-1 cursor-pointer">
                              <span className="flex items-center justify-between">
                                <span className="font-medium">{s.full_name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {s.overall !== null ? `Moyenne : ${s.overall.toFixed(1)}/20` : "Pas de moyenne générale"}
                                </span>
                              </span>
                              {s.unitsConcerned.length > 0 && (
                                <span className="mt-1 flex flex-wrap gap-1">
                                  {s.unitsConcerned.map((u, i) => (
                                    <Badge
                                      key={i}
                                      variant="danger"
                                      aria-label={`${u.title} — moyenne ${u.average.toFixed(1)} sur 20`}
                                    >
                                      {u.title} — {u.average.toFixed(1)}/20
                                    </Badge>
                                  ))}
                                </span>
                              )}
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </fieldset>

                  <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border-strong p-3">
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="remediation-unit" className="text-xs text-muted-foreground">
                        Chapitre concerné (optionnel)
                      </Label>
                      <Select id="remediation-unit" name="curriculumUnitId" className="h-9 text-sm">
                        <option value="">— Aucun chapitre précis —</option>
                        {chapterStats.map((c) => (
                          <option key={c.unitId} value={c.unitId}>{c.title}</option>
                        ))}
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="remediation-scope" className="text-xs text-muted-foreground">
                        Portée
                      </Label>
                      <Select id="remediation-scope" name="scope" defaultValue="group" className="h-9 text-sm">
                        <option value="individual">Individuelle</option>
                        <option value="group">Petit groupe</option>
                        <option value="class">Classe entière</option>
                      </Select>
                    </div>
                    <div className="flex flex-1 flex-col gap-1">
                      <Label htmlFor="remediation-note" className="text-xs text-muted-foreground">
                        Note (optionnel)
                      </Label>
                      <input
                        id="remediation-note"
                        name="note"
                        className="h-9 rounded-md border border-border-strong bg-card px-2 text-sm outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/50"
                        placeholder="Objectif de la séance..."
                      />
                    </div>
                    <Button type="submit">Créer la remédiation</Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Remédiations créées */}
      <Card>
        <CardHeader><CardTitle>Remédiations créées</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {remediations.length === 0 && (
            <p className="text-sm text-muted-foreground" role="status">
              Aucune remédiation créée pour cette classe pour l&apos;instant.
            </p>
          )}
          <ul role="list" className="space-y-2">
            {remediations.map((r) => {
              const { objectifs, activites } = extractRemediationContent(r.content);
              return (
              <li key={r.id} className="rounded-lg border border-border bg-background-soft px-4 py-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <span>{r.curriculum_units?.title ?? "Remédiation générale"}</span>
                    <p className="text-xs text-muted-foreground">
                      {r.remediation_students?.length ?? 0} élève(s) · {new Date(r.created_at).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.origin === "ai_generated" && (
                      <Badge variant="ai" aria-label="Générée par l'IA">IA</Badge>
                    )}
                    <Badge variant="default">
                      {r.scope === "individual" ? "Individuelle" : r.scope === "class" ? "Classe entière" : "Petit groupe"}
                    </Badge>
                  </div>
                </div>
                {objectifs.length > 0 && (
                  <details className="mt-2 text-xs text-muted-foreground">
                    <summary className="cursor-pointer hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded">
                      Voir le contenu généré
                    </summary>
                    <p className="mt-1"><strong>Objectifs :</strong> {objectifs.join(" · ")}</p>
                    {activites.length > 0 && (
                      <p className="mt-1"><strong>Activités :</strong> {activites.join(" · ")}</p>
                    )}
                  </details>
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

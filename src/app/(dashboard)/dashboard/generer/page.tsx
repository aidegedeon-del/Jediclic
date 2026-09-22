import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/dashboard/context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles } from "lucide-react";
import { generateDraft } from "./actions";

const TYPE_LABELS: Record<string, string> = {
  cours: "Cours",
  devoir: "Devoir",
  exercice: "Exercice",
  interrogation: "Interrogation",
  controle: "Contrôle",
  composition: "Composition",
};

export default async function GenererPage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string; curriculumId?: string; curriculumUnitId?: string }>;
}) {
  const { classId, curriculumId, curriculumUnitId } = await searchParams;
  const supabase = await createClient();
  const { membership } = await requireCurrentOrg();
  const orgId = membership.organization_id;

  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, education_level_id")
    .eq("organization_id", orgId)
    .is("archived_at", null);

  const activeClass = classes?.find((c) => c.id === classId) ?? classes?.[0];

  let curricula: { id: string; version_label: string; subjects: { name: string } | null }[] = [];
  let units: { id: string; title: string }[] = [];
  let competencies: { id: string; title: string }[] = [];
  let activeCurriculumId = curriculumId;

  if (activeClass) {
    const { data: c } = await supabase
      .from("curricula")
      .select("id, version_label, subjects(name)")
      .eq("education_level_id", activeClass.education_level_id)
      .eq("is_active", true);
    curricula = c ?? [];
    if (!activeCurriculumId && curricula.length === 1) activeCurriculumId = curricula[0].id;

    if (activeCurriculumId) {
      const { data: u } = await supabase
        .from("curriculum_units")
        .select("id, title")
        .eq("curriculum_id", activeCurriculumId)
        .order("ordering");
      units = u ?? [];
    }

    if (curriculumUnitId) {
      const { data: comp } = await supabase.from("competencies").select("id, title").eq("curriculum_unit_id", curriculumUnitId);
      competencies = comp ?? [];
    }
  }

  const canGenerate = Boolean(activeClass && curriculumUnitId);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 font-voice text-2xl font-semibold text-foreground">
          {/* Icône décorative */}
          <Sparkles size={22} className="text-accent" aria-hidden="true" />
          Générer du contenu
          <Badge variant="ai" aria-label="Fonctionnalité assistée par intelligence artificielle">IA</Badge>
        </h1>
        <p className="text-sm text-muted-foreground">
          L&apos;assistant prépare un brouillon à partir de la classe et du chapitre choisis. Rien n&apos;est publié
          automatiquement : vous pourrez accepter, modifier, régénérer ou refuser.
        </p>
      </div>

      {/* Étape 1 : Classe */}
      <Card>
        <CardHeader><CardTitle>1. Classe</CardTitle></CardHeader>
        <CardContent>
          <nav aria-label="Sélection de la classe">
            <ul className="flex flex-wrap gap-2" role="list">
              {(classes ?? []).map((c) => {
                const isActive = activeClass?.id === c.id;
                return (
                  <li key={c.id}>
                    <a
                      href={`/dashboard/generer?classId=${c.id}`}
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
              {(!classes || classes.length === 0) && (
                <li>
                  <p className="text-sm text-muted-foreground">Créez d&apos;abord une classe.</p>
                </li>
              )}
            </ul>
          </nav>
        </CardContent>
      </Card>

      {/* Étape 2 : Matière */}
      {activeClass && (
        <Card>
          <CardHeader><CardTitle>2. Matière (programme)</CardTitle></CardHeader>
          <CardContent>
            <nav aria-label="Sélection de la matière">
              <ul className="flex flex-wrap gap-2" role="list">
                {curricula.map((c) => {
                  const isActive = activeCurriculumId === c.id;
                  return (
                    <li key={c.id}>
                      <a
                        href={`/dashboard/generer?classId=${activeClass.id}&curriculumId=${c.id}`}
                        aria-current={isActive ? "page" : undefined}
                        className={`inline-flex rounded-full border px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 ${
                          isActive ? "border-primary bg-primary text-primary-foreground" : "border-border-strong hover:bg-muted"
                        }`}
                      >
                        {c.subjects?.name ?? "Matière"} · {c.version_label}
                      </a>
                    </li>
                  );
                })}
                {curricula.length === 0 && (
                  <li>
                    <p className="text-sm text-muted-foreground">Aucun programme chargé pour ce niveau pour l&apos;instant.</p>
                  </li>
                )}
              </ul>
            </nav>
          </CardContent>
        </Card>
      )}

      {/* Étape 3 : Chapitre */}
      {activeClass && activeCurriculumId && (
        <Card>
          <CardHeader><CardTitle>3. Chapitre</CardTitle></CardHeader>
          <CardContent>
            <nav aria-label="Sélection du chapitre">
              <ul className="flex flex-wrap gap-2" role="list">
                {units.map((u) => {
                  const isActive = curriculumUnitId === u.id;
                  return (
                    <li key={u.id}>
                      <a
                        href={`/dashboard/generer?classId=${activeClass.id}&curriculumId=${activeCurriculumId}&curriculumUnitId=${u.id}`}
                        aria-current={isActive ? "page" : undefined}
                        className={`inline-flex rounded-full border px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 ${
                          isActive ? "border-primary bg-primary text-primary-foreground" : "border-border-strong hover:bg-muted"
                        }`}
                      >
                        {u.title}
                      </a>
                    </li>
                  );
                })}
                {units.length === 0 && (
                  <li>
                    <p className="text-sm text-muted-foreground">Aucun chapitre pour ce programme pour l&apos;instant.</p>
                  </li>
                )}
              </ul>
            </nav>
          </CardContent>
        </Card>
      )}

      {/* Étape 4 : Type et génération */}
      {canGenerate && (
        <Card>
          <CardHeader>
            <CardTitle>4. Type de contenu et génération</CardTitle>
            <CardDescription>Précisez vos attentes, l&apos;assistant s&apos;y adaptera.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              action={generateDraft}
              className="space-y-4"
              aria-label="Formulaire de génération de contenu pédagogique"
            >
              <input type="hidden" name="classId" value={activeClass!.id} />
              <input type="hidden" name="curriculumUnitId" value={curriculumUnitId} />

              {competencies.length > 0 && (
                <div className="flex flex-col gap-1">
                  <Label htmlFor="competencyId" className="text-xs text-muted-foreground">
                    Compétence visée (facultatif)
                  </Label>
                  <Select id="competencyId" name="competencyId" defaultValue="">
                    <option value="">— Chapitre entier —</option>
                    {competencies.map((c) => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </Select>
                </div>
              )}

              <div className="flex flex-col gap-1">
                <Label htmlFor="content-type" className="text-xs text-muted-foreground">
                  Type de contenu
                </Label>
                <Select id="content-type" name="type" defaultValue="cours">
                  {Object.entries(TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </Select>
              </div>

              <div className="flex flex-col gap-1">
                <Label htmlFor="extra-instructions" className="text-xs text-muted-foreground">
                  Consigne complémentaire (facultatif)
                </Label>
                <Textarea
                  id="extra-instructions"
                  name="extraInstructions"
                  className="min-h-20"
                  placeholder="Ex. : insister sur les exercices d'application, durée 45 min, niveau facile..."
                />
              </div>

              <Button type="submit">Générer le brouillon</Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

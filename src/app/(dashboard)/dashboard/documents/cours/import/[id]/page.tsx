import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/dashboard/context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { AlertTriangle } from "lucide-react";
import { findBestMatch } from "@/lib/import/match";
import type { ExtractedLessonSheet } from "@/lib/import/lesson-sheet-ocr";
import { validateLessonSheetImport, rejectLessonSheetImport } from "./actions";

// Même logique de sélection en cascade classe -> programme -> chapitre que
// la page /dashboard/generer (navigation par lien + query params), pour
// rester cohérent avec un pattern déjà éprouvé dans l'app plutôt que d'en
// inventer un nouveau. La classe/le programme sont présélectionnés à partir
// du texte lu par l'IA (findBestMatch), mais restent modifiables — jamais
// une correspondance automatique silencieuse (Convention §7).
export default async function ReviewLessonSheetPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ classId?: string; curriculumId?: string }>;
}) {
  const { id } = await params;
  const { classId: classIdParam, curriculumId: curriculumIdParam } = await searchParams;
  const supabase = await createClient();
  const { membership } = await requireCurrentOrg();
  const orgId = membership.organization_id;

  const { data: document } = await supabase
    .from("documents")
    .select("id, status, extracted_data, created_at")
    .eq("id", id)
    .eq("organization_id", orgId)
    .single();

  if (!document) return <p className="text-sm text-muted-foreground">Cet import n&apos;existe pas ou plus.</p>;

  if (document.status !== "pending_review") {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <p className="text-sm text-muted-foreground">
          Cet import a déjà été traité (statut : {document.status === "validated" ? "validé" : "rejeté"}).
        </p>
      </div>
    );
  }

  const extracted = document.extracted_data as ExtractedLessonSheet;

  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, education_level_id")
    .eq("organization_id", orgId)
    .is("archived_at", null)
    .order("name");

  const suggestedClassId = classIdParam || findBestMatch(extracted.classNameRaw, classes ?? []) || classes?.[0]?.id || "";
  const activeClass = (classes ?? []).find((c) => c.id === suggestedClassId);

  let curricula: { id: string; version_label: string; subjects: { id: string; name: string } | null }[] = [];
  let units: { id: string; title: string }[] = [];
  let activeCurriculumId = curriculumIdParam;

  if (activeClass) {
    const { data: c } = await supabase
      .from("curricula")
      .select("id, version_label, subjects(id, name)")
      .eq("education_level_id", activeClass.education_level_id)
      .eq("is_active", true);
    curricula = c ?? [];
    if (!activeCurriculumId) {
      activeCurriculumId =
        findBestMatch(extracted.subjectNameRaw, curricula.map((c) => ({ id: c.id, name: c.subjects?.name ?? "" }))) ||
        (curricula.length === 1 ? curricula[0].id : undefined);
    }

    if (activeCurriculumId) {
      const { data: u } = await supabase.from("curriculum_units").select("id, title").eq("curriculum_id", activeCurriculumId).order("ordering");
      units = u ?? [];
    }
  }

  const suggestedUnitId = activeCurriculumId
    ? findBestMatch(extracted.chapterNameRaw, units.map((u) => ({ id: u.id, name: u.title })))
    : null;

  const validateWithId = validateLessonSheetImport.bind(null, document.id);
  const rejectWithId = rejectLessonSheetImport.bind(null, document.id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-voice text-2xl font-semibold text-foreground">Vérifier la fiche pédagogique</h1>
        <p className="text-sm text-muted-foreground">
          Contenu transcrit à partir de votre photo ou de votre PDF. Corrigez ce qu&apos;il faut avant l&apos;ajout à
          votre bibliothèque de cours.
        </p>
        <p className="mt-2 flex items-start gap-1.5 text-sm text-warning">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          Relisez tout le texte, surtout s&apos;il provient d&apos;une écriture manuscrite.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>1. Classe</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {(classes ?? []).map((c) => (
            <a
              key={c.id}
              href={`/dashboard/documents/cours/import/${id}?classId=${c.id}`}
              className={`rounded-full border px-3 py-1 text-sm transition-colors ${activeClass?.id === c.id ? "border-primary bg-primary text-primary-foreground" : "border-border-strong hover:bg-muted"}`}
            >
              {c.name}
            </a>
          ))}
          {(!classes || classes.length === 0) && <p className="text-sm text-muted-foreground">Créez d&apos;abord une classe.</p>}
          {extracted.classNameRaw && <p className="w-full text-xs text-muted-foreground">Lu sur le document : « {extracted.classNameRaw} »</p>}
        </CardContent>
      </Card>

      {activeClass && (
        <Card>
          <CardHeader><CardTitle>2. Matière (programme)</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {curricula.map((c) => (
              <a
                key={c.id}
                href={`/dashboard/documents/cours/import/${id}?classId=${activeClass.id}&curriculumId=${c.id}`}
                className={`rounded-full border px-3 py-1 text-sm transition-colors ${activeCurriculumId === c.id ? "border-primary bg-primary text-primary-foreground" : "border-border-strong hover:bg-muted"}`}
              >
                {c.subjects?.name ?? "Matière"} · {c.version_label}
              </a>
            ))}
            {curricula.length === 0 && <p className="text-sm text-muted-foreground">Aucun programme chargé pour ce niveau pour l&apos;instant.</p>}
            {extracted.subjectNameRaw && <p className="w-full text-xs text-muted-foreground">Lu sur le document : « {extracted.subjectNameRaw} »</p>}
          </CardContent>
        </Card>
      )}

      <form action={validateWithId} className="space-y-4">
        <input type="hidden" name="classId" value={activeClass?.id ?? ""} />

        <Card>
          <CardHeader><CardTitle>3. Chapitre (facultatif)</CardTitle></CardHeader>
          <CardContent>
            <Select name="curriculumUnitId" defaultValue={suggestedUnitId ?? ""}>
              <option value="">— Aucun chapitre précis —</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>{u.title}</option>
              ))}
            </Select>
            {extracted.chapterNameRaw && <p className="mt-1 text-xs text-muted-foreground">Lu sur le document : « {extracted.chapterNameRaw} »</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>4. Contenu de la fiche</CardTitle>
            <CardDescription>Complétez ou corrigez librement — c&apos;est votre fiche, telle que vous la voulez.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="title">Titre</Label>
              <Input id="title" name="title" defaultValue={extracted.titleGuess ?? ""} placeholder="Ex. : Séance — Les fractions" required />
            </div>
            <div>
              <Label htmlFor="lessonDate">Date (facultatif)</Label>
              <Input id="lessonDate" name="lessonDate" type="date" defaultValue={extracted.dateGuess ?? ""} />
            </div>
            <div>
              <Label htmlFor="objectifs">Objectifs</Label>
              <Textarea
                id="objectifs"
                name="objectifs"
                defaultValue={extracted.objectifs ?? ""}
                className="min-h-24"
                placeholder="Objectifs pédagogiques de la séance"
              />
            </div>
            <div>
              <Label htmlFor="contenu">Contenu (déroulé, activités, exemples...)</Label>
              <Textarea
                id="contenu"
                name="contenu"
                defaultValue={extracted.contenu ?? ""}
                className="min-h-40"
                placeholder="Contenu transcrit de la fiche"
              />
            </div>
            {!extracted.contenu && !extracted.objectifs && (
              <Badge variant="warning">Peu de contenu lu — vérifiez le document original</Badge>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={!activeClass}>Ajouter à ma bibliothèque de cours</Button>
        </div>
      </form>

      <form action={rejectWithId}>
        <Button type="submit" variant="ghost">Rejeter cet import</Button>
      </form>
    </div>
  );
}

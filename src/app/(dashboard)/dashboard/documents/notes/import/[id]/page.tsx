import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/dashboard/context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { AlertTriangle } from "lucide-react";
import { findBestMatch } from "@/lib/import/match";
import type { ExtractedGradeRow } from "@/lib/import/grade-sheet-ocr";
import { validateGradeSheetImport, rejectGradeSheetImport } from "./actions";

export default async function ReviewGradeSheetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  const extracted = document.extracted_data as {
    classId: string;
    titleGuess: string | null;
    dateGuess: string | null;
    maxScoreGuess: number | null;
    rows: ExtractedGradeRow[];
    skippedRows: number;
  };
  const rows = extracted.rows ?? [];

  const [{ data: classes }, { data: students }] = await Promise.all([
    supabase.from("classes").select("id, name").eq("organization_id", orgId).is("archived_at", null).order("name"),
    supabase.from("students").select("id, full_name").eq("class_id", extracted.classId).is("archived_at", null),
  ]);

  // findBestMatch attend { id, name } : les élèves ont full_name, on adapte.
  const studentOptions = (students ?? []).map((s) => ({ id: s.id, name: s.full_name }));

  const validateWithId = validateGradeSheetImport.bind(null, document.id);
  const rejectWithId = rejectGradeSheetImport.bind(null, document.id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-voice text-2xl font-semibold text-foreground">Vérifier la feuille de notes</h1>
        <p className="text-sm text-muted-foreground">
          {rows.length} note(s) détectée(s)
          {extracted.skippedRows > 0 && ` · ${extracted.skippedRows} ligne(s) ignorée(s) (aucun nom trouvé)`}
          . Rien n&apos;est enregistré sans votre validation.
        </p>
        <p className="mt-2 flex items-start gap-1.5 text-sm text-warning">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          Vérifiez chaque nom, note et barème avant de valider.
        </p>
      </div>

      <form action={validateWithId} className="space-y-4">
        <input type="hidden" name="rowCount" value={rows.length} />

        <Card>
          <CardHeader><CardTitle>Évaluation</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="classId">Classe</Label>
              <Select id="classId" name="classId" defaultValue={extracted.classId}>
                {(classes ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="title">Titre</Label>
              <Input id="title" name="title" defaultValue={extracted.titleGuess ?? ""} placeholder="Ex. : Interrogation — Fonctions" required />
            </div>
            <div>
              <Label htmlFor="assessmentDate">Date</Label>
              <Input id="assessmentDate" name="assessmentDate" type="date" defaultValue={extracted.dateGuess ?? ""} required />
            </div>
            <div>
              <Label htmlFor="maxScore">Barème</Label>
              <Input id="maxScore" name="maxScore" type="number" step="0.5" defaultValue={extracted.maxScoreGuess ?? 20} required />
            </div>
            {!extracted.titleGuess && (
              <p className="text-xs text-warning sm:col-span-2">Aucun titre lu sur le document — complétez-le.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {rows.map((row, i) => {
              const suggestedStudentId = findBestMatch(row.studentNameRaw, studentOptions);
              return (
                <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-border-strong px-3 py-2 text-sm">
                  <input type="checkbox" name={`include_${i}`} defaultChecked className="accent-primary" />
                  <span className="w-40 shrink-0 text-xs text-muted-foreground">Lu : {row.studentNameRaw}</span>
                  <Select name={`studentId_${i}`} defaultValue={suggestedStudentId ?? ""} className="h-9 flex-1">
                    <option value="" disabled>— Choisir l&apos;élève —</option>
                    {studentOptions.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </Select>
                  <label className="flex items-center gap-1 text-xs text-muted-foreground">
                    <input type="checkbox" name={`absent_${i}`} defaultChecked={row.isAbsent} className="accent-primary" /> Absent
                  </label>
                  <Input name={`score_${i}`} type="number" step="0.25" defaultValue={row.score ?? ""} className="w-24 font-data" placeholder="Note" />
                  {!suggestedStudentId && <Badge variant="warning">À choisir</Badge>}
                </div>
              );
            })}
            {rows.length === 0 && <p className="text-sm text-muted-foreground">Aucune note à afficher.</p>}
          </CardContent>
        </Card>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={rows.length === 0}>Créer l&apos;évaluation avec les notes cochées</Button>
        </div>
        <p className="text-xs text-muted-foreground">L&apos;évaluation créée reste en brouillon — vous la publierez depuis la page Évaluations quand vous serez prêt.</p>
      </form>

      <form action={rejectWithId}>
        <Button type="submit" variant="ghost">Rejeter cet import</Button>
      </form>
    </div>
  );
}

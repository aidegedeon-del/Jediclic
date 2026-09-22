import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/dashboard/context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Camera, FileUp, FileSpreadsheet, AlertTriangle } from "lucide-react";
import { uploadGradeSheet } from "./actions";

export default async function ImportGradeSheetPage() {
  const supabase = await createClient();
  const { membership } = await requireCurrentOrg();

  const [{ data: classes }, { data: pendingImports }] = await Promise.all([
    supabase.from("classes").select("id, name").eq("organization_id", membership.organization_id).is("archived_at", null).order("name"),
    supabase
      .from("documents")
      .select("id, created_at, extracted_data")
      .eq("organization_id", membership.organization_id)
      .eq("kind", "grade_sheet")
      .eq("status", "pending_review")
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 font-voice text-2xl font-semibold text-foreground">
          <FileSpreadsheet size={22} className="text-primary" />
          Importer une feuille de notes
        </h1>
        <p className="text-sm text-muted-foreground">
          Photo ou PDF d&apos;une feuille papier. L&apos;assistant propose un brouillon d&apos;évaluation et associe chaque
          ligne à un élève — vous vérifiez et corrigez avant tout enregistrement.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nouveau document</CardTitle>
          <CardDescription>Choisissez d&apos;abord la classe concernée.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={uploadGradeSheet} className="space-y-4">
            <div>
              <Label htmlFor="classId">Classe concernée</Label>
              <Select id="classId" name="classId" required defaultValue="">
                <option value="" disabled>— Choisir une classe —</option>
                {(classes ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
              {(!classes || classes.length === 0) && (
                <p className="mt-1 text-xs text-muted-foreground">Créez d&apos;abord une classe avant d&apos;importer une feuille de notes.</p>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="filePhoto" className="flex items-center gap-1.5">
                  <Camera size={14} /> Prendre une photo
                </Label>
                <Input id="filePhoto" name="filePhoto" type="file" accept="image/*" capture="environment" />
                <p className="mt-1 text-xs text-muted-foreground">Ouvre l&apos;appareil photo sur mobile. Bien à plat, bien éclairé.</p>
              </div>
              <div>
                <Label htmlFor="fileDoc" className="flex items-center gap-1.5">
                  <FileUp size={14} /> Importer une image ou un PDF
                </Label>
                <Input id="fileDoc" name="fileDoc" type="file" accept="image/*,.pdf" />
              </div>
            </div>
            <p className="flex items-start gap-1.5 text-xs text-warning">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              Lecture automatique : notes, noms et barème sont des propositions à relire ligne par ligne avant validation.
            </p>

            <Button type="submit" disabled={!classes || classes.length === 0}>Analyser le document</Button>
          </form>
        </CardContent>
      </Card>

      {pendingImports && pendingImports.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>En attente de votre relecture</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingImports.map((doc) => {
              // Cast local ciblé : ces documents "grade_sheet" stockent un
              // objet `{ rows: [...] }` dans le JSONB `extracted_data`
              // (cf. notes/import/actions.ts).
              const extracted = doc.extracted_data as { rows?: unknown[] } | null;
              return (
              <Link
                key={doc.id}
                href={`/dashboard/documents/notes/import/${doc.id}`}
                className="flex items-center justify-between rounded-lg border border-border-strong bg-background-soft px-4 py-2.5 text-sm transition-colors hover:bg-muted"
              >
                <span>{extracted?.rows?.length ?? 0} note(s) détectée(s)</span>
                <Badge variant="warning">À vérifier</Badge>
              </Link>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

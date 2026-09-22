import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/dashboard/context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Camera, FileUp, FileSpreadsheet, AlertTriangle, Archive } from "lucide-react";
import { uploadStudentList } from "./actions";
import { importFromArchivedClass } from "./from-archive-actions";

export default async function ImportStudentsPage() {
  const supabase = await createClient();
  const { membership } = await requireCurrentOrg();

  const [{ data: classes }, { data: pendingImports }, { data: archivedClasses }] = await Promise.all([
    supabase
      .from("classes")
      .select("id, name, school_years!inner(is_current)")
      .eq("organization_id", membership.organization_id)
      .eq("school_years.is_current", true)
      .is("archived_at", null)
      .order("name"),
    supabase
      .from("documents")
      .select("id, created_at, extracted_data")
      .eq("organization_id", membership.organization_id)
      .eq("kind", "student_list")
      .eq("status", "pending_review")
      .order("created_at", { ascending: false }),
    supabase
      .from("classes")
      .select("id, name, students(count), school_years!inner(label, is_current)")
      .eq("organization_id", membership.organization_id)
      .eq("school_years.is_current", false)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 font-voice text-2xl font-semibold text-foreground">
          <FileSpreadsheet size={22} className="text-primary" />
          Importer une liste d&apos;élèves
        </h1>
        <p className="text-sm text-muted-foreground">
          Fichier CSV/Excel, photo de la liste de classe, ou PDF — au choix. Vous vérifierez et corrigerez chaque
          ligne avant qu&apos;elle ne rejoigne définitivement votre classe.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nouveau fichier</CardTitle>
          <CardDescription>Le CSV/Excel reste la méthode la plus fiable si vous en avez déjà un.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={uploadStudentList} className="space-y-4">
            <div>
              <Label htmlFor="classId">Classe de destination</Label>
              <Select id="classId" name="classId" required defaultValue="">
                <option value="" disabled>— Choisir une classe —</option>
                {(classes ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
              {(!classes || classes.length === 0) && (
                <p className="mt-1 text-xs text-muted-foreground">Créez d&apos;abord une classe avant d&apos;importer des élèves.</p>
              )}
            </div>

            <div>
              <Label htmlFor="file">Fichier CSV ou Excel</Label>
              <Input id="file" name="file" type="file" accept=".csv,.xlsx,.xls" />
              <p className="mt-1 text-xs text-muted-foreground">Lecture exacte des colonnes — la méthode la plus fiable si vous avez déjà un fichier.</p>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" /> ou <div className="h-px flex-1 bg-border" />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="filePhoto" className="flex items-center gap-1.5">
                  <Camera size={14} /> Prendre une photo de la liste
                </Label>
                <Input id="filePhoto" name="filePhoto" type="file" accept="image/*" capture="environment" />
                <p className="mt-1 text-xs text-muted-foreground">Ouvre l&apos;appareil photo sur mobile. Cadrez bien, à plat, avec un bon éclairage.</p>
              </div>
              <div>
                <Label htmlFor="fileDoc" className="flex items-center gap-1.5">
                  <FileUp size={14} /> Importer une image ou un PDF
                </Label>
                <Input id="fileDoc" name="fileDoc" type="file" accept="image/*,.pdf" />
                <p className="mt-1 text-xs text-muted-foreground">Une photo déjà prise, ou un PDF (liste imprimée, cahier de classe scanné).</p>
              </div>
            </div>
            <p className="flex items-start gap-1.5 text-xs text-warning">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              Lecture automatique pour la photo/PDF : moins fiable qu&apos;un fichier CSV/Excel, surtout sur écriture manuscrite. Relisez bien chaque nom avant de valider.
            </p>

            <Button type="submit" disabled={!classes || classes.length === 0}>Analyser le document</Button>
          </form>
        </CardContent>
      </Card>

      {archivedClasses && archivedClasses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Archive size={17} className="text-primary" /> Importer depuis une classe archivée</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              Reprend les noms d&apos;une classe d&apos;une année précédente et les relie automatiquement à leur fiche
              élève permanente, pour garder l&apos;historique sur plusieurs années. Comme pour tout import, rien n&apos;est
              intégré tant que vous n&apos;avez pas relu et validé la liste.
            </p>
            <form action={importFromArchivedClass} className="grid gap-4 sm:grid-cols-3 sm:items-end">
              <div>
                <Label htmlFor="sourceClassId">Classe archivée source</Label>
                <Select id="sourceClassId" name="sourceClassId" required defaultValue="">
                  <option value="" disabled>— Choisir —</option>
                  {archivedClasses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {c.school_years?.label} ({c.students?.[0]?.count ?? 0} élève(s))
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="classId2">Classe de destination</Label>
                <Select id="classId2" name="classId" required defaultValue="">
                  <option value="" disabled>— Choisir une classe —</option>
                  {(classes ?? []).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
              </div>
              <Button type="submit" variant="secondary" disabled={!classes || classes.length === 0}>Charger la liste</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {pendingImports && pendingImports.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>En attente de votre relecture</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingImports.map((doc) => {
              // Cast local ciblé : ces documents "student_list" stockent un
              // objet `{ rows: [...] }` dans le JSONB `extracted_data`
              // (cf. eleves/import/actions.ts et from-archive-actions.ts).
              const extracted = doc.extracted_data as { rows?: unknown[] } | null;
              return (
                <Link
                  key={doc.id}
                  href={`/dashboard/eleves/import/${doc.id}`}
                  className="flex items-center justify-between rounded-lg border border-border-strong bg-background-soft px-4 py-2.5 text-sm transition-colors hover:bg-muted"
                >
                  <span>{extracted?.rows?.length ?? 0} ligne(s) détectée(s)</span>
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

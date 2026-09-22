import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/dashboard/context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { AlertTriangle, History } from "lucide-react";
import { validateImport, rejectImport } from "./actions";

export default async function ReviewImportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { membership } = await requireCurrentOrg();

  const { data: document } = await supabase
    .from("documents")
    .select("id, status, extracted_data, created_at")
    .eq("id", id)
    .eq("organization_id", membership.organization_id)
    .single();

  if (!document) return <p className="text-sm text-muted-foreground">Cet import n&apos;existe pas ou plus.</p>;

  if (document.status !== "pending_review") {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <p className="text-sm text-muted-foreground">
          Cet import a déjà été traité (statut : {document.status === "validated" ? "validé" : "rejeté"}).
        </p>
      </div>
    );
  }

  const extracted = document.extracted_data as {
    classId: string;
    rows: { fullName: string; studentNumber: string | null; studentProfileId?: string }[];
    skippedRows: number;
    columnsDetected: boolean;
    source?: "file" | "ocr" | "archive";
    sourceClassId?: string;
  };
  const rows = extracted.rows ?? [];
  const isOcr = extracted.source === "ocr";
  const isFromArchive = extracted.source === "archive";

  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, school_years!inner(is_current)")
    .eq("organization_id", membership.organization_id)
    .eq("school_years.is_current", true)
    .is("archived_at", null)
    .order("name");

  const { data: existingStudents } = await supabase
    .from("students")
    .select("full_name")
    .eq("class_id", extracted.classId)
    .is("archived_at", null);

  const existingNames = new Set((existingStudents ?? []).map((s) => s.full_name.trim().toLowerCase()));

  const validateWithId = validateImport.bind(null, document.id);
  const rejectWithId = rejectImport.bind(null, document.id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-voice text-2xl font-semibold text-foreground">Vérifier la liste</h1>
        <p className="text-sm text-muted-foreground">
          {rows.length} ligne(s) détectée(s)
          {extracted.skippedRows > 0 && ` · ${extracted.skippedRows} ligne(s) ignorée(s) (aucun nom trouvé)`}
          . Corrigez si besoin avant l&apos;ajout à la classe.
        </p>
        {!extracted.columnsDetected && (
          <p className="mt-1 flex items-start gap-1.5 text-sm text-warning">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            Colonne « nom » non identifiée avec certitude : la première colonne du fichier a été utilisée. Vérifiez chaque ligne.
          </p>
        )}
        {isOcr && (
          <p className="mt-1 flex items-start gap-1.5 text-sm text-warning">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            Lecture automatique à partir d&apos;une photo/PDF : des erreurs sont possibles, surtout sur écriture manuscrite. Relisez et corrigez chaque nom avant de valider.
          </p>
        )}
        {isFromArchive && (
          <p className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground">
            <History size={15} className="mt-0.5 shrink-0" />
            Liste chargée depuis une classe archivée — chaque élève reste relié à sa fiche permanente.
          </p>
        )}
      </div>

      <form action={validateWithId} className="space-y-4">
        <input type="hidden" name="rowCount" value={rows.length} />

        <Card>
          <CardHeader><CardTitle>Classe de destination</CardTitle></CardHeader>
          <CardContent>
            <Select name="classId" defaultValue={extracted.classId}>
              {(classes ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Élèves</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {rows.map((row, i) => {
              const isDuplicate = existingNames.has(row.fullName.trim().toLowerCase());
              return (
                <div key={i} className="flex items-center gap-3 rounded-lg border border-border-strong px-4 py-2 text-sm">
                  <input type="checkbox" name={`include_${i}`} defaultChecked className="mt-0.5 accent-primary" />
                  <Input name={`fullName_${i}`} defaultValue={row.fullName} className="flex-1" />
                  <Input name={`studentNumber_${i}`} defaultValue={row.studentNumber ?? ""} placeholder="Matricule" className="w-32" />
                  {row.studentProfileId && <input type="hidden" name={`studentProfileId_${i}`} value={row.studentProfileId} />}
                  {isDuplicate && <Badge variant="warning">Déjà présent dans la classe</Badge>}
                  {row.studentProfileId && <Badge variant="success">Historique lié</Badge>}
                </div>
              );
            })}
            {rows.length === 0 && <p className="text-sm text-muted-foreground">Aucune ligne à afficher.</p>}
          </CardContent>
        </Card>

        <div className="flex items-center gap-3">
          <Button type="submit">Ajouter les élèves cochés à la classe</Button>
        </div>
      </form>

      <form action={rejectWithId}>
        <Button type="submit" variant="ghost">Rejeter cet import</Button>
      </form>
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/dashboard/context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { AlertTriangle } from "lucide-react";
import { findBestMatch } from "@/lib/import/match";
import type { ExtractedScheduleRow } from "@/lib/import/schedule-ocr";
import { validateScheduleImport, rejectScheduleImport } from "./actions";

const WEEKDAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

export default async function ReviewScheduleImportPage({ params }: { params: Promise<{ id: string }> }) {
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

  const extracted = document.extracted_data as { rows: ExtractedScheduleRow[]; skippedRows: number };
  const rows = extracted.rows ?? [];

  const [{ data: classes }, { data: subjects }] = await Promise.all([
    supabase.from("classes").select("id, name").eq("organization_id", orgId).is("archived_at", null).order("name"),
    supabase.from("subjects").select("id, name").order("name"),
  ]);

  const validateWithId = validateScheduleImport.bind(null, document.id);
  const rejectWithId = rejectScheduleImport.bind(null, document.id);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-voice text-2xl font-semibold text-foreground">Vérifier l&apos;emploi du temps</h1>
        <p className="text-sm text-muted-foreground">
          {rows.length} créneau(x) détecté(s)
          {extracted.skippedRows > 0 && ` · ${extracted.skippedRows} zone(s) ignorée(s) (case vide)`}
          . La classe, la matière et le jour sont des suggestions à confirmer — rien n&apos;est ajouté sans votre validation.
        </p>
        <p className="mt-2 flex items-start gap-1.5 text-sm text-warning">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          Vérifiez chaque créneau, surtout les horaires et les cases non identifiées.
        </p>
      </div>

      <form action={validateWithId} className="space-y-4">
        <input type="hidden" name="rowCount" value={rows.length} />

        <Card>
          <CardHeader><CardTitle>Créneaux</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {rows.length === 0 && <p className="text-sm text-muted-foreground">Aucun créneau à afficher.</p>}
            {rows.map((row, i) => {
              const suggestedClassId = findBestMatch(row.classNameRaw, classes ?? []);
              const suggestedSubjectId = findBestMatch(row.subjectNameRaw, subjects ?? []);
              return (
                <div key={i} className="rounded-lg border border-border-strong p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <input type="checkbox" name={`include_${i}`} defaultChecked className="accent-primary" />
                    <span className="text-xs text-muted-foreground">
                      Lu sur le document : {row.classNameRaw || "—"} · {row.subjectNameRaw || "—"}
                    </span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-5">
                    <div>
                      <Label htmlFor={`weekday_${i}`}>Jour</Label>
                      <Select id={`weekday_${i}`} name={`weekday_${i}`} defaultValue={row.weekday ?? ""}>
                        <option value="" disabled>— Choisir —</option>
                        {WEEKDAYS.map((d, idx) => (
                          <option key={d} value={idx}>{d}</option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor={`classId_${i}`}>Classe</Label>
                      <Select id={`classId_${i}`} name={`classId_${i}`} defaultValue={suggestedClassId ?? ""}>
                        <option value="" disabled>— Choisir —</option>
                        {(classes ?? []).map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor={`subjectId_${i}`}>Matière</Label>
                      <Select id={`subjectId_${i}`} name={`subjectId_${i}`} defaultValue={suggestedSubjectId ?? ""}>
                        <option value="" disabled>— Choisir —</option>
                        {(subjects ?? []).map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor={`startTime_${i}`}>Début</Label>
                      <Input id={`startTime_${i}`} name={`startTime_${i}`} type="time" defaultValue={row.startTime ?? ""} />
                    </div>
                    <div>
                      <Label htmlFor={`endTime_${i}`}>Fin</Label>
                      <Input id={`endTime_${i}`} name={`endTime_${i}`} type="time" defaultValue={row.endTime ?? ""} />
                    </div>
                  </div>
                  <div className="mt-2">
                    <Label htmlFor={`room_${i}`}>Salle (facultatif)</Label>
                    <Input id={`room_${i}`} name={`room_${i}`} defaultValue={row.room ?? ""} className="sm:w-40" />
                  </div>
                  {(!suggestedClassId || !suggestedSubjectId || row.weekday === null || !row.startTime || !row.endTime) && (
                    <Badge variant="warning" className="mt-2">À compléter</Badge>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={rows.length === 0}>Ajouter les créneaux cochés</Button>
        </div>
      </form>

      <form action={rejectWithId}>
        <Button type="submit" variant="ghost">Rejeter cet import</Button>
      </form>
    </div>
  );
}

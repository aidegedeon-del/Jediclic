import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/dashboard/context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Camera, FileUp, CalendarDays, AlertTriangle } from "lucide-react";
import { uploadSchedulePhoto } from "./actions";

export default async function ImportSchedulePage() {
  const supabase = await createClient();
  const { membership } = await requireCurrentOrg();

  const { data: pendingImports } = await supabase
    .from("documents")
    .select("id, created_at, extracted_data")
    .eq("organization_id", membership.organization_id)
    .eq("kind", "schedule_photo")
    .eq("status", "pending_review")
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 font-voice text-2xl font-semibold text-foreground">
          <CalendarDays size={22} className="text-primary" />
          Importer l&apos;emploi du temps par photo
        </h1>
        <p className="text-sm text-muted-foreground">
          Photographiez ou scannez votre grille horaire. Vous vérifierez et corrigerez chaque créneau — jour, classe,
          matière, horaires — avant qu&apos;il ne rejoigne votre emploi du temps.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nouveau document</CardTitle>
          <CardDescription>Une seule grille à la fois, cadrée en entier.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={uploadSchedulePhoto} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="filePhoto" className="flex items-center gap-1.5">
                  <Camera size={14} /> Prendre une photo
                </Label>
                <Input id="filePhoto" name="filePhoto" type="file" accept="image/*" capture="environment" />
                <p className="mt-1 text-xs text-muted-foreground">Ouvre l&apos;appareil photo sur mobile. Cadrez toute la grille, à plat, bien éclairée.</p>
              </div>
              <div>
                <Label htmlFor="fileDoc" className="flex items-center gap-1.5">
                  <FileUp size={14} /> Importer une image ou un PDF
                </Label>
                <Input id="fileDoc" name="fileDoc" type="file" accept="image/*,.pdf" />
                <p className="mt-1 text-xs text-muted-foreground">Une photo déjà prise, ou un PDF (emploi du temps imprimé/scanné).</p>
              </div>
            </div>
            <p className="flex items-start gap-1.5 text-xs text-warning">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              Lecture automatique : la classe, la matière et les horaires détectés doivent être vérifiés créneau par créneau avant intégration.
            </p>
            <Button type="submit">Analyser le document</Button>
          </form>
        </CardContent>
      </Card>

      {pendingImports && pendingImports.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>En attente de votre relecture</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingImports.map((doc) => (
              <Link
                key={doc.id}
                href={`/dashboard/emploi-du-temps/import/${doc.id}`}
                className="flex items-center justify-between rounded-lg border border-border-strong bg-background-soft px-4 py-2.5 text-sm transition-colors hover:bg-muted"
              >
                <span>
                  {(() => {
                    // `extracted_data` est une colonne JSONB (`Json | null`,
                    // structure libre par construction) : on lit `rows` de
                    // façon défensive, sans jamais désactiver le typage du
                    // reste du fichier avec `any`.
                    const data = doc.extracted_data;
                    const rows =
                      data && typeof data === "object" && !Array.isArray(data) && Array.isArray((data as Record<string, unknown>).rows)
                        ? ((data as Record<string, unknown>).rows as unknown[])
                        : [];
                    return rows.length;
                  })()}{" "}
                  créneau(x) détecté(s)
                </span>
                <Badge variant="warning">À vérifier</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

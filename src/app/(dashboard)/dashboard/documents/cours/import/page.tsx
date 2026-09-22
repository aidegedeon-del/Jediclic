import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/dashboard/context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Camera, FileUp, NotebookText, AlertTriangle } from "lucide-react";
import { uploadLessonSheet } from "./actions";

export default async function ImportLessonSheetPage() {
  const supabase = await createClient();
  const { membership } = await requireCurrentOrg();

  const { data: pendingImports } = await supabase
    .from("documents")
    .select("id, created_at, extracted_data")
    .eq("organization_id", membership.organization_id)
    .eq("kind", "lesson_sheet")
    .eq("status", "pending_review")
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 font-voice text-2xl font-semibold text-foreground">
          <NotebookText size={22} className="text-primary" />
          Importer une fiche pédagogique
        </h1>
        <p className="text-sm text-muted-foreground">
          Une photo ou un PDF de votre fiche papier suffit. L&apos;assistant en transcrit le contenu et vous propose une
          classe, une matière et un chapitre — vous confirmez avant tout ajout à votre bibliothèque.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nouveau document</CardTitle>
          <CardDescription>Une seule fiche à la fois, recto bien à plat et lisible.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={uploadLessonSheet} className="space-y-4">
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
              Lecture automatique : le texte transcrit peut contenir des approximations, surtout sur écriture manuscrite. Relisez-le avant de valider.
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
            {pendingImports.map((doc) => {
              // `extracted_data` est un JSONB (colonne `Json` générique côté
              // types Supabase) : on sait par construction (actions.ts) que ces
              // documents de type "lesson_sheet" y stockent un objet avec un
              // champ `titleGuess` optionnel — cast local ciblé, pas de `any`.
              const extracted = doc.extracted_data as { titleGuess?: string } | null;
              return (
                <Link
                  key={doc.id}
                  href={`/dashboard/documents/cours/import/${doc.id}`}
                  className="flex items-center justify-between rounded-lg border border-border-strong bg-background-soft px-4 py-2.5 text-sm transition-colors hover:bg-muted"
                >
                  <span>{extracted?.titleGuess || "Fiche sans titre"}</span>
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

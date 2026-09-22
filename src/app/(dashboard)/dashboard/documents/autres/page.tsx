import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FolderOpen } from "lucide-react";
import { uploadOtherDocument } from "./actions";

// PRD §20 : "documents administratifs" / "autres fichiers pédagogiques".
// Contrairement aux autres imports, il n'y a ici aucune donnée structurée à
// extraire ni à faire correspondre à une entité métier (élève, classe,
// évaluation...) — le document est simplement conservé et catalogué. Pas
// d'étape OCR/relecture : on demande directement un titre au moment du
// dépôt, et le document est immédiatement consultable dans la bibliothèque.
export default async function UploadOtherDocumentPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 font-voice text-2xl font-semibold text-foreground">
          <FolderOpen size={22} className="text-primary" />
          Ajouter un document administratif ou autre
        </h1>
        <p className="text-sm text-muted-foreground">
          Circulaire, note de service, tout fichier qui ne rentre dans aucune autre catégorie. Aucune lecture
          automatique ici — le fichier est simplement rangé dans votre bibliothèque.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nouveau document</CardTitle>
          <CardDescription>Un titre clair suffit à le retrouver facilement plus tard.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={uploadOtherDocument} className="space-y-4">
            <div>
              <Label htmlFor="title">Titre</Label>
              <Input id="title" name="title" placeholder="Ex. : Circulaire rentrée 2026" required />
            </div>
            <div>
              <Label htmlFor="kind">Type</Label>
              <Select id="kind" name="kind" defaultValue="admin_document">
                <option value="admin_document">Document administratif</option>
                <option value="other">Autre</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="description">Description (facultatif)</Label>
              <Textarea id="description" name="description" className="min-h-20" />
            </div>
            <div>
              <Label htmlFor="file">Fichier</Label>
              <Input id="file" name="file" type="file" required />
            </div>

            <Button type="submit">Ajouter à la bibliothèque</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

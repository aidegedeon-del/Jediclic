import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/dashboard/context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, ShieldAlert } from "lucide-react";

const KIND_LABELS: Record<string, string> = {
  schedule_photo: "Emploi du temps",
  student_list: "Liste d'élèves",
  grade_sheet: "Feuille de notes",
  lesson_sheet: "Fiche pédagogique",
  admin_document: "Document administratif",
  other: "Autre document",
};

// Vue générique de consultation, principalement pour les documents
// administratifs/autres (pas de flux de relecture dédié pour ceux-là) et
// comme filet de sécurité pour tout document déjà validé/rejeté. Le fichier
// original n'est jamais exposé via une URL publique permanente (Convention
// §46) : on génère une URL signée à durée limitée à chaque consultation.
export default async function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { membership } = await requireCurrentOrg();

  const { data: document } = await supabase
    .from("documents")
    .select("id, kind, status, storage_path, extracted_data, created_at, reviewed_at")
    .eq("id", id)
    .eq("organization_id", membership.organization_id)
    .single();

  if (!document) return <p className="text-sm text-muted-foreground">Ce document n&apos;existe pas ou plus.</p>;

  // `storage_path` est nullable en base (documents créés sans fichier associé,
  // ex. import manuel) : on ne tente une URL signée que si un chemin existe.
  const { data: signed } = document.storage_path
    ? await supabase.storage.from("documents").createSignedUrl(document.storage_path, 300)
    : { data: null };
  const meta = (document.extracted_data ?? {}) as { title?: string; description?: string };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-voice text-2xl font-semibold text-foreground">{meta.title || KIND_LABELS[document.kind] || document.kind}</h1>
          <p className="text-sm text-muted-foreground">{KIND_LABELS[document.kind] ?? document.kind} · {new Date(document.created_at).toLocaleDateString("fr-FR")}</p>
        </div>
        <Badge variant={document.status === "validated" ? "success" : document.status === "rejected" ? "danger" : "warning"}>
          {document.status === "validated" ? "Validé" : document.status === "rejected" ? "Rejeté" : "À vérifier"}
        </Badge>
      </div>

      <Card>
        <CardHeader><CardTitle>Fichier original</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {meta.description && <p className="text-sm text-muted-foreground">{meta.description}</p>}
          {signed?.signedUrl ? (
            <a href={signed.signedUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
              Ouvrir / télécharger le fichier <ExternalLink size={14} />
            </a>
          ) : (
            <p className="flex items-center gap-1.5 text-sm text-warning">
              <ShieldAlert size={15} /> Le lien de téléchargement n&apos;a pas pu être généré.
            </p>
          )}
          <p className="text-xs text-muted-foreground">Le document original n&apos;est jamais modifié après son dépôt.</p>
        </CardContent>
      </Card>
    </div>
  );
}

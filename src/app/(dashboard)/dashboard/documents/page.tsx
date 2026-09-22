import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/dashboard/context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Users, CalendarDays, FileSpreadsheet, NotebookText, FolderOpen } from "lucide-react";
import type { Json } from "@/lib/types/database.types";

const KIND_LABELS: Record<string, string> = {
  schedule_photo: "Emploi du temps",
  student_list: "Liste d'élèves",
  grade_sheet: "Feuille de notes",
  lesson_sheet: "Fiche pédagogique",
  admin_document: "Document administratif",
  other: "Autre document",
};

const STATUS_BADGE: Record<string, { label: string; variant: "warning" | "success" | "danger" }> = {
  pending_review: { label: "À vérifier", variant: "warning" },
  validated: { label: "Validé", variant: "success" },
  rejected: { label: "Rejeté", variant: "danger" },
};

// `extracted_data` est une colonne JSONB (`Json`, structure libre par
// construction) : on en extrait `title`/`rows` de façon défensive et
// typée, sans jamais recourir à `any`.
function extractDocSummary(data: Json): { title: string | null; rowsCount: number } {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { title: null, rowsCount: 0 };
  }
  const obj = data as Record<string, Json>;
  const title = typeof obj.title === "string" ? obj.title : null;
  const rowsCount = Array.isArray(obj.rows) ? obj.rows.length : 0;
  return { title, rowsCount };
}

function reviewHref(doc: { id: string; kind: string }): string {
  switch (doc.kind) {
    case "student_list":
      return `/dashboard/eleves/import/${doc.id}`;
    case "schedule_photo":
      return `/dashboard/emploi-du-temps/import/${doc.id}`;
    case "grade_sheet":
      return `/dashboard/documents/notes/import/${doc.id}`;
    case "lesson_sheet":
      return `/dashboard/documents/cours/import/${doc.id}`;
    default:
      return `/dashboard/documents/${doc.id}`;
  }
}

const IMPORT_LINKS = [
  { href: "/dashboard/eleves/import", icon: Users, title: "Liste d'élèves", description: "CSV, Excel, photo ou PDF" },
  { href: "/dashboard/emploi-du-temps/import", icon: CalendarDays, title: "Emploi du temps", description: "Photo ou PDF" },
  { href: "/dashboard/documents/notes/import", icon: FileSpreadsheet, title: "Feuille de notes", description: "Photo ou PDF d'une feuille papier" },
  { href: "/dashboard/documents/cours/import", icon: NotebookText, title: "Fiche pédagogique", description: "Photo ou PDF d'une fiche de cours" },
];

export default async function DocumentsLibraryPage() {
  const supabase = await createClient();
  const { membership } = await requireCurrentOrg();

  const { data: documents } = await supabase
    .from("documents")
    .select("id, kind, status, created_at, extracted_data")
    .eq("organization_id", membership.organization_id)
    .order("created_at", { ascending: false })
    .limit(100);

  const docs = documents ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-voice text-2xl font-semibold text-foreground">Documents</h1>
        <p className="text-sm text-muted-foreground">
          Photo, PDF ou fichier : l&apos;original est toujours conservé, rien n&apos;est intégré sans que vous ayez
          relu et validé.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Importer un document</CardTitle></CardHeader>
        <CardContent>
          <ul className="grid gap-2 sm:grid-cols-2" role="list">
            {IMPORT_LINKS.map(({ href, icon: Icon, title, description }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="flex items-start gap-3 rounded-lg border border-border-strong px-4 py-3 text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
                >
                  {/* Icônes décoratives */}
                  <Icon size={17} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                  <div>
                    <div className="font-medium text-foreground">{title}</div>
                    <div className="text-xs text-muted-foreground">{description}</div>
                  </div>
                </Link>
              </li>
            ))}
            <li className="sm:col-span-2">
              <Link
                href="/dashboard/documents/autres"
                className="flex items-start gap-3 rounded-lg border border-border-strong px-4 py-3 text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
              >
                <FolderOpen size={17} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                <div>
                  <div className="font-medium text-foreground">Document administratif ou autre</div>
                  <div className="text-xs text-muted-foreground">Aucune lecture automatique — simple conservation dans la bibliothèque</div>
                </div>
              </Link>
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historique</CardTitle>
          <CardDescription>Vos 100 derniers documents.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {docs.length > 0 ? (
            <ul role="list" className="space-y-2">
              {docs.map((doc) => {
                const status = STATUS_BADGE[doc.status] ?? STATUS_BADGE.pending_review;
                const { title: extractedTitle, rowsCount } = extractDocSummary(doc.extracted_data);
                const label = extractedTitle || rowsCount > 0
                  ? `${KIND_LABELS[doc.kind] ?? doc.kind}${extractedTitle ? " — " + extractedTitle : ""}`
                  : KIND_LABELS[doc.kind] ?? doc.kind;
                return (
                  <li key={doc.id}>
                    <Link
                      href={doc.status === "pending_review" ? reviewHref(doc) : `/dashboard/documents/${doc.id}`}
                      className="flex items-center justify-between rounded-lg border border-border bg-background-soft px-4 py-2.5 text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
                      aria-label={`${label} — ${new Date(doc.created_at).toLocaleDateString("fr-FR")} — ${status.label}`}
                    >
                      <span>{label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {new Date(doc.created_at).toLocaleDateString("fr-FR")}
                        </span>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground" role="status">
              Aucun document importé pour l&apos;instant.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

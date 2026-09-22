import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/dashboard/context";
import { getCurrentSchoolYear } from "@/lib/dashboard/school-year";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Upload } from "lucide-react";

export default async function ElevesPage() {
  const supabase = await createClient();
  const { membership } = await requireCurrentOrg();
  const currentYear = await getCurrentSchoolYear(supabase, membership.organizations?.country_id);

  const { data: students } = currentYear
    ? await supabase
        .from("students")
        .select("id, full_name, student_number, classes!inner(id, name, school_year_id)")
        .eq("organization_id", membership.organization_id)
        .eq("classes.school_year_id", currentYear.id)
        .is("archived_at", null)
        .order("full_name")
    : { data: null };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-voice text-2xl font-semibold text-foreground">Vos élèves</h1>
          <p className="text-sm text-muted-foreground">
            Toutes classes confondues{currentYear ? ` — ${currentYear.label}` : ""}.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/archives"
            className="text-sm font-medium text-primary hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
          >
            Archives
          </Link>
          {/* Le Link wraps un Button : le lien est l'élément navigable (WCAG 4.1.2) */}
          <Link
            href="/dashboard/eleves/import"
            aria-label="Importer une liste d'élèves"
            className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
          >
            <Button variant="secondary" tabIndex={-1} aria-hidden="true">
              {/* Icône décorative */}
              <Upload size={15} aria-hidden="true" />
              Importer
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardContent className="pt-5">
          {(students ?? []).length > 0 ? (
            <ul role="list" className="space-y-2" aria-label="Liste des élèves">
              {(students ?? []).map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-background-soft px-4 py-2 text-sm"
                >
                  <span>{s.full_name}</span>
                  <Link
                    href={`/dashboard/classes/${s.classes?.id}`}
                    className="text-muted-foreground hover:text-primary rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
                    aria-label={`Voir la classe ${s.classes?.name} de ${s.full_name}`}
                  >
                    {s.classes?.name}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground" role="status">
              Aucun élève encore. Ajoutez-en depuis la fiche d&apos;une classe, ou importez une liste déjà prête.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/dashboard/context";
import { listArchivedSchoolYears } from "@/lib/dashboard/school-year";
import { Card, CardContent } from "@/components/ui/card";
import { Archive } from "lucide-react";
import Link from "next/link";

// Section Archives (22 août 2026) : une nouvelle année scolaire reconstruit
// tout à zéro (décision de principe) — cette section est le seul endroit où
// consulter les années précédentes, toujours en lecture seule. Rien n'est
// jamais supprimé (Convention §15/§48), donc il n'y a jamais rien à
// "récupérer" ici : juste à consulter et télécharger.
export default async function ArchivesPage() {
  const supabase = await createClient();
  const { membership } = await requireCurrentOrg();
  const countryId = membership.organizations?.country_id;

  const years = await listArchivedSchoolYears(supabase, countryId);

  // On n'affiche que les années où cette organisation a effectivement eu au
  // moins une classe (pas toutes les années du référentiel pays).
  const { data: classCounts } = await supabase
    .from("classes")
    .select("school_year_id")
    .eq("organization_id", membership.organization_id)
    .in("school_year_id", years.map((y) => y.id));
  const yearIdsWithData = new Set((classCounts ?? []).map((c) => c.school_year_id));
  const relevantYears = years.filter((y) => yearIdsWithData.has(y.id));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 font-voice text-2xl font-semibold text-foreground">
          <Archive size={22} className="text-primary" /> Archives
        </h1>
        <p className="text-sm text-muted-foreground">
          Classes, élèves, notes et bulletins des années précédentes — conservés en lecture seule, toujours téléchargeables.
        </p>
      </div>
      <Card>
        <CardContent className="space-y-2 pt-5">
          {relevantYears.map((y) => (
            <Link
              key={y.id}
              href={`/dashboard/archives/${y.id}`}
              className="flex items-center justify-between rounded-lg border border-border-strong bg-background-soft px-4 py-3 text-sm transition-colors hover:bg-muted"
            >
              <span className="font-medium text-foreground">{y.label}</span>
              <span className="text-muted-foreground">du {y.starts_on} au {y.ends_on}</span>
            </Link>
          ))}
          {relevantYears.length === 0 && (
            <p className="text-sm text-muted-foreground">Aucune année archivée pour l&apos;instant.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

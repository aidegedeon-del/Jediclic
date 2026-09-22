import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/dashboard/context";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Users } from "lucide-react";
import Link from "next/link";

export default async function ArchivedYearPage({ params }: { params: Promise<{ schoolYearId: string }> }) {
  const { schoolYearId } = await params;
  const supabase = await createClient();
  const { membership, user } = await requireCurrentOrg();
  const isSupervisor = membership.role === "owner" || membership.role === "admin";

  const [{ data: schoolYear }, { data: classes }] = await Promise.all([
    supabase.from("school_years").select("id, label, starts_on, ends_on").eq("id", schoolYearId).single(),
    supabase
      .from("classes")
      .select("id, name, teacher_id, education_levels(name), students(count)")
      .eq("organization_id", membership.organization_id)
      .eq("school_year_id", schoolYearId)
      .order("name"),
  ]);

  // Un professeur normal ne voit que les classes qui étaient les siennes
  // cette année-là (même logique de visibilité que la page Classes en
  // cours) ; owner/admin voient tout (supervision, EF-ETAB-02).
  const visibleClasses = isSupervisor ? classes ?? [] : (classes ?? []).filter((c) => c.teacher_id === user!.id);

  if (!schoolYear) return <p className="text-sm text-muted-foreground">Cette année n&apos;existe pas ou plus.</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/dashboard/archives" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          <ArrowLeft size={14} /> Toutes les archives
        </Link>
        <h1 className="mt-2 font-voice text-2xl font-semibold text-foreground">Année {schoolYear.label}</h1>
        <p className="text-sm text-muted-foreground">du {schoolYear.starts_on} au {schoolYear.ends_on} · lecture seule</p>
      </div>
      <Card>
        <CardContent className="space-y-2 pt-5">
          {visibleClasses.map((c) => (
            <Link
              key={c.id}
              href={`/dashboard/archives/${schoolYearId}/classes/${c.id}`}
              className="flex items-center justify-between rounded-lg border border-border-strong bg-background-soft px-4 py-3 text-sm transition-colors hover:bg-muted"
            >
              <span className="flex items-center gap-2 font-medium text-foreground"><Users size={15} className="text-primary" /> {c.name}</span>
              <span className="text-muted-foreground">{c.education_levels?.name} · {c.students?.[0]?.count ?? 0} élève(s)</span>
            </Link>
          ))}
          {visibleClasses.length === 0 && (
            <p className="text-sm text-muted-foreground">Aucune classe archivée pour vous sur cette année.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/dashboard/context";
import { listSchoolPeriods, computeClassBulletin, computeClassAverage } from "@/lib/bulletins/compute";
import { PrintableBulletin, PrintableClassSummary } from "@/components/bulletins/printable-bulletin";
import { PrintButton } from "@/components/ui/print-button";
import { DownloadClassBulletinsButton } from "@/components/bulletins/download-pdf-button";
import Link from "next/link";

export default async function ClassBulletinsPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string; periodId?: string; subjectId?: string }>;
}) {
  const { classId, periodId, subjectId } = await searchParams;
  const supabase = await createClient();
  const { user, membership } = await requireCurrentOrg();

  if (!classId || !periodId || !subjectId) {
    return <p className="text-sm text-muted-foreground">Classe, période ou discipline manquante. Revenez depuis la page Bulletins.</p>;
  }

  const [{ data: klass }, { data: org }] = await Promise.all([
    supabase.from("classes").select("id, name, school_year_id").eq("id", classId).single(),
    supabase.from("organizations").select("name").eq("id", membership.organization_id).single(),
  ]);
  if (!klass) return <p className="text-sm text-muted-foreground">Classe introuvable.</p>;

  const [periods, { data: schoolYear }, { data: subject }] = await Promise.all([
    listSchoolPeriods(supabase, klass.school_year_id),
    supabase.from("school_years").select("label").eq("id", klass.school_year_id).single(),
    supabase.from("subjects").select("name").eq("id", subjectId).single(),
  ]);
  const period = periods.find((p) => p.id === periodId);
  if (!period) return <p className="text-sm text-muted-foreground">Période introuvable.</p>;

  const rows = await computeClassBulletin(supabase, { classId, teacherId: user!.id, subjectId, period });
  const classAverage = computeClassAverage(rows);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Link href={`/dashboard/bulletins?classId=${classId}&periodId=${periodId}&subjectId=${subjectId}`} className="text-sm font-medium text-primary hover:underline">
          ← Retour aux bulletins
        </Link>
        <div className="flex items-center gap-2 print:hidden">
          <DownloadClassBulletinsButton
            organizationName={org?.name ?? "Établissement"}
            className={klass.name}
            schoolYearLabel={schoolYear?.label ?? null}
            subjectName={subject?.name ?? null}
            period={period}
            classAverage={classAverage}
            rows={rows}
          />
          <PrintButton label={`Imprimer les ${rows.length} bulletin(s)`} />
        </div>
      </div>
      <div className="space-y-6 print:space-y-0">
        <PrintableClassSummary
          organizationName={org?.name ?? "Établissement"}
          className={klass.name}
          schoolYearLabel={schoolYear?.label ?? null}
          subjectName={subject?.name ?? null}
          period={period}
          classAverage={classAverage}
          rows={rows}
        />
        {rows.map((row) => (
          <PrintableBulletin
            key={row.studentId}
            organizationName={org?.name ?? "Établissement"}
            className={klass.name}
            schoolYearLabel={schoolYear?.label ?? null}
            subjectName={subject?.name ?? null}
            period={period}
            row={row}
          />
        ))}
        {rows.length === 0 && <p className="text-sm text-muted-foreground">Aucun élève dans cette classe.</p>}
      </div>
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/dashboard/context";
import { listSchoolPeriods, computeStudentBulletin } from "@/lib/bulletins/compute";
import { PrintableBulletin } from "@/components/bulletins/printable-bulletin";
import { PrintButton } from "@/components/ui/print-button";
import { DownloadStudentBulletinButton } from "@/components/bulletins/download-pdf-button";
import Link from "next/link";

export default async function StudentBulletinPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ classId?: string; periodId?: string; subjectId?: string }>;
}) {
  const { studentId } = await params;
  const { classId, periodId, subjectId } = await searchParams;
  const supabase = await createClient();
  const { user, membership } = await requireCurrentOrg();

  if (!classId || !periodId || !subjectId) {
    return <p className="text-sm text-muted-foreground">Classe, période ou discipline manquante.</p>;
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

  const row = await computeStudentBulletin(supabase, { classId, teacherId: user!.id, subjectId, studentId, period });
  if (!row) return <p className="text-sm text-muted-foreground">Élève introuvable dans cette classe.</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Link href={`/dashboard/bulletins/${studentId}?classId=${classId}&periodId=${periodId}&subjectId=${subjectId}`} className="text-sm font-medium text-primary hover:underline">
          ← Retour au bulletin
        </Link>
        <div className="flex items-center gap-2 print:hidden">
          <DownloadStudentBulletinButton
            organizationName={org?.name ?? "Établissement"}
            className={klass.name}
            schoolYearLabel={schoolYear?.label ?? null}
            subjectName={subject?.name ?? null}
            period={period}
            row={row}
          />
          <PrintButton />
        </div>
      </div>
      <PrintableBulletin
        organizationName={org?.name ?? "Établissement"}
        className={klass.name}
        schoolYearLabel={schoolYear?.label ?? null}
        subjectName={subject?.name ?? null}
        period={period}
        row={row}
      />
    </div>
  );
}

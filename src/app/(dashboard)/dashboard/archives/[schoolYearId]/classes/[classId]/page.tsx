import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/dashboard/context";
import { listSchoolPeriods, getTeacherSubjectsForClass } from "@/lib/bulletins/compute";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DownloadStudentListButton } from "@/components/eleves/download-student-list-button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function ArchivedClassPage({
  params,
}: {
  params: Promise<{ schoolYearId: string; classId: string }>;
}) {
  const { schoolYearId, classId } = await params;
  const supabase = await createClient();
  const { user, membership } = await requireCurrentOrg();

  const [{ data: klass }, { data: schoolYear }, { data: students }] = await Promise.all([
    supabase.from("classes").select("id, name, teacher_id, education_levels(name)").eq("id", classId).single(),
    supabase.from("school_years").select("id, label").eq("id", schoolYearId).single(),
    supabase
      .from("students")
      .select("id, full_name, student_number")
      .eq("class_id", classId)
      .eq("organization_id", membership.organization_id)
      .order("full_name"),
  ]);

  if (!klass || !schoolYear) return <p className="text-sm text-muted-foreground">Cette classe n&apos;existe pas ou plus.</p>;

  // Les bulletins par discipline/période ne peuvent être proposés ici que
  // pour le professeur qui a lui-même enseigné cette classe (les notes lui
  // appartiennent, EF-NOTES) — un admin/owner qui consulte les archives
  // d'une classe d'un autre professeur voit la liste d'élèves mais pas ce
  // menu-là (limite connue, à traiter séparément si besoin un jour).
  const isOwnClass = klass.teacher_id === user!.id;
  const periods = isOwnClass ? await listSchoolPeriods(supabase, schoolYearId) : [];
  const subjects = isOwnClass ? await getTeacherSubjectsForClass(supabase, { teacherId: user!.id, classId }) : [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href={`/dashboard/archives/${schoolYearId}`} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          <ArrowLeft size={14} /> {schoolYear.label}
        </Link>
        <h1 className="mt-2 font-voice text-2xl font-semibold text-foreground">{klass.name}</h1>
        <p className="text-sm text-muted-foreground">{klass.education_levels?.name} · {schoolYear.label} · lecture seule</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Élèves ({students?.length ?? 0})</CardTitle>
          {students && students.length > 0 && (
            <DownloadStudentListButton
              className={klass.name}
              schoolYearLabel={schoolYear.label}
              students={students.map((s) => ({ fullName: s.full_name, studentNumber: s.student_number }))}
            />
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {(students ?? []).map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-lg border border-border-strong px-4 py-2 text-sm">
              <span>{s.full_name}</span>
              {s.student_number && <span className="font-data text-muted-foreground">{s.student_number}</span>}
            </div>
          ))}
          {(!students || students.length === 0) && (
            <p className="text-sm text-muted-foreground">Aucun élève enregistré dans cette classe.</p>
          )}
        </CardContent>
      </Card>

      {isOwnClass && periods.length > 0 && subjects.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Bulletins</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Consultez et téléchargez (PDF) les bulletins de cette classe, comme sur une année en cours.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {subjects.map((subject) =>
                periods.map((period) => (
                  <Link
                    key={`${subject.id}-${period.id}`}
                    href={`/dashboard/bulletins/imprimer?classId=${classId}&periodId=${period.id}&subjectId=${subject.id}`}
                    className="rounded-lg border border-border-strong px-4 py-2 text-sm transition-colors hover:bg-muted"
                  >
                    {subject.name} — {period.label}
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/dashboard/context";
import { Card, CardContent } from "@/components/ui/card";
import { computeAverage, formatScore } from "@/lib/utils";

export default async function NotesPage({ searchParams }: { searchParams: Promise<{ classId?: string }> }) {
  const { classId } = await searchParams;
  const supabase = await createClient();
  const { membership } = await requireCurrentOrg();
  const orgId = membership.organization_id;

  const { data: classes } = await supabase.from("classes").select("id, name").eq("organization_id", orgId).is("archived_at", null);
  const activeClass = classes?.find((c) => c.id === classId) ?? classes?.[0];

  // Types locaux reflétant exactement les colonnes des `.select()`
  // ci-dessous — remplace les `any[]` précédents.
  type StudentRow = { id: string; full_name: string };
  type AssessmentRow = { id: string; title: string; max_score: number; coefficient: number };
  type ResultRow = { student_id: string; assessment_id: string; score: number | null };

  let students: StudentRow[] = [];
  let assessments: AssessmentRow[] = [];
  let results: ResultRow[] = [];

  if (activeClass) {
    const [{ data: s }, { data: a }] = await Promise.all([
      supabase.from("students").select("id, full_name").eq("class_id", activeClass.id).is("archived_at", null).order("full_name"),
      supabase.from("assessments").select("id, title, max_score, coefficient").eq("class_id", activeClass.id).eq("published", true).order("assessment_date"),
    ]);
    students = s ?? [];
    assessments = a ?? [];

    const assessmentIds = assessments.map((x) => x.id);
    if (assessmentIds.length > 0) {
      const { data: r } = await supabase.from("results").select("student_id, assessment_id, score").in("assessment_id", assessmentIds);
      results = r ?? [];
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-voice text-2xl font-semibold text-foreground">Notes & moyennes</h1>
        <p className="text-sm text-muted-foreground">Seules les évaluations publiées comptent dans la moyenne — calculée pour vous.</p>
      </div>

      {/* Filtres de classes — navigation par onglets accessibles (WCAG 4.1.2) */}
      {(classes ?? []).length > 0 && (
        <nav aria-label="Sélection de la classe">
          <ul className="flex flex-wrap gap-2" role="list">
            {(classes ?? []).map((c) => {
              const isActive = activeClass?.id === c.id;
              return (
                <li key={c.id}>
                  <a
                    href={`/dashboard/notes?classId=${c.id}`}
                    aria-current={isActive ? "page" : undefined}
                    className={`inline-flex rounded-full border px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 ${
                      isActive
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border-strong hover:bg-muted"
                    }`}
                  >
                    {c.name}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      <Card>
        <CardContent className="overflow-x-auto pt-5">
          {/* caption invisible mais présent pour l'accessibilité (WCAG 1.3.1) */}
          <table className="w-full text-sm" aria-label={`Notes — ${activeClass?.name ?? "classe"}`}>
            <caption className="sr-only">
              Tableau des notes et moyennes{activeClass ? ` pour la classe ${activeClass.name}` : ""}.
              {assessments.length > 0
                ? ` ${assessments.length} évaluation(s) publiée(s).`
                : " Aucune évaluation publiée."}
            </caption>
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                {/* scope="col" sur chaque en-tête de colonne (WCAG 1.3.1) */}
                <th scope="col" className="py-2 pr-4">Élève</th>
                {assessments.map((a) => (
                  <th key={a.id} scope="col" className="py-2 pr-4 font-normal">{a.title}</th>
                ))}
                <th scope="col" className="py-2 pr-4 font-semibold text-foreground">Moyenne</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => {
                const studentResults = assessments.map((a) => {
                  const r = results.find((x) => x.student_id === s.id && x.assessment_id === a.id);
                  return { score: r?.score ?? null, maxScore: Number(a.max_score), coefficient: Number(a.coefficient) };
                });
                const avg = computeAverage(studentResults);
                return (
                  <tr key={s.id} className="border-b border-border">
                    {/* scope="row" pour identifier la ligne (WCAG 1.3.1) */}
                    <th scope="row" className="py-2 pr-4 font-normal text-left">{s.full_name}</th>
                    {studentResults.map((r, i) => (
                      <td key={i} className="py-2 pr-4 font-data">{formatScore(r.score, r.maxScore)}</td>
                    ))}
                    <td className="py-2 pr-4 font-data font-semibold text-foreground">
                      {avg !== null ? avg.toFixed(1) : "—"}
                    </td>
                  </tr>
                );
              })}
              {students.length === 0 && (
                <tr>
                  <td
                    colSpan={assessments.length + 2}
                    className="py-4 text-muted-foreground"
                  >
                    Aucun élève dans cette classe.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

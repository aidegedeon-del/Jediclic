import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/dashboard/context";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listSchoolPeriods, computeClassBulletin, computeClassAverage, getTeacherSubjectsForClass } from "@/lib/bulletins/compute";

export default async function BulletinsPage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string; periodId?: string; subjectId?: string }>;
}) {
  const { classId, periodId, subjectId } = await searchParams;
  const supabase = await createClient();
  const { user, membership } = await requireCurrentOrg();
  const orgId = membership.organization_id;

  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, school_year_id")
    .eq("organization_id", orgId)
    .is("archived_at", null);

  const activeClass = classes?.find((c) => c.id === classId) ?? classes?.[0];
  const periods = activeClass ? await listSchoolPeriods(supabase, activeClass.school_year_id) : [];
  const activePeriod = periods.find((p) => p.id === periodId) ?? periods[0];

  const subjects = activeClass ? await getTeacherSubjectsForClass(supabase, { teacherId: user!.id, classId: activeClass.id }) : [];
  const activeSubject = subjects.find((s) => s.id === subjectId) ?? subjects[0];

  const rows =
    activeClass && activePeriod && activeSubject
      ? await computeClassBulletin(supabase, { classId: activeClass.id, teacherId: user!.id, subjectId: activeSubject.id, period: activePeriod })
      : [];
  const classAverage = computeClassAverage(rows);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-voice text-2xl font-semibold text-foreground">
          Bulletins{" "}
          <Badge variant="ai" className="ml-2" aria-label="Fonctionnalité assistée par intelligence artificielle">IA</Badge>
        </h1>
        <p className="text-sm text-muted-foreground">
          Moyenne de <strong className="text-foreground">{activeSubject?.name ?? "votre discipline"}</strong> par
          période officielle, avec une appréciation proposée que vous relisez avant de la garder. Ce document couvre
          uniquement votre discipline — le bulletin final de l&apos;élève, toutes disciplines confondues, reste établi
          au niveau du ministère.
        </p>
        {activeClass && subjects.length === 0 && (
          <p className="mt-2 text-sm text-warning" role="status">
            Aucune évaluation créée sur cette classe pour l&apos;instant : commencez par en créer une depuis la page
            Évaluations.
          </p>
        )}
      </div>

      {/* Sélection de classe */}
      <Card>
        <CardContent className="pt-5">
          <nav aria-label="Sélection de la classe pour les bulletins">
            <ul className="flex flex-wrap gap-2" role="list">
              {(classes ?? []).map((c) => {
                const isActive = activeClass?.id === c.id;
                return (
                  <li key={c.id}>
                    <Link
                      href={`/dashboard/bulletins?classId=${c.id}`}
                      aria-current={isActive ? "page" : undefined}
                      className={`inline-flex rounded-full border px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 ${
                        isActive ? "border-primary bg-primary text-primary-foreground" : "border-border-strong hover:bg-muted"
                      }`}
                    >
                      {c.name}
                    </Link>
                  </li>
                );
              })}
              {(!classes || classes.length === 0) && (
                <li>
                  <p className="text-sm text-muted-foreground">Créez d&apos;abord une classe.</p>
                </li>
              )}
            </ul>
          </nav>
        </CardContent>
      </Card>

      {/* Sélection de discipline */}
      {activeClass && subjects.length > 1 && (
        <Card>
          <CardContent className="pt-5">
            <nav aria-label="Sélection de la discipline">
              <ul className="flex flex-wrap gap-2" role="list">
                {subjects.map((s) => {
                  const isActive = activeSubject?.id === s.id;
                  return (
                    <li key={s.id}>
                      <Link
                        href={`/dashboard/bulletins?classId=${activeClass.id}&subjectId=${s.id}`}
                        aria-current={isActive ? "page" : undefined}
                        className={`inline-flex rounded-full border px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 ${
                          isActive ? "border-primary bg-primary text-primary-foreground" : "border-border-strong hover:bg-muted"
                        }`}
                      >
                        {s.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </CardContent>
        </Card>
      )}

      {/* Sélection de période */}
      {activeClass && (
        <Card>
          <CardContent className="pt-5">
            <nav aria-label="Sélection de la période">
              <ul className="flex flex-wrap gap-2" role="list">
                {periods.map((p) => {
                  const isActive = activePeriod?.id === p.id;
                  return (
                    <li key={p.id}>
                      <Link
                        href={`/dashboard/bulletins?classId=${activeClass.id}&periodId=${p.id}${activeSubject ? `&subjectId=${activeSubject.id}` : ""}`}
                        aria-current={isActive ? "page" : undefined}
                        className={`inline-flex rounded-full border px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 ${
                          isActive ? "border-primary bg-primary text-primary-foreground" : "border-border-strong hover:bg-muted"
                        }`}
                      >
                        {p.label}
                      </Link>
                    </li>
                  );
                })}
                {periods.length === 0 && (
                  <li>
                    <p className="text-sm text-muted-foreground">
                      Aucune période officielle (trimestre) n&apos;est encore chargée pour l&apos;année scolaire de cette
                      classe — elle sera disponible dès sa publication officielle.
                    </p>
                  </li>
                )}
              </ul>
            </nav>
          </CardContent>
        </Card>
      )}

      {/* Moyenne de classe */}
      {activeClass && activePeriod && activeSubject && (
        <Card>
          <CardContent className="flex items-center justify-between pt-5">
            <span className="text-sm font-medium text-foreground">Moyenne de la classe dans la discipline</span>
            <span className="font-data text-xl font-semibold text-foreground" aria-label={`Moyenne de la classe : ${classAverage !== null ? `${classAverage.toFixed(1)} sur 20` : "non calculée"}`}>
              {classAverage !== null ? `${classAverage.toFixed(1)}/20` : "—"}
            </span>
          </CardContent>
        </Card>
      )}

      {/* Lien impression */}
      {activeClass && activePeriod && activeSubject && (
        <div className="flex justify-end">
          <Link
            href={`/dashboard/bulletins/imprimer?classId=${activeClass.id}&periodId=${activePeriod.id}&subjectId=${activeSubject.id}`}
            className="text-sm font-medium text-primary hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
          >
            Imprimer tous les bulletins de la classe
          </Link>
        </div>
      )}

      {/* Tableau des bulletins */}
      {activeClass && activePeriod && activeSubject && (
        <Card>
          <CardContent className="overflow-x-auto pt-5">
            <table
              className="w-full text-sm"
              aria-label={`Bulletins de ${activeClass.name} — ${activePeriod.label} — ${activeSubject.name}`}
            >
              <caption className="sr-only">
                Tableau des bulletins : rang, élève, moyenne, appréciation et statut pour la classe {activeClass.name},
                période {activePeriod.label}, discipline {activeSubject.name}.
              </caption>
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th scope="col" className="py-2 pr-4">Rang</th>
                  <th scope="col" className="py-2 pr-4">Élève</th>
                  <th scope="col" className="py-2 pr-4 font-semibold text-foreground">Moyenne</th>
                  <th scope="col" className="py-2 pr-4">Appréciation</th>
                  <th scope="col" className="py-2 pr-4">Statut</th>
                  {/* Colonne action — libellé pour AT */}
                  <th scope="col" className="py-2 pr-4">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.studentId} className="border-b border-border align-top">
                    <td className="py-2 pr-4 font-data">{r.rank ?? "—"}</td>
                    <th scope="row" className="py-2 pr-4 font-normal text-left">{r.fullName}</th>
                    <td className="py-2 pr-4 font-data font-semibold text-foreground">
                      <span aria-label={`Moyenne : ${r.average !== null ? `${r.average.toFixed(1)} sur 20` : "non calculée"}`}>
                        {r.average !== null ? r.average.toFixed(1) : "—"}
                      </span>
                    </td>
                    <td className="py-2 pr-4 max-w-xs truncate text-muted-foreground">{r.reportCard?.appreciation || "—"}</td>
                    <td className="py-2 pr-4">
                      {!r.reportCard?.appreciation && <Badge variant="warning">À rédiger</Badge>}
                      {r.reportCard?.appreciation && r.reportCard.origin === "ai_generated" && (
                        <Badge variant="ai" aria-label="Appréciation générée par l'IA, à relire">IA — à relire</Badge>
                      )}
                      {r.reportCard?.appreciation && r.reportCard.origin === "teacher" && (
                        <Badge variant="success">Rédigée</Badge>
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      <Link
                        href={`/dashboard/bulletins/${r.studentId}?classId=${activeClass.id}&periodId=${activePeriod.id}&subjectId=${activeSubject.id}`}
                        className="font-medium text-primary hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
                        aria-label={`Voir le bulletin de ${r.fullName}`}
                      >
                        Voir le bulletin
                      </Link>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-4 text-muted-foreground">
                      Aucun élève dans cette classe.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

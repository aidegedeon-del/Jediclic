import { formatScore } from "@/lib/utils";
import { BulletinStudentRow, SchoolPeriod } from "@/lib/bulletins/compute";

function bulletinTitle(params: { periodLabel: string; subjectName: string | null; className: string; schoolYearLabel: string | null }) {
  const { periodLabel, subjectName, className, schoolYearLabel } = params;
  return `Moyenne de ${periodLabel.toLowerCase()} de ${subjectName ?? "discipline non renseignée"} de ${className}${
    schoolYearLabel ? ` ${schoolYearLabel}` : ""
  }`;
}

export function PrintableBulletin({
  organizationName,
  className,
  schoolYearLabel,
  subjectName,
  period,
  row,
}: {
  organizationName: string;
  className: string;
  schoolYearLabel: string | null;
  subjectName: string | null;
  period: SchoolPeriod;
  row: BulletinStudentRow;
}) {
  const title = bulletinTitle({ periodLabel: period.label, subjectName, className, schoolYearLabel });

  return (
    /*
     * section avec role="region" + aria-label pour délimiter le bulletin
     * de chaque élève (WCAG 1.3.1, 2.4.6).
     */
    <section
      aria-label={`Bulletin de ${row.fullName} — ${title}`}
      className="mx-auto max-w-2xl border border-black/10 bg-white p-8 text-black print:break-after-page print:border-0 print:p-6"
    >
      <header className="mb-6 border-b border-black/20 pb-4">
        {/* Organisation */}
        <p className="text-xs uppercase tracking-wide text-black/60">{organizationName}</p>
        {/* Titre du bulletin : h2 (h1 est dans la page parente) */}
        <h2 className="font-voice text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-xs text-black/60">
          du {period.starts_on} au {period.ends_on}
        </p>
      </header>

      {/* Identité de l'élève */}
      <div className="mb-4 flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-black/60">Élève</p>
          <p className="text-lg font-medium">{row.fullName}</p>
        </div>
        {row.rank !== null && (
          <p className="text-right text-sm text-black/60">
            Rang : <span className="font-semibold text-black">{row.rank}</span>
          </p>
        )}
      </div>

      {/* Tableau des évaluations — accessible (WCAG 1.3.1) */}
      <table className="mb-4 w-full text-sm" aria-label={`Évaluations de ${row.fullName} pour la période ${period.label}`}>
        <caption className="sr-only">
          Liste des évaluations prises en compte pour {row.fullName} — {period.label}.
        </caption>
        <thead>
          <tr className="border-b border-black/20 text-left text-black/60">
            <th scope="col" className="py-1.5 pr-4 font-normal">Évaluation</th>
            <th scope="col" className="py-1.5 pr-4 font-normal">Date</th>
            <th scope="col" className="py-1.5 pr-4 font-normal">Coef.</th>
            <th scope="col" className="py-1.5 pr-4 font-normal">Note</th>
          </tr>
        </thead>
        <tbody>
          {row.assessments.map((a) => (
            <tr key={a.id} className="border-b border-black/10">
              <th scope="row" className="py-1.5 pr-4 font-normal text-left">{a.title}</th>
              <td className="py-1.5 pr-4">{a.date}</td>
              <td className="py-1.5 pr-4">{a.coefficient}</td>
              <td className="py-1.5 pr-4">{formatScore(a.score, a.maxScore)}</td>
            </tr>
          ))}
          {row.assessments.length === 0 && (
            <tr>
              <td colSpan={4} className="py-3 text-black/60">
                Aucune évaluation publiée sur cette période.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Résumé de la moyenne */}
      <div className="mb-6 flex items-center justify-between rounded-md bg-black/5 px-4 py-2">
        <span className="text-sm font-medium">Moyenne de la période</span>
        <span
          className="text-lg font-semibold"
          aria-label={`Moyenne : ${row.average !== null ? `${row.average.toFixed(1)} sur 20` : "non calculée"}`}
        >
          {row.average !== null ? `${row.average.toFixed(1)}/20` : "—"}
        </span>
      </div>

      {/* Appréciation */}
      <div className="mb-4">
        <p className="mb-1 text-xs uppercase tracking-wide text-black/60">Appréciation</p>
        <p className="whitespace-pre-wrap text-sm">{row.reportCard?.appreciation || "—"}</p>
      </div>

      {/* Observations */}
      <div className="mb-6">
        <p className="mb-1 text-xs uppercase tracking-wide text-black/60">Observations</p>
        <p className="whitespace-pre-wrap text-sm">{row.reportCard?.observations || "—"}</p>
      </div>

      {/* Signature */}
      <div className="flex justify-end gap-12 text-sm text-black/60">
        <div className="text-center">
          <p className="mb-8">Signature du professeur</p>
          <div className="border-t border-black/30 pt-1">&nbsp;</div>
        </div>
      </div>
    </section>
  );
}

/**
 * Vue "classe" : résumé de toute la classe sur une seule fiche imprimable.
 */
export function PrintableClassSummary({
  organizationName,
  className,
  schoolYearLabel,
  subjectName,
  period,
  classAverage,
  rows,
}: {
  organizationName: string;
  className: string;
  schoolYearLabel: string | null;
  subjectName: string | null;
  period: SchoolPeriod;
  classAverage: number | null;
  rows: BulletinStudentRow[];
}) {
  const title = bulletinTitle({ periodLabel: period.label, subjectName, className, schoolYearLabel });

  return (
    <section
      aria-label={`Récapitulatif de la classe ${className} — ${title}`}
      className="mx-auto max-w-2xl border border-black/10 bg-white p-8 text-black print:break-after-page print:border-0 print:p-6"
    >
      <header className="mb-6 border-b border-black/20 pb-4">
        <p className="text-xs uppercase tracking-wide text-black/60">{organizationName}</p>
        <h2 className="font-voice text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-xs text-black/60">
          du {period.starts_on} au {period.ends_on} · {rows.length} élève(s)
        </p>
      </header>

      {/* Moyenne de la classe */}
      <div className="mb-6 flex items-center justify-between rounded-md bg-black/5 px-4 py-3">
        <span className="text-sm font-medium">Moyenne de la classe dans la discipline</span>
        <span
          className="font-data text-2xl font-semibold"
          aria-label={`Moyenne de la classe : ${classAverage !== null ? `${classAverage.toFixed(1)} sur 20` : "non calculée"}`}
        >
          {classAverage !== null ? `${classAverage.toFixed(1)}/20` : "—"}
        </span>
      </div>

      {/* Tableau récapitulatif élève par élève */}
      <table className="w-full text-sm" aria-label={`Récapitulatif de la classe ${className} — ${period.label}`}>
        <caption className="sr-only">
          Tableau récapitulatif des moyennes et appréciations pour la classe {className}, période {period.label}.
        </caption>
        <thead>
          <tr className="border-b border-black/20 text-left text-black/60">
            <th scope="col" className="py-1.5 pr-3 font-normal">Rang</th>
            <th scope="col" className="py-1.5 pr-3 font-normal">Élève</th>
            <th scope="col" className="py-1.5 pr-3 font-normal">Moyenne</th>
            <th scope="col" className="py-1.5 pr-3 font-normal">Appréciation</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.studentId} className="border-b border-black/10 align-top">
              <td className="py-1.5 pr-3">{r.rank ?? "—"}</td>
              <th scope="row" className="py-1.5 pr-3 font-normal text-left">{r.fullName}</th>
              <td className="py-1.5 pr-3 font-medium">
                <span aria-label={`${r.average !== null ? `${r.average.toFixed(1)} sur 20` : "non calculée"}`}>
                  {r.average !== null ? r.average.toFixed(1) : "—"}
                </span>
              </td>
              <td className="py-1.5 pr-3 text-black/70">{r.reportCard?.appreciation || "—"}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="py-3 text-black/60">Aucun élève dans cette classe.</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}

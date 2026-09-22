import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/dashboard/context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import { formatScore } from "@/lib/utils";
import { listSchoolPeriods, computeStudentBulletin } from "@/lib/bulletins/compute";
import {
  generateAppreciationAction,
  regenerateAppreciationAction,
  saveReportCard,
  acceptReportCard,
  refuseReportCard,
} from "./actions";

export default async function StudentBulletinPage({
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
  const orgId = membership.organization_id;

  if (!classId || !periodId || !subjectId) {
    return (
      <p className="text-sm text-muted-foreground" role="alert">
        Classe, période ou discipline manquante. Revenez depuis la page Bulletins.
      </p>
    );
  }

  const { data: klass } = await supabase.from("classes").select("id, name, school_year_id").eq("id", classId).single();
  if (!klass) return <p className="text-sm text-muted-foreground" role="alert">Classe introuvable.</p>;

  const periods = await listSchoolPeriods(supabase, klass.school_year_id);
  const period = periods.find((p) => p.id === periodId);
  if (!period) return <p className="text-sm text-muted-foreground" role="alert">Période introuvable.</p>;

  const bulletin = await computeStudentBulletin(supabase, { classId, teacherId: user!.id, subjectId, studentId, period });
  if (!bulletin) return <p className="text-sm text-muted-foreground" role="alert">Élève introuvable dans cette classe.</p>;

  let accepted: boolean | null = null;
  if (bulletin.reportCard) {
    const { data: rec } = await supabase
      .from("ai_recommendations")
      .select("accepted")
      .eq("based_on->>contentId", bulletin.reportCard.id)
      .eq("based_on->>table", "report_cards")
      .maybeSingle();
    accepted = rec?.accepted ?? null;
  }

  const generateAction = generateAppreciationAction.bind(null, studentId);
  const regenAction = bulletin.reportCard ? regenerateAppreciationAction.bind(null, bulletin.reportCard.id) : null;
  const saveAction = saveReportCard.bind(null, studentId, classId, periodId, subjectId, orgId);
  const acceptAction = bulletin.reportCard ? acceptReportCard.bind(null, bulletin.reportCard.id, studentId) : null;
  const refuseAction = bulletin.reportCard ? refuseReportCard.bind(null, bulletin.reportCard.id, studentId) : null;

  const appreciationLabelId = "appreciation-label";
  const observationsLabelId = "observations-label";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-voice text-2xl font-semibold text-foreground">{bulletin.fullName}</h1>
          <p className="text-sm text-muted-foreground">
            {klass.name} · {period.label} (du {period.starts_on} au {period.ends_on})
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground" id="average-label">
            Moyenne de la période{bulletin.rank !== null && ` · rang ${bulletin.rank}`}
          </div>
          <div
            className="font-data text-2xl font-semibold text-foreground"
            aria-labelledby="average-label"
            aria-label={`Moyenne : ${bulletin.average !== null ? `${bulletin.average.toFixed(1)} sur 20` : "non calculée"}`}
          >
            {bulletin.average !== null ? bulletin.average.toFixed(1) : "—"}/20
          </div>
          <Link
            href={`/dashboard/bulletins/${studentId}/imprimer?classId=${classId}&periodId=${periodId}&subjectId=${subjectId}`}
            className="text-xs font-medium text-primary hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
          >
            Imprimer / PDF
          </Link>
        </div>
      </div>

      {/* Tableau des notes de la période */}
      <Card>
        <CardHeader><CardTitle>Notes prises en compte</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm" aria-label={`Notes de ${bulletin.fullName} pour la période ${period.label}`}>
            <caption className="sr-only">
              Notes prises en compte pour {bulletin.fullName} — {period.label}.
            </caption>
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th scope="col" className="py-2 pr-4">Évaluation</th>
                <th scope="col" className="py-2 pr-4">Date</th>
                <th scope="col" className="py-2 pr-4">Note</th>
              </tr>
            </thead>
            <tbody>
              {bulletin.assessments.map((a) => (
                <tr key={a.id} className="border-b border-border">
                  <th scope="row" className="py-2 pr-4 font-normal text-left">{a.title}</th>
                  <td className="py-2 pr-4 text-muted-foreground">{a.date}</td>
                  <td className="py-2 pr-4 font-data">{formatScore(a.score, a.maxScore)}</td>
                </tr>
              ))}
              {bulletin.assessments.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-4 text-muted-foreground">
                    Aucune évaluation publiée sur cette période.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Appréciation */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle id={appreciationLabelId}>Appréciation</CardTitle>
            <div className="flex items-center gap-2" role="status" aria-live="polite">
              {bulletin.reportCard?.origin === "ai_generated" && (
                <Badge variant="ai" aria-label="Générée par l'IA">Origine : IA</Badge>
              )}
              {accepted === true && <Badge variant="success">Acceptée</Badge>}
              {accepted === false && <Badge variant="danger">Refusée</Badge>}
              {accepted == null && bulletin.reportCard?.appreciation && (
                <Badge variant="warning">À relire</Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={saveAction} className="space-y-3">
            {/* Label visible relié à la textarea (WCAG 1.3.1, 2.4.6) */}
            <Label htmlFor="appreciation-textarea">Texte de l&apos;appréciation</Label>
            <Textarea
              id="appreciation-textarea"
              name="appreciation"
              defaultValue={bulletin.reportCard?.appreciation ?? ""}
              placeholder="Aucune appréciation pour l'instant — générez-en une avec l'assistant ou rédigez-la vous-même."
              aria-labelledby={appreciationLabelId}
              aria-describedby="appreciation-hint"
            />
            <p id="appreciation-hint" className="sr-only">
              Saisissez ou modifiez l&apos;appréciation de l&apos;élève pour cette période.
            </p>
            <input type="hidden" name="observations" value={bulletin.reportCard?.observations ?? ""} />
            <Button type="submit" variant="secondary">Enregistrer l&apos;appréciation</Button>
          </form>

          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <form action={generateAction}>
              <input type="hidden" name="classId" value={classId} />
              <input type="hidden" name="periodId" value={periodId} />
              <input type="hidden" name="subjectId" value={subjectId} />
              <Button type="submit" variant="primary">
                {bulletin.reportCard?.appreciation ? "Régénérer une proposition" : "Proposer une appréciation"}
              </Button>
            </form>
            {acceptAction && (
              <form action={acceptAction}>
                <Button type="submit" variant="secondary">Accepter</Button>
              </form>
            )}
            {refuseAction && (
              <form action={refuseAction}>
                <Button type="submit" variant="danger">Refuser (effacer)</Button>
              </form>
            )}
          </div>

          {regenAction && (
            <form action={regenAction} className="flex flex-wrap items-end gap-2 border-t border-border pt-4">
              <input type="hidden" name="studentId" value={studentId} />
              <div className="flex flex-1 min-w-48 flex-col gap-1">
                <Label htmlFor="extra-instructions" className="text-xs text-muted-foreground">
                  Régénérer avec une consigne complémentaire (optionnel)
                </Label>
                <Input
                  id="extra-instructions"
                  name="extraInstructions"
                  placeholder="Ex. : insister sur les progrès en expression écrite..."
                />
              </div>
              <Button type="submit" variant="secondary">Régénérer</Button>
            </form>
          )}

          <p className="text-xs text-muted-foreground">
            Une proposition de l&apos;assistant n&apos;est jamais considérée comme définitive — relisez-la avant
            l&apos;impression du bulletin. Il ne s&apos;appuie que sur les notes affichées ci-dessus, jamais sur une
            information inventée.
          </p>
        </CardContent>
      </Card>

      {/* Observations */}
      <Card>
        <CardHeader><CardTitle id={observationsLabelId}>Observations (rédigées par vous)</CardTitle></CardHeader>
        <CardContent>
          <form action={saveAction} className="space-y-3">
            <input type="hidden" name="appreciation" value={bulletin.reportCard?.appreciation ?? ""} />
            <Label htmlFor="observations-textarea">Texte des observations</Label>
            <Textarea
              id="observations-textarea"
              name="observations"
              className="min-h-20"
              defaultValue={bulletin.reportCard?.observations ?? ""}
              placeholder="Ex. : assiduité, comportement, remarques du conseil de classe..."
              aria-labelledby={observationsLabelId}
            />
            <Button type="submit" variant="secondary">Enregistrer les observations</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

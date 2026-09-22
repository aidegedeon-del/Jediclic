import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/dashboard/context";
import { getTeacherDisciplineGrants, FREE_DISCIPLINES_PER_TEACHER } from "@/lib/subscriptions/disciplines";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { createAssessment, declareDisciplineSupplement } from "./actions";

export default async function EvaluationsPage({
  searchParams,
}: {
  searchParams: Promise<{ disciplineBlocked?: string; blockedTeacherId?: string; disciplineSupplementDeclared?: string }>;
}) {
  const { disciplineBlocked, blockedTeacherId, disciplineSupplementDeclared } = await searchParams;
  const supabase = await createClient();
  const { user, membership } = await requireCurrentOrg();
  const orgId = membership.organization_id;
  const canManageBilling = membership.role === "owner" || membership.role === "admin";

  const [{ data: assessments }, { data: classes }, { data: allSubjects }, blockedSubject, myGrants] = await Promise.all([
    supabase
      .from("assessments")
      .select("id, title, assessment_type, assessment_date, published, classes(name), subjects(name)")
      .eq("organization_id", orgId)
      .order("assessment_date", { ascending: false }),
    supabase.from("classes").select("id, name").eq("organization_id", orgId).is("archived_at", null),
    supabase.from("subjects").select("id, name").order("name"),
    disciplineBlocked
      ? supabase.from("subjects").select("id, name").eq("id", disciplineBlocked).single().then((r) => r.data)
      : Promise.resolve(null),
    getTeacherDisciplineGrants(orgId, user!.id),
  ]);

  const isCurrentUserBlocked = !blockedTeacherId || blockedTeacherId === user!.id;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-voice text-2xl font-semibold text-foreground">Évaluations</h1>
        <p className="text-sm text-muted-foreground">Devoirs, interrogations et contrôles, classés par classe.</p>
      </div>

      {myGrants.length > 0 && (
        <p className="text-xs text-muted-foreground" role="status">
          Disciplines débloquées pour votre compte : {myGrants.map((g) => g.subjectName).join(", ")}
          {myGrants.length <= FREE_DISCIPLINES_PER_TEACHER ? ` (${FREE_DISCIPLINES_PER_TEACHER} gratuites)` : ""}.
        </p>
      )}

      {/* Confirmation de paiement — role="status" pour annonce non urgente */}
      {disciplineSupplementDeclared && (
        <Card className="border-success/25 bg-success-soft">
          <CardContent className="pt-5 text-sm text-success" role="status" aria-live="polite">
            Déclaration de paiement enregistrée. La discipline sera débloquée après vérification.
          </CardContent>
        </Card>
      )}

      {/* Blocage discipline — role="alert" pour annonce urgente */}
      {disciplineBlocked && blockedSubject && (
        <Card className="border-warning/25 bg-warning-soft">
          <CardContent className="space-y-3 pt-5 text-sm text-warning" role="alert" aria-live="assertive">
            <p>
              Ce compte utilise déjà {FREE_DISCIPLINES_PER_TEACHER} disciplines gratuites. Pour créer une évaluation
              en <strong>{blockedSubject.name}</strong>, un supplément est requis (même principe qu&apos;un enseignant
              ajouté en cours de mois).
            </p>
            {isCurrentUserBlocked && canManageBilling && (
              <form action={declareDisciplineSupplement.bind(null, user!.id, blockedSubject.id)}>
                <Button type="submit" variant="secondary">Déclarer le paiement du supplément</Button>
              </form>
            )}
            {isCurrentUserBlocked && !canManageBilling && (
              <p>
                Demandez à l&apos;administrateur de votre établissement de débloquer cette discipline depuis la page{" "}
                <Link
                  href="/dashboard/etablissement"
                  className="underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
                >
                  Établissement
                </Link>.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Liste des évaluations */}
      <Card>
        <CardContent className="space-y-2 pt-5">
          {(assessments ?? []).length > 0 ? (
            <ul role="list" className="space-y-2">
              {(assessments ?? []).map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/dashboard/evaluations/${a.id}`}
                    className="flex items-center justify-between rounded-lg border border-border bg-background-soft px-4 py-2.5 text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
                    aria-label={`${a.title} — ${a.classes?.name}${a.subjects?.name ? `, ${a.subjects.name}` : ""} — ${a.assessment_date} — ${a.published ? "Publiée" : "Brouillon"}`}
                  >
                    <span>{a.title} · {a.classes?.name}{a.subjects?.name ? ` · ${a.subjects.name}` : ""}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{a.assessment_date}</span>
                      <Badge variant={a.published ? "success" : "default"}>
                        {a.published ? "Publiée" : "Brouillon"}
                      </Badge>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground" role="status">
              Aucune évaluation créée pour l&apos;instant.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Formulaire de création */}
      <Card>
        <CardHeader>
          <CardTitle>Créer une évaluation</CardTitle>
          <CardDescription>Elle reste en brouillon jusqu&apos;à ce que vous la publiiez.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={createAssessment}
            className="grid gap-4 sm:grid-cols-3 sm:items-end"
            aria-label="Formulaire de création d'évaluation"
          >
            <div>
              <Label htmlFor="title">Titre</Label>
              <Input id="title" name="title" placeholder="Interrogation — Fonctions" required aria-required="true" />
            </div>
            <div>
              <Label htmlFor="classId">Classe</Label>
              <Select id="classId" name="classId" required aria-required="true">
                {(classes ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="subjectId">Discipline</Label>
              <Select id="subjectId" name="subjectId" required aria-required="true">
                {(allSubjects ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="assessmentType">Type</Label>
              <Select id="assessmentType" name="assessmentType">
                <option value="interrogation">Interrogation</option>
                <option value="controle">Contrôle</option>
                <option value="diagnostic">Diagnostique</option>
                <option value="formative">Formative</option>
                <option value="sommative">Sommative</option>
                <option value="composition">Composition</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="assessmentDate">Date</Label>
              <Input id="assessmentDate" name="assessmentDate" type="date" required aria-required="true" />
            </div>
            <div>
              <Label htmlFor="maxScore">Barème</Label>
              <Input id="maxScore" name="maxScore" type="number" step="0.5" defaultValue={20} />
            </div>
            <div>
              <Label htmlFor="coefficient">Coefficient</Label>
              <Input id="coefficient" name="coefficient" type="number" step="0.5" defaultValue={1} />
            </div>
            <Button type="submit" className="sm:col-span-3">Créer l&apos;évaluation</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

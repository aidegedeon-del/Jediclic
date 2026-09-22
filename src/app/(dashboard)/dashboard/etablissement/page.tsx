import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/dashboard/context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { School, Users, CreditCard, UserPlus, BookPlus, Mail, AlertTriangle } from "lucide-react";
import { getOrgLicenseStatus } from "@/lib/subscriptions/quota";
import { FREE_DISCIPLINES_PER_TEACHER } from "@/lib/subscriptions/disciplines";
import { getWaveInstructions } from "@/lib/payments/wave";
import { inviteTeacher, promoteToSupervisor, removeTeacherFromOrg, revokeInvitation, submitEstablishmentWavePayment, submitSeatAdditionWavePayment } from "./actions";
import { declareDisciplineSupplementFromForm } from "../evaluations/actions";

const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  active: "Actif",
  past_due: "Paiement dû",
  canceled: "Annulé",
  expired: "Expiré",
};

const ROLE_LABELS: Record<string, string> = {
  owner: "Propriétaire",
  admin: "Administrateur",
  manager: "Gestionnaire",
  teacher: "Enseignant",
  reader: "Lecture seule",
};

export default async function EtablissementPage() {
  const supabase = await createClient();
  const { user, membership } = await requireCurrentOrg();
  const orgId = membership.organization_id;
  const org = membership.organizations;
  const isEstablishment = org?.kind === "establishment";
  const canManage = membership.role === "owner" || membership.role === "admin";

  if (!isEstablishment) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="font-voice text-2xl font-semibold text-foreground">Établissement</h1>
        <Card>
          <CardContent className="pt-5 text-sm text-muted-foreground">
            Votre espace est inscrit en tant que <strong className="text-foreground">professeur individuel</strong>,
            pas en tant qu&apos;établissement. L&apos;invitation d&apos;autres enseignants n&apos;est disponible que
            pour les espaces de type établissement, créés depuis l&apos;onboarding.
          </CardContent>
        </Card>
      </div>
    );
  }

  const [{ data: establishment }, { data: members }, { data: invitations }, license, { data: plans }, { data: lastSubmission }, { data: subjects }, { data: disciplineSubmissions }] = await Promise.all([
    supabase.from("establishments").select("id, name, city").eq("organization_id", orgId).maybeSingle(),
    supabase
      .from("organization_members")
      .select("id, user_id, role, accepted_at, suspended_at, invited_at")
      .eq("organization_id", orgId)
      .order("invited_at"),
    canManage
      ? supabase
          .from("invitations")
          .select("id, email, role, status, created_at, needs_seat_payment, seat_payment_submission_id")
          .eq("organization_id", orgId)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    getOrgLicenseStatus(orgId),
    canManage
      ? supabase
          .from("plans")
          .select("id, code, name, seats, price_minor_units, currency, billing_period, is_per_seat")
          .eq("audience", "establishment")
          .eq("is_active", true)
          .order("price_minor_units")
      : Promise.resolve({ data: [] }),
    canManage
      ? supabase
          .from("payment_submissions")
          .select("id, status, amount_due_minor_units, currency, billing_period, app_reference, created_at")
          .eq("organization_id", orgId)
          .eq("submission_kind", "subscription")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    canManage ? supabase.from("subjects").select("id, name").order("name") : Promise.resolve({ data: [] }),
    canManage
      ? supabase
          .from("payment_submissions")
          .select("id, status, amount_due_minor_units, currency, app_reference, discipline_teacher_id, discipline_subject_id, subjects:discipline_subject_id(name)")
          .eq("organization_id", orgId)
          .eq("submission_kind", "discipline_addition")
          .in("status", ["pending_review", "rejected"])
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  // `organization_members.user_id` référence `auth.users`, pas `profiles`
  // (pas de FK directe) : PostgREST ne peut donc pas embarquer `profiles`
  // dans le select ci-dessus. On récupère les noms séparément, comme dans
  // classes/page.tsx.
  const memberUserIds = (members ?? []).map((m) => m.user_id);
  const { data: memberProfiles } = memberUserIds.length > 0
    ? await supabase.from("profiles").select("id, full_name").in("id", memberUserIds)
    : { data: null };
  const memberNameById = new Map((memberProfiles ?? []).map((p) => [p.id, p.full_name]));

  // EF-ETAB-02 : classes laissées sans professeur (retrait d'un ancien
  // titulaire) — permet de proposer une invitation ciblée dessus.
  const { data: unassignedClasses } = canManage
    ? await supabase
        .from("classes")
        .select("id, name, education_levels(name)")
        .eq("organization_id", orgId)
        .is("teacher_id", null)
        .is("archived_at", null)
    : { data: [] };

  const wave = getWaveInstructions();
  const pendingSubmission = lastSubmission && lastSubmission.status === "pending_review" ? lastSubmission : null;
  const rejectedSubmission = lastSubmission && lastSubmission.status === "rejected" ? lastSubmission : null;

  // Statut du supplément par invitation (pour affichage : à payer / en
  // attente de validation / pas concerné), récupéré séparément des
  // paiements d'abonnement classiques (submission_kind='seat_addition').
  const seatPaymentIds = (invitations ?? [])
    .map((inv) => inv.seat_payment_submission_id)
    .filter((id: string | null): id is string => !!id);
  const { data: seatSubmissions } = canManage && seatPaymentIds.length > 0
    ? await supabase
        .from("payment_submissions")
        .select("id, status, amount_due_minor_units, currency, app_reference, pricing_tier")
        .in("id", seatPaymentIds)
    : { data: null };
  const seatSubmissionById = new Map((seatSubmissions ?? []).map((s) => [s.id, s]));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 font-voice text-2xl font-semibold text-foreground">
          <School size={22} className="text-primary" /> {establishment?.name ?? "Établissement"}
        </h1>
        {establishment?.city && <p className="text-sm text-muted-foreground">{establishment.city}</p>}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users size={17} className="text-primary" /> Enseignants ({(members ?? []).length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(members ?? []).map((m) => {
            const removeWithId = removeTeacherFromOrg.bind(null, m.id);
            const promoteWithId = promoteToSupervisor.bind(null, m.id);
            const canActOnThisMember = canManage && m.role !== "owner" && m.user_id !== user!.id;
            return (
              <div key={m.id} className="flex items-center justify-between rounded-lg border border-border-strong bg-background-soft px-4 py-2 text-sm">
                <span>{memberNameById.get(m.user_id) || "(nom non renseigné)"}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="default">{ROLE_LABELS[m.role] ?? m.role}</Badge>
                  {!m.accepted_at && <Badge variant="warning">Invitation en attente</Badge>}
                  {m.suspended_at && <Badge variant="danger">Suspendu</Badge>}
                  {canActOnThisMember && (
                    <>
                      {m.role !== "admin" && (
                        <form action={promoteWithId}>
                          <Button type="submit" variant="ghost" size="sm">Promouvoir superviseur</Button>
                        </form>
                      )}
                      <form action={removeWithId}>
                        <Button type="submit" variant="ghost" size="sm">Retirer</Button>
                      </form>
                    </>
                  )}
                </div>
              </div>
            );
          })}
          {(!members || members.length === 0) && <p className="text-sm text-muted-foreground">Aucun membre pour l&apos;instant.</p>}
        </CardContent>
      </Card>

      {canManage && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><CreditCard size={17} className="text-primary" /> Abonnement &amp; licences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {license.hasSubscription ? (
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{license.plan?.name}</span>
                    <Badge variant={license.subscriptionStatus === "active" ? "success" : "warning"}>
                      {SUBSCRIPTION_STATUS_LABELS[license.subscriptionStatus ?? ""] ?? license.subscriptionStatus}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground">
                    {license.seatsUsed} enseignant{license.seatsUsed > 1 ? "s" : ""} inscrit{license.seatsUsed > 1 ? "s" : ""} ou en attente
                    {license.pendingInvitationsCount > 0 && (
                      <> (dont {license.pendingInvitationsCount} invitation{license.pendingInvitationsCount > 1 ? "s" : ""} en attente)</>
                    )}
                    {license.plan?.isPerSeat && (
                      <>
                        {" "}· {(license.plan.priceMinorUnits).toLocaleString("fr-FR")} {license.plan.currency} / enseignant /{" "}
                        {license.plan.billingPeriod === "yearly" ? "an" : "mois"}
                        {license.estimatedAmountDueMinorUnits !== null && (
                          <>
                            {" "}— soit environ {license.estimatedAmountDueMinorUnits.toLocaleString("fr-FR")} {license.plan.currency} /{" "}
                            {license.plan.billingPeriod === "yearly" ? "an" : "mois"}
                          </>
                        )}
                      </>
                    )}
                  </p>
                  {license.provider === "wave" && (
                    <p className="text-xs text-muted-foreground">Abonnement actif, paiement confirmé.</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Vous n&apos;avez pas encore d&apos;abonnement actif. Réglez le plan choisi par Wave ci-dessous pour
                  pouvoir inviter vos enseignants
                  {(plans ?? [])[0] && (
                    <>
                      {" "}
                      — à partir de {(plans ?? [])[0]!.price_minor_units.toLocaleString("fr-FR")}{" "}
                      {(plans ?? [])[0]!.currency} par enseignant inscrit, sans plafond de sièges.
                    </>
                  )}
                </p>
              )}

              {pendingSubmission && (
                <p className="flex items-start gap-1.5 text-sm text-warning">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                  Paiement de {pendingSubmission.amount_due_minor_units.toLocaleString("fr-FR")}{" "}
                  {pendingSubmission.currency} déclaré le{" "}
                  {new Date(pendingSubmission.created_at).toLocaleDateString("fr-FR")} (réf.{" "}
                  {pendingSubmission.app_reference}) — nous le vérifions. Comptez quelques heures pour
                  l&apos;activation.
                </p>
              )}
              {rejectedSubmission && (
                <p className="flex items-start gap-1.5 text-sm text-danger">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                  Le dernier paiement déclaré (réf. {rejectedSubmission.app_reference}) n&apos;a pas pu être confirmé.
                  Vérifiez que le montant réglé sur Wave correspond, puis déclarez à nouveau ci-dessous.
                </p>
              )}

              {!pendingSubmission && (plans ?? []).length > 0 && (
                <form action={submitEstablishmentWavePayment} className="space-y-3 text-sm">
                  {wave.link ? (
                    <div className="space-y-2">
                      <p className="text-muted-foreground">
                        Cliquez sur le bouton ci-dessous pour payer le montant du plan choisi via Wave, puis
                        cliquez sur « J&apos;ai payé ».
                      </p>
                      <a
                        href={wave.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
                      >
                        Payer via Wave
                      </a>
                    </div>
                  ) : wave.configured ? (
                    <p className="text-muted-foreground">
                      Envoyez le montant du plan choisi sur Wave au {wave.name ? `compte ${wave.name} — ` : ""}
                      <strong className="text-foreground">{wave.phone}</strong>, puis cliquez sur « J&apos;ai payé ».
                      Une référence de suivi est générée automatiquement.
                    </p>
                  ) : (
                    <p className="flex items-start gap-1.5 text-warning">
                      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                      Les coordonnées de paiement Wave sont en cours de configuration. Contactez-nous en attendant.
                    </p>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="planCode">{license.hasSubscription ? "Changer de plan" : "Choisir un plan"}</Label>
                      <Select id="planCode" name="planCode" defaultValue={license.plan?.code ?? (plans ?? [])[0]?.code}>
                        {(plans ?? []).map((p) => (
                          <option key={p.id} value={p.code}>
                            {p.name} — {p.price_minor_units.toLocaleString("fr-FR")} {p.currency}
                            {p.is_per_seat ? ` / enseignant / ${p.billing_period === "yearly" ? "an" : "mois"}` : ` / ${p.billing_period === "yearly" ? "an" : "mois"}`}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="payerPhone">Numéro Wave utilisé (facultatif)</Label>
                      <Input id="payerPhone" name="payerPhone" type="tel" placeholder="07 00 00 00 00" />
                    </div>
                  </div>
                  <Button type="submit" disabled={!wave.configured}>
                    J&apos;ai payé
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><UserPlus size={17} className="text-primary" /> Inviter un enseignant</CardTitle>
            </CardHeader>
            <CardContent>
              {license.hasSubscription && license.hasCapacity ? (
                <form action={inviteTeacher} className="grid gap-3 sm:grid-cols-3 sm:items-end">
                  <div className="sm:col-span-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input id="email" name="email" type="email" required placeholder="enseignant@ecole.ci" />
                  </div>
                  <div>
                    <Label htmlFor="role">Rôle</Label>
                    <Select id="role" name="role" defaultValue="teacher">
                      <option value="teacher">Enseignant</option>
                      <option value="manager">Gestionnaire</option>
                      <option value="admin">Administrateur</option>
                      <option value="reader">Lecture seule</option>
                    </Select>
                  </div>
                  {(unassignedClasses ?? []).length > 0 && (
                    <div className="sm:col-span-3">
                      <Label htmlFor="classId">Assigner directement à une classe sans professeur (facultatif)</Label>
                      <Select id="classId" name="classId" defaultValue="">
                        <option value="">— Aucune (invitation générale) —</option>
                        {(unassignedClasses ?? []).map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} {c.education_levels?.name ? `(${c.education_levels.name})` : ""}
                          </option>
                        ))}
                      </Select>
                    </div>
                  )}
                  <Button type="submit" className="sm:col-span-3">Envoyer l&apos;invitation</Button>
                </form>
              ) : (
                <p className="flex items-start gap-1.5 text-sm text-warning">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                  {license.hasSubscription
                    ? `Quota de licences atteint (${license.seatsUsed}/${license.seatsLimit}). Changez de plan ci-dessus, ou annulez une invitation en attente pour libérer un siège.`
                    : "Activez un abonnement ci-dessus avant d'inviter un enseignant."}
                </p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                Un e-mail est envoyé avec un lien pour créer son compte (ou se connecter) et rejoindre
                l&apos;établissement. Rien n&apos;est actif tant que l&apos;invitation n&apos;est pas acceptée.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><BookPlus size={17} className="text-primary" /> Disciplines supplémentaires</CardTitle>
              <CardDescription>
                Chaque compte couvre gratuitement jusqu&apos;à {FREE_DISCIPLINES_PER_TEACHER} disciplines (ex.
                matière principale + EDHC). Au-delà, un supplément débloque une discipline de plus.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(members ?? []).filter((m) => m.accepted_at).length > 0 && (subjects ?? []).length > 0 ? (
                <form action={declareDisciplineSupplementFromForm} className="grid gap-3 sm:grid-cols-3 sm:items-end">
                  <div>
                    <Label htmlFor="teacherId">Enseignant</Label>
                    <Select id="teacherId" name="teacherId" required>
                      {(members ?? [])
                        .filter((m) => m.accepted_at)
                        .map((m) => (
                          <option key={m.user_id} value={m.user_id}>
                            {memberNameById.get(m.user_id) || "(nom non renseigné)"}
                          </option>
                        ))}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="subjectId">Discipline</Label>
                    <Select id="subjectId" name="subjectId" required>
                      {(subjects ?? []).map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </Select>
                  </div>
                  <Button type="submit">Déclarer le paiement</Button>
                </form>
              ) : (
                <p className="text-sm text-muted-foreground">Aucun enseignant accepté pour l&apos;instant.</p>
              )}

              {(disciplineSubmissions ?? []).length > 0 && (
                <div className="space-y-2 border-t border-border pt-3">
                  {(disciplineSubmissions ?? []).map((sub) => (
                    <div key={sub.id} className="flex items-center justify-between rounded-lg border border-border-strong px-3 py-2 text-xs">
                      <span>{sub.subjects?.name ?? "Discipline"} — {sub.amount_due_minor_units.toLocaleString("fr-FR")} {sub.currency} (réf. {sub.app_reference})</span>
                      {sub.status === "pending_review" && <Badge variant="warning">Vérification en cours</Badge>}
                      {sub.status === "rejected" && <Badge variant="danger">Rejeté</Badge>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {invitations && invitations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Mail size={17} className="text-primary" /> Invitations en attente</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {invitations.map((inv) => {
                  const revokeWithId = revokeInvitation.bind(null, inv.id);
                  const seatSubmission = inv.seat_payment_submission_id
                    ? seatSubmissionById.get(inv.seat_payment_submission_id)
                    : null;

                  return (
                    <div key={inv.id} className="space-y-2 rounded-lg border border-border-strong px-4 py-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span>{inv.email} · {ROLE_LABELS[inv.role] ?? inv.role}</span>
                        <form action={revokeWithId}>
                          <Button type="submit" variant="ghost" size="sm">Annuler</Button>
                        </form>
                      </div>

                      {inv.needs_seat_payment && !seatSubmission && (
                        <form action={submitSeatAdditionWavePayment} className="flex items-center justify-between gap-2 rounded-md bg-warning-soft px-3 py-2">
                          <input type="hidden" name="invitationId" value={inv.id} />
                          <span className="text-xs text-warning">
                            Ajouté en cours de mois — supplément immédiat requis avant que cet enseignant n&apos;ait
                            pleinement accès.
                          </span>
                          <Button type="submit" size="sm">J&apos;ai payé</Button>
                        </form>
                      )}
                      {seatSubmission && seatSubmission.status === "pending_review" && (
                        <p className="text-xs text-warning">
                          Supplément de {seatSubmission.amount_due_minor_units.toLocaleString("fr-FR")}{" "}
                          {seatSubmission.currency} (réf. {seatSubmission.app_reference}) — vérification en cours.
                        </p>
                      )}
                      {seatSubmission && seatSubmission.status === "rejected" && (
                        <p className="text-xs text-danger">
                          Le supplément déclaré (réf. {seatSubmission.app_reference}) n&apos;a pas pu être confirmé.
                        </p>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

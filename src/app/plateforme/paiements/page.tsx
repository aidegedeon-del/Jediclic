import { requirePlatformAdmin } from "@/lib/payments/platform-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck } from "lucide-react";
import { confirmPaymentSubmission, rejectPaymentSubmission, blockAccess, reactivateAccess } from "./actions";

const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  active: "Actif",
  past_due: "Paiement dû",
  canceled: "Annulé",
  expired: "Expiré / coupé",
};

// EF-PAIEMENT-01 — zone de validation manuelle des paiements Wave. Jamais
// liée depuis la sidebar ni depuis aucune page accessible à une organisation
// (§ voir src/lib/payments/platform-admin.ts) : accès uniquement par URL
// directe, pour une personne dont l'e-mail figure dans
// `PLATFORM_ADMIN_EMAILS`. Utilise le client service_role car une
// déclaration de paiement appartient à l'organisation qui l'a soumise, pas à
// la personne qui valide — RLS ne l'autoriserait pas autrement (à dessein).
export default async function PaiementsPlateformePage() {
  await requirePlatformAdmin();
  const admin = createAdminClient();

  const [{ data: submissions }, { data: subscriptions }] = await Promise.all([
    admin
      .from("payment_submissions")
      .select(
        "id, status, submission_kind, pricing_tier, amount_due_minor_units, currency, billing_period, app_reference, payer_phone, seats_snapshot, created_at, organizations(name, kind), plans(name, code)"
      )
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("subscriptions")
      .select("id, status, current_period_end, access_blocked_at, organizations(name, kind)")
      .order("current_period_end", { ascending: true })
      .limit(100),
  ]);

  const pending = (submissions ?? []).filter((s) => s.status === "pending_review");
  const treated = (submissions ?? []).filter((s) => s.status !== "pending_review");

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-8">
      <h1 className="flex items-center gap-2 font-voice text-2xl font-semibold text-foreground">
        <ShieldCheck size={22} className="text-primary" /> Paiements Wave à valider
      </h1>

      <Card>
        <CardHeader><CardTitle>En attente ({pending.length})</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {pending.length === 0 && <p className="text-sm text-muted-foreground">Rien à traiter pour l&apos;instant.</p>}
          {pending.map((s) => {
            const confirmWithId = confirmPaymentSubmission.bind(null, s.id);
            return (
              <div key={s.id} className="space-y-2 rounded-lg border border-border-strong p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">{s.organizations?.name ?? "(organisation inconnue)"}</span>
                  <Badge variant="warning">En attente</Badge>
                </div>
                <p className="text-muted-foreground">
                  {s.submission_kind === "seat_addition" ? (
                    <>Supplément — enseignant ajouté en cours de mois ({s.pricing_tier === "full" ? "tarif plein" : "demi-tarif"})</>
                  ) : (
                    <>
                      {s.plans?.name} · {s.billing_period === "yearly" ? "annuel" : "mensuel"}
                      {s.seats_snapshot !== null && <> · {s.seats_snapshot} enseignant(s)</>}
                    </>
                  )}
                  {" "}· {s.amount_due_minor_units.toLocaleString("fr-FR")} {s.currency}
                </p>
                <p>
                  Référence : <strong className="text-foreground">{s.app_reference}</strong>
                  {s.payer_phone && <> · numéro Wave : {s.payer_phone}</>}
                </p>
                <p className="text-xs text-muted-foreground">
                  Déclaré le {new Date(s.created_at).toLocaleString("fr-FR")}
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <form action={confirmWithId}>
                    <Button type="submit" size="sm">Confirmer le paiement</Button>
                  </form>
                  <form action={rejectPaymentSubmission} className="flex items-center gap-2">
                    <input type="hidden" name="submissionId" value={s.id} />
                    <Input name="note" placeholder="Motif (interne)" className="h-8 w-48 text-xs" />
                    <Button type="submit" variant="danger" size="sm">Rejeter</Button>
                  </form>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Accès des organisations</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(subscriptions ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Aucun abonnement pour l&apos;instant.</p>
          )}
          {(subscriptions ?? []).map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-lg border border-border-strong px-4 py-2 text-sm">
              <div>
                <span className="font-medium text-foreground">{s.organizations?.name ?? "(organisation inconnue)"}</span>{" "}
                <Badge variant={s.status === "active" ? "success" : "danger"}>
                  {SUBSCRIPTION_STATUS_LABELS[s.status] ?? s.status}
                </Badge>
                {s.current_period_end && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    jusqu&apos;au {new Date(s.current_period_end).toLocaleDateString("fr-FR")}
                  </span>
                )}
                {s.access_blocked_at && (
                  <span className="ml-2 text-xs text-danger">
                    coupé manuellement le {new Date(s.access_blocked_at).toLocaleDateString("fr-FR")}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {s.status === "active" ? (
                  <form action={blockAccess} className="flex items-center gap-2">
                    <input type="hidden" name="subscriptionId" value={s.id} />
                    <Input name="reason" placeholder="Motif (interne, facultatif)" className="h-8 w-40 text-xs" />
                    <Button type="submit" variant="danger" size="sm">Stopper l&apos;accès</Button>
                  </form>
                ) : (
                  <form action={reactivateAccess.bind(null, s.id)}>
                    <Button type="submit" size="sm">Réactiver</Button>
                  </form>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Historique récent</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {treated.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-lg border border-border-strong px-4 py-2 text-sm">
              <span>
                {s.organizations?.name} · {s.amount_due_minor_units.toLocaleString("fr-FR")} {s.currency}
                {s.submission_kind === "seat_addition" && <> (supplément)</>}
              </span>
              <Badge variant={s.status === "confirmed" ? "success" : "danger"}>
                {s.status === "confirmed" ? "Confirmé" : "Rejeté"}
              </Badge>
            </div>
          ))}
          {treated.length === 0 && <p className="text-sm text-muted-foreground">Aucun historique pour l&apos;instant.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

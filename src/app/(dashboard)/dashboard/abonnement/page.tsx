import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/dashboard/context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, HelpText } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Clock3, AlertTriangle, ShieldCheck } from "lucide-react";
import { getOrgLicenseStatus } from "@/lib/subscriptions/quota";
import { getWaveInstructions } from "@/lib/payments/wave";
import { submitIndividualWavePayment } from "./actions";

export default async function AbonnementPage() {
  const supabase = await createClient();
  const { membership } = await requireCurrentOrg();
  const orgId = membership.organization_id;
  const org = membership.organizations;

  if (org?.kind !== "individual_teacher") {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="font-voice text-2xl font-semibold text-foreground">Abonnement</h1>
        <Card>
          <CardContent className="pt-5 text-sm text-muted-foreground">
            La gestion de l&apos;abonnement pour un espace établissement se fait depuis la page{" "}
            <strong className="text-foreground">Établissement</strong>, pas ici.
          </CardContent>
        </Card>
      </div>
    );
  }

  const [license, { data: plans }, { data: lastSubmission }] = await Promise.all([
    getOrgLicenseStatus(orgId),
    supabase
      .from("plans")
      .select("id, code, name, price_minor_units, currency, billing_period")
      .eq("audience", "individual")
      .eq("is_active", true)
      .order("price_minor_units"),
    supabase
      .from("payment_submissions")
      .select("id, status, amount_due_minor_units, currency, billing_period, app_reference, created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const wave = getWaveInstructions();
  const pending = lastSubmission && lastSubmission.status === "pending_review" ? lastSubmission : null;
  const rejected = lastSubmission && lastSubmission.status === "rejected" ? lastSubmission : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 font-voice text-2xl font-semibold text-foreground">
          <CreditCard size={22} className="text-primary" /> Abonnement
        </h1>
        <p className="text-sm text-muted-foreground">Suivez votre formule et réglez en toute simplicité par Wave.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Votre formule</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          {license.hasSubscription ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-foreground">{license.plan?.name}</span>
              <Badge variant={license.subscriptionStatus === "active" ? "success" : "warning"}>
                {license.subscriptionStatus === "active" ? "Actif" : license.subscriptionStatus}
              </Badge>
              {license.currentPeriodEnd && (
                <span className="text-muted-foreground">
                  jusqu&apos;au {new Date(license.currentPeriodEnd).toLocaleDateString("fr-FR")}
                </span>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground">Vous n&apos;avez pas encore d&apos;abonnement actif.</p>
          )}

          {pending && (
            <p className="flex items-start gap-1.5 text-warning">
              <Clock3 size={15} className="mt-0.5 shrink-0" />
              Paiement de {pending.amount_due_minor_units.toLocaleString("fr-FR")} {pending.currency} déclaré le{" "}
              {new Date(pending.created_at).toLocaleDateString("fr-FR")} (réf. {pending.app_reference}) — nous le
              vérifions. Comptez quelques heures pour l&apos;activation.
            </p>
          )}
          {rejected && (
            <p className="flex items-start gap-1.5 text-danger">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              Le dernier paiement déclaré (réf. {rejected.app_reference}) n&apos;a pas pu être confirmé. Vérifiez le
              montant réglé sur Wave, puis déclarez à nouveau ci-dessous — ou contactez-nous si besoin.
            </p>
          )}
        </CardContent>
      </Card>

      {!pending && (plans ?? []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Régler par Wave</CardTitle>
            <CardDescription>Simple, rapide, sans carte bancaire.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {wave.link ? (
              <div className="space-y-2">
                <p className="flex items-start gap-1.5 text-foreground">
                  <ShieldCheck size={15} className="mt-0.5 shrink-0 text-success" />
                  Cliquez sur le bouton ci-dessous pour payer le montant du plan choisi via Wave, puis revenez ici
                  cliquer sur « J&apos;ai payé ».
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
              <p className="flex items-start gap-1.5 text-foreground">
                <ShieldCheck size={15} className="mt-0.5 shrink-0 text-success" />
                Envoyez le montant du plan choisi sur Wave au {wave.name ? `compte ${wave.name} — ` : ""}
                <strong>{wave.phone}</strong>, puis cliquez sur « J&apos;ai payé ». Une référence de suivi est
                générée automatiquement, vous n&apos;avez rien à noter.
              </p>
            ) : (
              <p className="flex items-start gap-1.5 text-warning">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                Les coordonnées de paiement Wave sont en cours de configuration. Contactez-nous en attendant.
              </p>
            )}

            <form action={submitIndividualWavePayment} className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="planCode">Plan</Label>
                <Select id="planCode" name="planCode" defaultValue={(plans ?? [])[0]?.code}>
                  {(plans ?? []).map((p) => (
                    <option key={p.id} value={p.code}>
                      {p.name} — {p.price_minor_units.toLocaleString("fr-FR")} {p.currency} /{" "}
                      {p.billing_period === "yearly" ? "an" : "mois"}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="payerPhone">Numéro Wave utilisé (facultatif)</Label>
                <Input id="payerPhone" name="payerPhone" type="tel" placeholder="07 00 00 00 00" />
                <HelpText>Nous aide à retrouver votre paiement plus vite.</HelpText>
              </div>
              <Button type="submit" className="sm:col-span-2" disabled={!wave.configured}>
                J&apos;ai payé
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

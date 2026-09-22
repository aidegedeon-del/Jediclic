import { requireCurrentOrg } from "@/lib/dashboard/context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert, Clock3, ArrowRight } from "lucide-react";
import Link from "next/link";

const REASON_MESSAGES: Record<string, string> = {
  org_expired:
    "Votre abonnement est arrivé à échéance (ou l'accès a été temporairement suspendu). Réglez votre abonnement pour continuer à utiliser JedicliC.",
  seat_payment_pending:
    "Votre inscription à cet établissement est en attente de validation du paiement lié à votre ajout. Cela prend généralement quelques heures.",
};

const REASON_ICON: Record<string, typeof ShieldAlert> = {
  org_expired: ShieldAlert,
  seat_payment_pending: Clock3,
};

export default async function AbonnementExpirePage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { membership } = await requireCurrentOrg();
  const org = membership.organizations;
  const { reason } = await searchParams;
  const message = REASON_MESSAGES[reason ?? ""] ?? "Votre accès est actuellement suspendu.";
  const Icon = REASON_ICON[reason ?? ""] ?? ShieldAlert;
  const showPaymentLink = reason !== "seat_payment_pending";
  const paymentHref = org?.kind === "establishment" ? "/dashboard/etablissement" : "/dashboard/abonnement";

  return (
    <main className="mx-auto flex min-h-screen max-w-lg items-center justify-center p-8" id="main-content">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {/* Icône de statut — aria-hidden, le titre texte suffit (WCAG 1.1.1) */}
            <Icon size={20} className="text-warning" aria-hidden="true" />
            Accès suspendu
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          {/* Message d'alerte — rôle alert pour lecture immédiate (WCAG 4.1.3) */}
          <p role="alert" aria-live="assertive">{message}</p>
          {showPaymentLink && (
            <Link
              href={paymentHref}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground shadow-soft transition-colors hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              Régler l&apos;abonnement
              {/* Icône décorative */}
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

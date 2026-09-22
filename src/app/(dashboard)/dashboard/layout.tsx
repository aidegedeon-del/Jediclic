import { Sidebar } from "@/components/dashboard/sidebar";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { requireCurrentOrg } from "@/lib/dashboard/context";
import { getAccessGateStatus, getRenewalReminder } from "@/lib/subscriptions/access";
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";

const ACCESS_GATE_EXEMPT_PREFIXES = ["/dashboard/abonnement", "/dashboard/etablissement"];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, membership, memberships } = await requireCurrentOrg();

  const pathname = (await headers()).get("x-pathname") ?? "";
  const isExempt = ACCESS_GATE_EXEMPT_PREFIXES.some((p) => pathname.startsWith(p));
  if (!isExempt) {
    const gate = await getAccessGateStatus(membership.organization_id, membership.id);
    if (gate.blocked) {
      redirect(`/abonnement-expire?reason=${gate.reason}`);
    }
  }

  const supabase = await createClient();
  const canManageBilling = membership.role === "owner" || membership.role === "admin";

  // Ces lectures sont indépendantes : les faire en parallèle réduit le coût réseau
  // du layout exécuté sur chaque page du dashboard.
  const [pendingInvitationResult, renewalReminder] = await Promise.all([
    user?.email
      ? supabase
          .from("invitations")
          .select("id", { count: "exact", head: true })
          .eq("email", user.email)
          .eq("status", "pending")
      : Promise.resolve({ count: 0 }),
    canManageBilling ? getRenewalReminder(membership.organization_id) : Promise.resolve(null),
  ]);
  const pendingInvitations = pendingInvitationResult.count ?? 0;
  const billingHref =
    membership.organizations?.kind === "establishment"
      ? "/dashboard/etablissement"
      : "/dashboard/abonnement";

  return (
    <div className="flex min-h-screen">
      <Sidebar
        organizations={memberships.map((m) => ({
          id: m.organization_id,
          name: m.organizations?.name ?? "Espace",
          kind: m.organizations?.kind ?? "individual_teacher",
        }))}
        currentOrganizationId={membership.organization_id}
      />
      <MobileNav
        organizations={memberships.map((m) => ({
          id: m.organization_id,
          name: m.organizations?.name ?? "Espace",
          kind: m.organizations?.kind ?? "individual_teacher",
        }))}
        currentOrganizationId={membership.organization_id}
      />
      <main className="min-w-0 flex-1 bg-background px-4 pb-24 pt-20 sm:px-6 md:px-8 md:py-8 print:bg-white print:p-0" id="main-content">
        {/* Lien "Aller au contenu" pour la navigation clavier (WCAG 2.4.1) */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-soft"
        >
          Aller au contenu principal
        </a>

        {renewalReminder && (
          /* role="alert" + aria-live pour lecture immédiate par les AT (WCAG 4.1.3) */
          <Link
            href={billingHref}
            role="alert"
            aria-live="assertive"
            className="mb-6 flex items-center justify-between gap-3 rounded-lg border border-warning/25 bg-warning-soft px-4 py-3 text-sm text-warning transition-colors hover:bg-warning/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 print:hidden"
          >
            <span>
              {renewalReminder.daysRemaining === 0
                ? "Votre abonnement expire aujourd'hui"
                : `Votre abonnement expire dans ${renewalReminder.daysRemaining} jour${renewalReminder.daysRemaining > 1 ? "s" : ""}`}{" "}
              — renouvelez-le pour continuer sans interruption.
            </span>
            <span className="whitespace-nowrap font-medium underline">Renouveler</span>
          </Link>
        )}
        {!!pendingInvitations && pendingInvitations > 0 && (
          <Link
            href="/dashboard/invitations"
            role="alert"
            aria-live="polite"
            className="mb-6 flex items-center justify-between gap-3 rounded-lg border border-warning/25 bg-warning-soft px-4 py-3 text-sm text-warning transition-colors hover:bg-warning/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 print:hidden"
          >
            <span>
              Vous avez {pendingInvitations} invitation{pendingInvitations > 1 ? "s" : ""} en attente.
            </span>
            <span className="whitespace-nowrap font-medium underline">Voir</span>
          </Link>
        )}
        {children}
      </main>
    </div>
  );
}

"use client";

import { useTransition } from "react";
import { switchOrganization } from "@/lib/dashboard/actions";

interface OrgOption {
  id: string;
  name: string;
  kind: string;
}

export function OrgSwitcher({
  organizations,
  currentOrganizationId,
}: {
  organizations: OrgOption[];
  currentOrganizationId?: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="mb-4 px-2">
      {/* Label explicitement relié au select via htmlFor (WCAG 1.3.1) */}
      <label
        htmlFor="org-switcher-select"
        className="mb-1 block text-xs font-medium text-muted-foreground"
      >
        Espace actif
      </label>
      <select
        id="org-switcher-select"
        value={currentOrganizationId}
        disabled={isPending}
        aria-busy={isPending}
        onChange={(e) => {
          const organizationId = e.target.value;
          startTransition(() => {
            switchOrganization(organizationId);
          });
        }}
        className="h-11 w-full rounded-lg border border-border-strong bg-background-soft px-2 text-sm outline-none transition-shadow focus:border-accent/50 focus:ring-2 focus:ring-accent/20 disabled:opacity-60"
      >
        {organizations.map((org) => (
          <option key={org.id} value={org.id}>
            {org.name}
            {org.kind === "establishment" ? " (établissement)" : " (individuel)"}
          </option>
        ))}
      </select>
      {/* Annonce le changement d'espace aux lecteurs d'écran (WCAG 4.1.3) */}
      {isPending && (
        <p role="status" aria-live="polite" className="sr-only">
          Changement d&apos;espace en cours…
        </p>
      )}
    </div>
  );
}

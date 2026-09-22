"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X, LayoutDashboard, Users, GraduationCap, CalendarDays, ClipboardList, FileText, Award, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { OrgSwitcher } from "@/components/dashboard/org-switcher";

const primaryLinks = [
  { href: "/dashboard", label: "Aujourd'hui", icon: LayoutDashboard },
  { href: "/dashboard/classes", label: "Classes", icon: Users },
  { href: "/dashboard/eleves", label: "Élèves", icon: GraduationCap },
  { href: "/dashboard/emploi-du-temps", label: "Emploi du temps", icon: CalendarDays },
  { href: "/dashboard/evaluations", label: "Évaluations", icon: ClipboardList },
  { href: "/dashboard/notes", label: "Notes", icon: FileText },
  { href: "/dashboard/bulletins", label: "Bulletins", icon: Award },
];

const allLinks = [
  ...primaryLinks,
  { href: "/dashboard/calendrier", label: "Calendrier scolaire", icon: CalendarDays },
  { href: "/dashboard/programme", label: "Programme & progression", icon: FileText },
  { href: "/dashboard/analyse", label: "Analyse & remédiation", icon: FileText },
  { href: "/dashboard/archives", label: "Archives", icon: FileText },
  { href: "/dashboard/documents", label: "Documents", icon: FileText },
  { href: "/dashboard/generer", label: "Générer du contenu", icon: FileText },
  { href: "/dashboard/assistant", label: "Assistant pédagogique", icon: FileText },
  { href: "/dashboard/abonnement", label: "Abonnement", icon: FileText },
  { href: "/dashboard/etablissement", label: "Établissement", icon: FileText },
  { href: "/dashboard/invitations", label: "Mes invitations", icon: FileText },
  { href: "/dashboard/audit", label: "Journal d'audit", icon: FileText },
];

interface OrgOption {
  id: string;
  name: string;
  kind: string;
}

export function MobileNav({ organizations = [], currentOrganizationId }: { organizations?: OrgOption[]; currentOrganizationId?: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);
  const isActive = (href: string) => href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-border bg-card/95 px-4 backdrop-blur md:hidden print:hidden">
        <Link href="/dashboard" onClick={close} className="flex min-h-11 items-center gap-2 rounded-md px-1" aria-label="JedicliC — Tableau de bord">
          <Image src="/icon-192.png" alt="" width={28} height={28} className="rounded-md" />
          <span className="font-voice text-lg font-semibold text-primary">JedicliC</span>
        </Link>
        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border-strong bg-card text-foreground shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={open}
          aria-controls="mobile-navigation"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
        </button>
      </header>

      <nav className="fixed bottom-0 inset-x-0 z-30 grid grid-cols-5 border-t border-border bg-card/95 backdrop-blur md:hidden print:hidden" aria-label="Navigation rapide">
        {primaryLinks.slice(0, 4).map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(href) ? "page" : undefined}
            className={cn("flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium", isActive(href) ? "text-primary" : "text-muted-foreground")}
          >
            <Icon size={19} aria-hidden="true" />
            <span className="max-w-full truncate">{label}</span>
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
          aria-label="Ouvrir toutes les rubriques"
        >
          <MoreHorizontal size={19} aria-hidden="true" />
          <span>Plus</span>
        </button>
      </nav>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden print:hidden" role="presentation">
          <button type="button" aria-label="Fermer le menu" className="absolute inset-0 bg-foreground/40" onClick={close} />
          <aside id="mobile-navigation" className="absolute inset-y-0 left-0 flex w-[min(88vw,22rem)] max-w-full flex-col overflow-y-auto border-r border-border bg-card p-4 shadow-soft-lg" aria-label="Navigation principale">
            <div className="mb-4 flex items-center justify-between">
              <Link href="/dashboard" onClick={close} className="flex min-h-11 items-center gap-2 rounded-md" aria-label="JedicliC — Retour au tableau de bord">
                <Image src="/icon-192.png" alt="" width={28} height={28} className="rounded-md" />
                <span className="font-voice text-xl font-semibold text-primary">JedicliC</span>
              </Link>
              <button type="button" onClick={close} className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border-strong" aria-label="Fermer le menu">
                <X size={21} aria-hidden="true" />
              </button>
            </div>

            {organizations.length > 1 && <OrgSwitcher organizations={organizations} currentOrganizationId={currentOrganizationId} />}

            <div className="flex flex-col gap-1 pb-6">
              {allLinks.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={close}
                  aria-current={isActive(href) ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-lg border-l-[3px] px-3 py-2 text-sm font-medium",
                    isActive(href) ? "border-accent bg-primary/6 text-primary" : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon size={18} aria-hidden="true" />
                  <span>{label}</span>
                </Link>
              ))}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { OrgSwitcher } from "@/components/dashboard/org-switcher";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  FileText,
  Lightbulb,
  Building2,
  Mail,
  Sparkles,
  MessageSquare,
  Award,
  FolderOpen,
  ShieldCheck,
  CreditCard,
  Archive,
} from "lucide-react";

const links = [
  { href: "/dashboard", label: "Aujourd'hui", icon: LayoutDashboard },
  { href: "/dashboard/classes", label: "Classes", icon: Users },
  { href: "/dashboard/eleves", label: "Élèves", icon: GraduationCap },
  { href: "/dashboard/emploi-du-temps", label: "Emploi du temps", icon: CalendarDays },
  { href: "/dashboard/calendrier", label: "Calendrier scolaire", icon: CalendarDays },
  { href: "/dashboard/programme", label: "Programme & progression", icon: BookOpen },
  { href: "/dashboard/evaluations", label: "Évaluations", icon: ClipboardList },
  { href: "/dashboard/notes", label: "Notes", icon: FileText },
  { href: "/dashboard/bulletins", label: "Bulletins", icon: Award },
  { href: "/dashboard/analyse", label: "Analyse & remédiation", icon: Lightbulb },
  { href: "/dashboard/archives", label: "Archives", icon: Archive },
  { href: "/dashboard/documents", label: "Documents", icon: FolderOpen },
  { href: "/dashboard/generer", label: "Générer du contenu", icon: Sparkles },
  { href: "/dashboard/assistant", label: "Assistant pédagogique", icon: MessageSquare },
  { href: "/dashboard/abonnement", label: "Abonnement", icon: CreditCard },
  { href: "/dashboard/etablissement", label: "Établissement", icon: Building2 },
  { href: "/dashboard/invitations", label: "Mes invitations", icon: Mail },
  { href: "/dashboard/audit", label: "Journal d'audit", icon: ShieldCheck },
];

interface OrgOption {
  id: string;
  name: string;
  kind: string;
}

export function Sidebar({
  organizations = [],
  currentOrganizationId,
}: {
  organizations?: OrgOption[];
  currentOrganizationId?: string;
} = {}) {
  const pathname = usePathname();
  return (
    // nav avec aria-label pour distinguer la navigation principale
    // print:hidden conservé
    <nav
      aria-label="Navigation principale"
      className="hidden h-full w-64 shrink-0 flex-col gap-0.5 md:flex overflow-y-auto border-r border-border bg-card p-4 print:hidden"
    >
      {/* Logo — alt vide car le texte JedicliC suit directement */}
      <Link
        href="/dashboard"
        className="mb-5 flex items-center gap-2 px-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        aria-label="JedicliC — Retour au tableau de bord"
      >
        <Image src="/icon-192.png" alt="" width={26} height={26} className="rounded-md" />
        <span className="font-voice text-xl font-semibold text-primary">JedicliC</span>
      </Link>

      {organizations.length > 1 && (
        <OrgSwitcher
          organizations={organizations}
          currentOrganizationId={currentOrganizationId}
        />
      )}

      {links.map(({ href, label, icon: Icon }) => {
        // Correspondance active : exact pour /dashboard, préfixe pour les sous-pages
        const active =
          href === "/dashboard" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            // aria-current="page" signale la page active aux lecteurs d'écran (WCAG 2.4.8)
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg border-l-[3px] px-3 py-2 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1",
              active
                ? "border-accent bg-primary/6 text-primary"
                : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {/* Icônes décoratives : aria-hidden pour ne pas polluer les lecteurs d'écran */}
            <Icon size={17} strokeWidth={active ? 2.25 : 2} aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

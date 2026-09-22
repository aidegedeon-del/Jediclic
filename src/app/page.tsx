import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  ClipboardCheck,
  FileText,
  Award,
  Lightbulb,
  MessageSquare,
  ShieldCheck,
  Clock,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

const modules = [
  {
    icon: BookOpen,
    title: "Programme & progression",
    description:
      "Le référentiel officiel DPFC, chapitre par chapitre. Vous voyez d'un coup d'œil où vous en êtes vraiment par rapport à ce qui est attendu.",
  },
  {
    icon: ClipboardCheck,
    title: "Évaluations",
    description:
      "Devoirs et interrogations organisés par classe. Barèmes et coefficients calculés pour vous, aucune formule à refaire à la main.",
  },
  {
    icon: FileText,
    title: "Notes & moyennes",
    description:
      "Saisissez les notes, les moyennes pondérées sortent seules. Fini les tableaux Excel qui se désynchronisent d'une classe à l'autre.",
  },
  {
    icon: Award,
    title: "Bulletins",
    description:
      "Moyenne de période, rang, appréciation proposée à partir des résultats réels — vous relisez, vous validez, vous imprimez.",
  },
  {
    icon: Lightbulb,
    title: "Analyse & remédiation",
    description:
      "Les chapitres où la classe a décroché, les élèves qui ont besoin d'un coup de pouce. Repérés pour vous, pas devinés.",
  },
  {
    icon: MessageSquare,
    title: "Assistant pédagogique",
    description:
      "Décrivez ce qu'il vous faut en une phrase : un cours, un exercice, une remédiation — préparé à partir de vos propres classes.",
  },
];

const steps = [
  {
    number: "01",
    title: "Vous créez votre espace",
    description: "Deux minutes, aucune carte bancaire requise pour commencer à explorer.",
  },
  {
    number: "02",
    title: "Vous chargez vos classes",
    description: "Élèves, emploi du temps : à la main, ou en important une photo, un fichier, un PDF déjà existant.",
  },
  {
    number: "03",
    title: "Vous travaillez, JedicliC organise",
    description: "Notes, moyennes, bulletins et progression se tiennent à jour tout seuls, jour après jour.",
  },
];

const reassurances = [
  {
    icon: ShieldCheck,
    title: "Vos données, jamais partagées",
    description: "Vos classes, vos notes et vos élèves n'appartiennent qu'à vous. Rien n'est cédé à un tiers.",
  },
  {
    icon: CheckCircle2,
    title: "Toujours le dernier mot",
    description: "Ce que propose l'assistant reste une proposition. Aucune note, aucune appréciation n'est validée sans vous.",
  },
  {
    icon: Clock,
    title: "Pensé pour votre emploi du temps",
    description: "Les gestes du quotidien — corriger, noter, préparer — prennent des secondes, pas des soirées.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Lien "Aller au contenu" — premier élément focusable (WCAG 2.4.1) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-soft"
      >
        Aller au contenu principal
      </a>

      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
          {/* Logo — texte JedicliC suffit, l'image est décorative */}
          <Link
            href="/"
            aria-label="JedicliC — Accueil"
            className="flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            <Image src="/icon-192.png" alt="" width={24} height={24} className="rounded-md" priority />
            <span className="font-voice text-lg font-semibold text-primary">JedicliC</span>
          </Link>

          {/* Navigation principale (desktop) — aria-label pour la distinguer (WCAG 2.4.6) */}
          <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex" aria-label="Navigation du site">
            <a
              href="#modules"
              className="transition-colors hover:text-foreground rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
            >
              Fonctionnalités
            </a>
            <a
              href="#comment-ca-marche"
              className="transition-colors hover:text-foreground rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
            >
              Comment ça marche
            </a>
            <a
              href="#confiance"
              className="transition-colors hover:text-foreground rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
            >
              Sécurité
            </a>
          </nav>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-foreground hover:text-primary rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
            >
              Se connecter
            </Link>
            <Link
              href="/signup"
              className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              <Button size="sm" tabIndex={-1} aria-hidden="true">Créer mon compte</Button>
            </Link>
          </div>
        </div>
      </header>

      <main id="main-content">
        {/* Hero */}
        <section aria-labelledby="hero-heading" className="relative overflow-hidden">
          <div className="ruled-lines pointer-events-none absolute inset-0 opacity-[0.35]" aria-hidden="true" />
          <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-16 px-6 py-20 md:grid-cols-5 md:py-28">
            <div className="md:col-span-3">
              <Badge variant="official" className="mb-5">Conçu pour le système éducatif ivoirien</Badge>
              <h1
                id="hero-heading"
                className="marge pl-6 font-voice text-4xl font-semibold leading-[1.1] text-foreground sm:text-5xl"
              >
                Toute votre année scolaire, enfin dans un seul cahier.
              </h1>
              <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground">
                Programme officiel, classes, évaluations, notes, bulletins et remédiation réunis au même endroit —
                pour que vous passiez moins de temps à chercher, et plus de temps à enseigner.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/signup"
                  className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                >
                  <Button size="lg" tabIndex={-1} aria-hidden="true">
                    Créer mon compte gratuitement
                    <ArrowRight size={18} aria-hidden="true" />
                  </Button>
                </Link>
                <Link
                  href="/login"
                  className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                >
                  <Button size="lg" variant="secondary" tabIndex={-1} aria-hidden="true">
                    J&apos;ai déjà un compte
                  </Button>
                </Link>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Aucune carte bancaire nécessaire pour commencer. Vous êtes prêt en quelques minutes.
              </p>
            </div>

            {/* Démo — aria-hidden car purement décorative (WCAG 1.1.1) */}
            <div className="md:col-span-2" aria-hidden="true">
              <div className="rounded-xl border border-border bg-card p-5 shadow-soft-lg">
                <p className="mb-3 text-sm font-medium text-foreground">Aujourd&apos;hui — Lundi</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-lg border border-border bg-background-soft px-3 py-2 text-sm">
                    <span><span className="font-data text-muted-foreground">08:00–09:00</span> · 3e A · Mathématiques</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border bg-background-soft px-3 py-2 text-sm">
                    <span><span className="font-data text-muted-foreground">10:00–11:00</span> · Tle C · Mathématiques</span>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-sm">
                  <span>Suites numériques — Tle C</span>
                  <Badge variant="warning">Retard détecté — 4 j</Badge>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span>Moyenne de la classe — 3e A</span>
                  <span className="font-data font-semibold text-foreground">13,4/20</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Modules / Fonctionnalités */}
        <section
          id="modules"
          aria-labelledby="modules-heading"
          className="border-t border-border bg-card"
        >
          <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
            <div className="max-w-2xl">
              <span className="text-sm font-medium uppercase tracking-wide text-accent" aria-hidden="true">Ce que vous gagnez</span>
              <h2 id="modules-heading" className="mt-2 font-voice text-2xl font-semibold text-foreground sm:text-3xl">
                Tout ce qu&apos;il vous faut pour une classe, sans jongler entre dix outils
              </h2>
            </div>
            <ul className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3" role="list">
              {modules.map(({ icon: Icon, title, description }) => (
                <li key={title} className="group">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/8 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground" aria-hidden="true">
                    {/* Icônes purement décoratives */}
                    <Icon size={19} aria-hidden="true" />
                  </div>
                  <p className="font-voice text-base font-semibold text-foreground">{title}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Comment ça marche */}
        <section
          id="comment-ca-marche"
          aria-labelledby="steps-heading"
          className="mx-auto max-w-6xl px-6 py-16 md:py-20"
        >
          <div className="max-w-2xl">
            <span className="text-sm font-medium uppercase tracking-wide text-accent" aria-hidden="true">En pratique</span>
            <h2 id="steps-heading" className="mt-2 font-voice text-2xl font-semibold text-foreground sm:text-3xl">
              Trois étapes pour démarrer, aucune formation nécessaire
            </h2>
          </div>
          <ol className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-3">
            {steps.map((step, i) => (
              <li key={step.number} className="relative">
                {/* Numéro décoratif — aria-hidden (l'ordre de liste suffit) */}
                <span className="font-voice text-4xl font-semibold text-border-strong" aria-hidden="true">
                  {step.number}
                </span>
                <p className="mt-3 font-medium text-foreground">{step.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.description}</p>
                {i < steps.length - 1 && (
                  <ArrowRight
                    size={18}
                    className="absolute -right-6 top-2 hidden text-border-strong sm:block"
                    aria-hidden="true"
                  />
                )}
              </li>
            ))}
          </ol>
        </section>

        {/* Référentiel officiel */}
        <section aria-labelledby="referentiel-heading" className="border-t border-border bg-primary text-primary-foreground">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-8 px-6 py-16 sm:flex-row sm:items-center md:py-20">
            {/* Emblème décoratif */}
            <div
              className="flex h-24 w-24 shrink-0 rotate-[-4deg] items-center justify-center rounded-full border-2 border-accent text-center"
              aria-hidden="true"
            >
              <span className="font-voice text-xs font-semibold leading-tight">
                Référentiel<br />officiel<br />DPFC
              </span>
            </div>
            <div className="max-w-xl">
              <h2 id="referentiel-heading" className="font-voice text-xl font-semibold sm:text-2xl">
                Le programme que vous voyez est le vrai programme, jamais une approximation
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-primary-foreground/85">
                Chaque chapitre chargé dans JedicliC vient du référentiel officiel du DPFC/MENA, classe par classe et
                matière par matière. Ce que propose l&apos;assistant pédagogique reste toujours identifié comme tel,
                distinct du contenu officiel — et toujours soumis à votre validation avant d&apos;être utilisé.
              </p>
            </div>
          </div>
        </section>

        {/* Réassurance / confiance */}
        <section
          id="confiance"
          aria-labelledby="confiance-heading"
          className="mx-auto max-w-6xl px-6 py-16 md:py-20"
        >
          <div className="max-w-2xl">
            <span className="text-sm font-medium uppercase tracking-wide text-accent" aria-hidden="true">Ce qui ne change jamais</span>
            <h2 id="confiance-heading" className="mt-2 font-voice text-2xl font-semibold text-foreground sm:text-3xl">
              Un outil qui travaille pour vous, jamais à votre place
            </h2>
          </div>
          <ul className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3" role="list">
            {reassurances.map(({ icon: Icon, title, description }) => (
              <li key={title} className="rounded-xl border border-border bg-card p-6 shadow-soft">
                {/* Icône décorative */}
                <Icon size={22} className="text-accent" aria-hidden="true" />
                <p className="mt-4 font-medium text-foreground">{title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* CTA final */}
        <section aria-labelledby="cta-heading" className="border-t border-border">
          <div className="mx-auto max-w-6xl px-6 py-16 text-center md:py-24">
            <h2 id="cta-heading" className="font-voice text-2xl font-semibold text-foreground sm:text-3xl">
              Votre prochaine rentrée mérite d&apos;être plus légère
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
              Rejoignez les enseignants qui ont déjà remplacé leurs cahiers dispersés et leurs fichiers Excel par un
              seul espace clair.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/signup"
                className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              >
                <Button size="lg" tabIndex={-1} aria-hidden="true">
                  Créer mon compte gratuitement
                  <ArrowRight size={18} aria-hidden="true" />
                </Button>
              </Link>
              <Link
                href="/login"
                className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              >
                <Button size="lg" variant="secondary" tabIndex={-1} aria-hidden="true">
                  Se connecter
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground sm:flex-row">
          <span className="font-voice font-medium text-foreground">JedicliC</span>
          <span>© {new Date().getFullYear()} JedicliC — Fait pour les enseignants de Côte d&apos;Ivoire</span>
        </div>
      </footer>
    </div>
  );
}

import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { acceptInvitation, declineInvitation } from "@/lib/invitations/actions";
import { completeOnboarding } from "./actions";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: countries }, { data: invitations }] = await Promise.all([
    supabase.from("countries").select("id, name").order("name"),
    user?.email
      ? supabase
          .from("invitations")
          .select("id, role, organizations(name)")
          .eq("email", user.email)
          .eq("status", "pending")
      : Promise.resolve({ data: null }),
  ]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12" id="main-content">
      <div className="mb-6 text-center">
        <p className="flex items-center justify-center gap-2 font-voice text-lg font-semibold text-primary">
          {/* Logo décoratif */}
          <Image src="/icon-192.png" alt="" width={22} height={22} className="rounded-md" priority />
          JedicliC
        </p>
        <h1 className="mt-3 font-voice text-2xl font-semibold text-foreground">Bienvenue chez vous</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Quelques informations pour préparer votre espace de travail.
        </p>
      </div>

      {/* Invitations reçues */}
      {invitations && invitations.length > 0 && (
        <section aria-labelledby="invitations-heading" className="mb-6 space-y-3">
          <h2 id="invitations-heading" className="text-sm text-muted-foreground">
            Vous avez été invité(e) à rejoindre {invitations.length > 1 ? "ces espaces" : "cet espace"} :
          </h2>
          {invitations.map((inv) => {
            const acceptWithId = acceptInvitation.bind(null, inv.id);
            const declineWithId = declineInvitation.bind(null, inv.id);
            return (
              <Card key={inv.id}>
                <CardHeader>
                  <CardTitle>{inv.organizations?.name ?? "Établissement"}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Rôle proposé : {inv.role === "teacher" ? "enseignant" : inv.role}
                  </p>
                  <form action={acceptWithId} className="space-y-3" aria-label={`Rejoindre ${inv.organizations?.name ?? "l'établissement"}`}>
                    <div>
                      <Label htmlFor={`fullName_${inv.id}`}>Votre nom complet</Label>
                      <Input
                        id={`fullName_${inv.id}`}
                        name="fullName"
                        required
                        aria-required="true"
                        autoComplete="name"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" size="sm">Rejoindre cet espace</Button>
                    </div>
                  </form>
                  <form action={declineWithId}>
                    <Button type="submit" variant="ghost" size="sm">Refuser</Button>
                  </form>
                </CardContent>
              </Card>
            );
          })}
          <p className="pt-2 text-center text-xs text-muted-foreground">— ou créez votre propre espace ci-dessous —</p>
        </section>
      )}

      {/* Formulaire de création d'espace */}
      <Card>
        <CardHeader>
          <CardTitle>Créer mon espace</CardTitle>
          <CardDescription>Modifiable à tout moment, rien n&apos;est figé.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={completeOnboarding}
            className="space-y-4"
            aria-label="Formulaire de création de votre espace de travail"
          >
            <div>
              <Label htmlFor="fullName">Votre nom complet</Label>
              <Input
                id="fullName"
                name="fullName"
                required
                aria-required="true"
                autoComplete="name"
              />
            </div>

            {/* Groupe radio avec fieldset + legend (WCAG 1.3.1) */}
            <fieldset>
              <legend className="mb-1.5 block text-sm font-medium text-foreground/80">
                Vous êtes…
              </legend>
              <div className="space-y-2 rounded-lg border border-border-strong p-3">
                <div className="flex items-start gap-2 text-sm">
                  <input
                    id="kind-individual"
                    type="radio"
                    name="accountKind"
                    value="individual_teacher"
                    defaultChecked
                    className="mt-1 accent-accent w-4 h-4 cursor-pointer"
                  />
                  <label htmlFor="kind-individual" className="cursor-pointer">
                    <span className="block font-medium text-foreground">Un professeur, seul(e)</span>
                    <span className="block text-xs text-muted-foreground">
                      Vous gérez vos propres classes. Vous pourrez inviter des collègues plus tard si besoin.
                    </span>
                  </label>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <input
                    id="kind-establishment"
                    type="radio"
                    name="accountKind"
                    value="establishment"
                    className="mt-1 accent-accent w-4 h-4 cursor-pointer"
                  />
                  <label htmlFor="kind-establishment" className="cursor-pointer">
                    <span className="block font-medium text-foreground">Un établissement (plusieurs enseignants)</span>
                    <span className="block text-xs text-muted-foreground">
                      Vous pourrez inviter d&apos;autres enseignants à rejoindre l&apos;espace de l&apos;établissement.
                    </span>
                  </label>
                </div>
              </div>
            </fieldset>

            <div>
              <Label htmlFor="organizationName">Nom de votre espace</Label>
              <Input
                id="organizationName"
                name="organizationName"
                placeholder="Ex. : votre nom, ou le nom de l'établissement"
                required
                aria-required="true"
              />
            </div>

            <div>
              <Label htmlFor="establishmentCity">Ville de l&apos;établissement (si applicable)</Label>
              <Input id="establishmentCity" name="establishmentCity" autoComplete="address-level2" />
            </div>

            <div>
              <Label htmlFor="countryId">Pays</Label>
              <Select id="countryId" name="countryId" required aria-required="true">
                {(countries ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </div>

            <Button type="submit" className="w-full">Continuer</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

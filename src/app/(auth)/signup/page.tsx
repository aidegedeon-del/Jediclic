"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, Label, HelpText } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/onboarding");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="mb-8 flex items-center justify-center gap-2 font-voice text-xl font-semibold text-primary rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          <Image src="/icon-192.png" alt="" width={28} height={28} className="rounded-lg" priority />
          JedicliC
        </Link>
        <div className="mb-6 text-center">
          <h1 className="font-voice text-2xl font-semibold text-foreground">Créez votre espace</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Deux minutes vous suffisent pour démarrer.</p>
        </div>
        <Card>
          <CardContent className="pt-5">
            <form
              onSubmit={handleSubmit}
              className="space-y-4"
              aria-label="Formulaire de création de compte"
              noValidate
            >
              <div>
                <Label htmlFor="fullName">Nom complet</Label>
                <Input
                  id="fullName"
                  autoComplete="name"
                  required
                  aria-required="true"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  aria-describedby={error ? "signup-error" : undefined}
                />
              </div>
              <div>
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="vous@exemple.com"
                  required
                  aria-required="true"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-describedby={error ? "signup-error" : undefined}
                />
              </div>
              <div>
                <Label htmlFor="password">Mot de passe</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  aria-required="true"
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  // Lie le champ à l'aide contextuelle (WCAG 1.3.1)
                  aria-describedby="password-help"
                />
                <HelpText id="password-help">8 caractères minimum.</HelpText>
              </div>
              {/* Annonce d'erreur accessible (WCAG 3.3.1 + 4.1.3) */}
              {error && (
                <p
                  id="signup-error"
                  role="alert"
                  aria-live="assertive"
                  className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger"
                >
                  {error}
                </p>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={loading}
                aria-busy={loading}
              >
                {loading ? "Création en cours…" : "Créer mon compte"}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Aucune carte bancaire requise. Vous choisirez votre formule plus tard, tranquillement.
              </p>
            </form>
          </CardContent>
        </Card>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Déjà un compte ?{" "}
          <Link
            href="/login"
            className="font-medium text-primary hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
          >
            Connectez-vous
          </Link>
        </p>
      </div>
    </main>
  );
}

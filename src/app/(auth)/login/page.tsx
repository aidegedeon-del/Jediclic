"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError("E-mail ou mot de passe incorrect. Vérifiez et réessayez.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="mb-8 flex items-center justify-center gap-2 font-voice text-xl font-semibold text-primary rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          {/* alt="" : logo décoratif, le texte "JedicliC" suffit */}
          <Image src="/icon-192.png" alt="" width={28} height={28} className="rounded-lg" priority />
          JedicliC
        </Link>
        <div className="mb-6 text-center">
          <h1 className="font-voice text-2xl font-semibold text-foreground">Content de vous revoir</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Connectez-vous pour retrouver vos classes.</p>
        </div>
        <Card>
          <CardContent className="pt-5">
            <form
              onSubmit={handleSubmit}
              className="space-y-4"
              aria-label="Formulaire de connexion"
              noValidate
            >
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
                  // Lie le champ à l'erreur si présente (WCAG 1.3.1, 3.3.1)
                  aria-describedby={error ? "login-error" : undefined}
                  aria-invalid={error ? "true" : undefined}
                />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Mot de passe</Label>
                  <Link
                    href="/mot-de-passe-oublie"
                    className="text-xs font-medium text-primary hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
                  >
                    Mot de passe oublié ?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  aria-required="true"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-describedby={error ? "login-error" : undefined}
                  aria-invalid={error ? "true" : undefined}
                />
              </div>
              {/* role="alert" + aria-live : annonce immédiate aux lecteurs d'écran (WCAG 4.1.3) */}
              {error && (
                <p
                  id="login-error"
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
                {loading ? "Connexion en cours…" : "Se connecter"}
              </Button>
            </form>
          </CardContent>
        </Card>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Pas encore de compte ?{" "}
          <Link
            href="/signup"
            className="font-medium text-primary hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
          >
            Créez-le en deux minutes
          </Link>
        </p>
      </div>
    </main>
  );
}

"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";

export default function ResetPasswordPage() {
  const router = useRouter();
  // useMemo : createClient() renvoie une nouvelle instance à chaque appel ;
  // on la stabilise pour pouvoir la déclarer sans risque dans les deps du useEffect ci-dessous.
  const supabase = useMemo(() => createClient(), []);
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasValidSession, setHasValidSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setHasValidSession(!!data.user);
      setCheckingSession(false);
    });
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError("Impossible de mettre à jour le mot de passe. Le lien a peut-être expiré — redemandez-en un nouveau.");
      return;
    }
    setDone(true);
    setTimeout(() => {
      router.push("/dashboard");
      router.refresh();
    }, 1500);
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
          <h1 className="font-voice text-2xl font-semibold text-foreground">Nouveau mot de passe</h1>
        </div>
        <Card>
          <CardContent className="pt-5">
            {checkingSession ? (
              /* aria-live polite : annonce discrète (WCAG 4.1.3) */
              <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
                Vérification du lien…
              </p>
            ) : !hasValidSession ? (
              <div className="space-y-3">
                <p
                  role="alert"
                  aria-live="assertive"
                  className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger"
                >
                  Ce lien de réinitialisation est invalide ou a expiré.
                </p>
                <Link
                  href="/mot-de-passe-oublie"
                  className="text-sm font-medium text-primary hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
                >
                  Redemander un lien
                </Link>
              </div>
            ) : done ? (
              <div
                role="status"
                aria-live="polite"
                className="flex items-center gap-2 rounded-lg bg-success-soft px-3 py-2 text-sm text-success"
              >
                {/* Icône décorative */}
                <CheckCircle2 size={16} aria-hidden="true" />
                Mot de passe mis à jour. Redirection en cours…
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="space-y-4"
                aria-label="Formulaire de nouveau mot de passe"
                noValidate
              >
                <div>
                  <Label htmlFor="password">Nouveau mot de passe</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    aria-required="true"
                    minLength={8}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    aria-describedby={error ? "reset-error" : undefined}
                    aria-invalid={error ? "true" : undefined}
                  />
                </div>
                <div>
                  <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    required
                    aria-required="true"
                    minLength={8}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    aria-describedby={error ? "reset-error" : undefined}
                    aria-invalid={error ? "true" : undefined}
                  />
                </div>
                {error && (
                  <p
                    id="reset-error"
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
                  {loading ? "Mise à jour…" : "Mettre à jour le mot de passe"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

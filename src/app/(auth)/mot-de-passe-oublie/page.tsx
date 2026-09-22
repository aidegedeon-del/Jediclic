"use client";

import Image from "next/image";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { MailCheck } from "lucide-react";

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setLoading(false);
    setSent(true);
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
          <h1 className="font-voice text-2xl font-semibold text-foreground">Mot de passe oublié</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Ça arrive à tout le monde. On vous aide à repartir.</p>
        </div>
        <Card>
          <CardContent className="pt-5">
            {sent ? (
              /* role="status" + aria-live pour annonce aux lecteurs d'écran (WCAG 4.1.3) */
              <div
                role="status"
                aria-live="polite"
                className="space-y-3 text-center"
              >
                {/* Icône décorative, aria-hidden */}
                <MailCheck className="mx-auto text-accent" size={28} aria-hidden="true" />
                <p className="text-sm text-muted-foreground">
                  Si un compte existe avec l&apos;adresse{" "}
                  <strong className="text-foreground">{email}</strong>, un lien de réinitialisation
                  vient de lui être envoyé. Pensez à vérifier vos spams.
                </p>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="space-y-4"
                aria-label="Formulaire de réinitialisation du mot de passe"
                noValidate
              >
                <div>
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    aria-required="true"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading || !email}
                  aria-busy={loading}
                >
                  {loading ? "Envoi en cours…" : "Envoyer le lien de réinitialisation"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link
            href="/login"
            className="font-medium text-primary hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
          >
            ← Retour à la connexion
          </Link>
        </p>
      </div>
    </main>
  );
}

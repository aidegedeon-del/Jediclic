import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/dashboard/context";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageCircle, Sparkles } from "lucide-react";
import { sendAssistantMessage } from "./actions";

const EXAMPLES = [
  "Prépare mon cours de demain pour ma 3e A.",
  "Génère une interrogation sur le chapitre que nous venons de terminer.",
  "Quels sont les élèves qui ont le plus de difficultés en 3e A ?",
  "Je suis en retard sur ma progression en 3e A, que dois-je faire ?",
  "Prépare une remédiation pour la 3e A.",
];

export default async function AssistantPage() {
  const supabase = await createClient();
  const { membership } = await requireCurrentOrg();

  const { data: messages } = await supabase
    .from("assistant_messages")
    .select("id, role, content, created_at, metadata")
    .eq("organization_id", membership.organization_id)
    .order("created_at", { ascending: true })
    .limit(50);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 font-voice text-2xl font-semibold text-foreground">
          {/* Icône décorative */}
          <MessageCircle size={22} className="text-accent" aria-hidden="true" />
          Assistant pédagogique
          <Badge variant="ai" aria-label="Fonctionnalité assistée par intelligence artificielle">IA</Badge>
        </h1>
        <p className="text-sm text-muted-foreground">
          Décrivez ce dont vous avez besoin, en langage naturel. L&apos;assistant prépare un brouillon ou répond à
          partir de vos données déjà enregistrées — jamais de note, d&apos;élève ou de règle inventée.
        </p>
      </div>

      {(!messages || messages.length === 0) && (
        <Card>
          <CardContent className="space-y-2 pt-5">
            <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              {/* Icône décorative */}
              <Sparkles size={14} className="text-accent" aria-hidden="true" />
              Quelques idées pour commencer :
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {EXAMPLES.map((ex) => (
                <li key={ex}>{ex}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Conversation — région live pour les nouvelles réponses (WCAG 4.1.3) */}
      <div
        className="space-y-3"
        role="log"
        aria-label="Conversation avec l'assistant pédagogique"
        aria-live="polite"
        aria-relevant="additions"
      >
        {(messages ?? []).map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] whitespace-pre-wrap rounded-xl px-4 py-2 text-sm ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground"
              }`}
              // Distingue le rôle pour les lecteurs d'écran (WCAG 1.3.1)
              aria-label={m.role === "user" ? "Vous" : "Assistant"}
            >
              {m.content}
            </div>
          </div>
        ))}
      </div>

      {/* Formulaire de saisie — sticky en bas */}
      <form
        action={sendAssistantMessage}
        className="sticky bottom-4 flex gap-2 rounded-xl border border-border-strong bg-card p-2 shadow-soft"
        aria-label="Envoyer un message à l'assistant"
      >
        {/* Label visible en sr-only + placeholder visible (WCAG 1.3.1, 2.4.6) */}
        <label htmlFor="assistant-message" className="sr-only">
          Votre message à l&apos;assistant pédagogique
        </label>
        <input
          id="assistant-message"
          name="message"
          autoComplete="off"
          placeholder="Écrivez votre demande..."
          className="h-10 flex-1 rounded-md border-none bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground/70 focus:ring-2 focus:ring-accent/20"
        />
        <Button type="submit">Envoyer</Button>
      </form>
    </div>
  );
}

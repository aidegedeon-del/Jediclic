import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/dashboard/context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ScrollText } from "lucide-react";

const ACTION_LABELS: Record<string, string> = {
  "result.update": "Note modifiée",
  "assessment.publish": "Évaluation publiée",
  "assessment.unpublish": "Évaluation dépubliée",
  "assessment.delete": "Évaluation supprimée",
  "lesson.delete": "Cours/devoir supprimé",
  "exercise.delete": "Exercice supprimé",
  "invitation.role_set": "Rôle défini (invitation)",
  "invitation.revoke": "Invitation annulée",
  "member.role_assign": "Rôle attribué (membre)",
};

const ACTION_BADGE: Record<string, "danger" | "warning" | "default" | "success"> = {
  "result.update": "default",
  "assessment.publish": "success",
  "assessment.unpublish": "warning",
  "assessment.delete": "danger",
  "lesson.delete": "danger",
  "exercise.delete": "danger",
  "invitation.role_set": "warning",
  "invitation.revoke": "danger",
  "member.role_assign": "warning",
};

export default async function AuditPage() {
  const supabase = await createClient();
  const { membership } = await requireCurrentOrg();
  const canView = membership.role === "owner" || membership.role === "admin";

  if (!canView) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="font-voice text-2xl font-semibold text-foreground">Journal d&apos;audit</h1>
        <Card>
          <CardContent className="flex items-start gap-2 pt-5 text-sm text-muted-foreground">
            {/* Icône décorative */}
            <ShieldCheck size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            Le journal d&apos;audit n&apos;est visible que par les propriétaires et administrateurs de l&apos;espace.
          </CardContent>
        </Card>
      </div>
    );
  }

  const { data: logs } = await supabase
    .from("audit_logs")
    .select("id, action, entity_table, entity_id, before_data, after_data, created_at, actor_id")
    .eq("organization_id", membership.organization_id)
    .order("created_at", { ascending: false })
    .limit(200);

  // `audit_logs.actor_id` référence `auth.users`, pas `profiles` (pas de FK
  // directe) : PostgREST ne peut donc pas embarquer `profiles` dans le
  // select ci-dessus. On récupère les noms séparément, comme dans
  // classes/page.tsx et etablissement/page.tsx.
  const actorIds = Array.from(
    new Set((logs ?? []).map((l) => l.actor_id).filter((id): id is string => !!id))
  );
  const { data: actorProfiles } = actorIds.length > 0
    ? await supabase.from("profiles").select("id, full_name").in("id", actorIds)
    : { data: null };
  const actorNameById = new Map((actorProfiles ?? []).map((p) => [p.id, p.full_name]));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 font-voice text-2xl font-semibold text-foreground">
          {/* Icône décorative */}
          <ScrollText size={22} className="text-primary" aria-hidden="true" />
          Journal d&apos;audit
        </h1>
        <p className="text-sm text-muted-foreground">
          Chaque opération sensible — modification de note, suppression, changement de rôle — est tracée ici. 200
          entrées les plus récentes.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historique</CardTitle>
          <CardDescription>{(logs ?? []).length} entrée(s).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {(logs ?? []).length > 0 ? (
            /* Liste explicite pour AT (WCAG 1.3.1) */
            <ul role="list" className="space-y-2">
              {(logs ?? []).map((log) => (
                <li key={log.id} className="rounded-lg border border-border-strong px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={ACTION_BADGE[log.action] ?? "default"}>
                        {ACTION_LABELS[log.action] ?? log.action}
                      </Badge>
                      <span className="text-muted-foreground">
                        par {(log.actor_id && actorNameById.get(log.actor_id)) || "(utilisateur supprimé)"}
                      </span>
                    </div>
                    {/* time avec datetime pour les AT (WCAG 1.3.1) */}
                    <time
                      dateTime={log.created_at}
                      className="font-data text-xs text-muted-foreground"
                    >
                      {new Date(log.created_at).toLocaleString("fr-FR")}
                    </time>
                  </div>
                  {(log.before_data || log.after_data) && (
                    <div className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                      {log.before_data && (
                        <div>
                          <span className="font-medium text-foreground">Avant : </span>
                          <code className="break-words">{JSON.stringify(log.before_data)}</code>
                        </div>
                      )}
                      {log.after_data && (
                        <div>
                          <span className="font-medium text-foreground">Après : </span>
                          <code className="break-words">{JSON.stringify(log.after_data)}</code>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground" role="status">
              Aucune opération journalisée pour l&apos;instant.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

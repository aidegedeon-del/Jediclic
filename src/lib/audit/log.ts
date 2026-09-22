import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/types/database.types";

// EF-AUDIT-01 (Convention §30) : les opérations sensibles doivent être
// journalisées — exemples donnés par la Convention : modification d'une
// note, suppression, changement de rôle, changement de permission, action
// administrative importante. Ce module est le point d'entrée unique pour
// écrire dans `audit_logs`, pour ne jamais avoir deux façons différentes de
// journaliser qui divergent.
//
// Écrit via le client `service_role` (comme les invitations, cf.
// src/lib/supabase/admin.ts) : la RLS sur `audit_logs` n'autorise aucun
// INSERT côté client authentifié (migration 0006, commentaire
// "Les inserts d'audit passent par des fonctions/serveur"), justement pour
// qu'un utilisateur ne puisse jamais falsifier ou effacer sa propre trace.
//
// Best-effort volontaire : une panne de journalisation ne doit jamais faire
// échouer l'action métier elle-même (ex. empêcher un professeur de saisir
// une note parce que l'audit est indisponible serait pire que l'absence de
// trace) — même principe déjà adopté pour l'échec d'envoi d'e-mail
// d'invitation (etablissement/actions.ts). L'erreur est journalisée côté
// serveur (console.error) pour rester détectable en production.
export type AuditAction =
  | "result.update"
  | "assessment.publish"
  | "assessment.unpublish"
  | "assessment.delete"
  | "lesson.delete"
  | "exercise.delete"
  | "invitation.role_set"
  | "invitation.revoke"
  | "member.role_assign"
  | "member.remove"
  | "subscription.plan_select"
  | "payment_submission.create"
  | "payment_submission.confirm"
  | "payment_submission.reject"
  | "subscription.access_block"
  | "subscription.access_reactivate";

export interface AuditLogInput {
  organizationId: string;
  actorId: string | null;
  action: AuditAction;
  entityTable: string;
  entityId?: string | null;
  // Doit rester sérialisable en JSON : ces valeurs sont écrites directement
  // dans les colonnes JSONB `before_data`/`after_data` de `audit_logs`.
  beforeData?: Json | null;
  afterData?: Json | null;
}

export async function logAudit(input: AuditLogInput): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("audit_logs").insert({
      organization_id: input.organizationId,
      actor_id: input.actorId,
      action: input.action,
      entity_table: input.entityTable,
      entity_id: input.entityId ?? null,
      before_data: input.beforeData ?? null,
      after_data: input.afterData ?? null,
    });
    if (error) {
      console.error(`[audit] échec d'écriture (${input.action} sur ${input.entityTable}) :`, error.message);
    }
  } catch (err) {
    // ex. SUPABASE_SERVICE_ROLE_KEY manquante en local (cf. admin.ts) —
    // ne jamais bloquer l'action métier pour autant.
    console.error(`[audit] exception lors de l'écriture (${input.action}) :`, err);
  }
}

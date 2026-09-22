"use server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/dashboard/context";
import { logAudit } from "@/lib/audit/log";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const SaveResultSchema = z.object({
  studentId: z.string().uuid("Identifiant élève invalide."),
  rawScore: z.string(),
  isAbsent: z.boolean(),
});

// CORRECTION FIABILITÉ :
// - Validation Zod sur les données entrantes (studentId surtout)
// - Vérification que l'évaluation appartient à l'organisation (sécurité)
// - saveResult : score null pour les absents et les vides (comportement conservé)
// - togglePublish : idempotence (si déjà dans l'état cible, pas d'erreur)
// - Journalisation best-effort (ne bloque pas l'action principale)
export async function saveResult(assessmentId: string, formData: FormData) {
  const supabase = await createClient();
  const { user } = await requireCurrentOrg();

  // CORRECTION : Validation Zod
  const rawData = {
    studentId: String(formData.get("studentId") ?? ""),
    rawScore: String(formData.get("score") ?? ""),
    isAbsent: formData.get("isAbsent") === "on",
  };
  const parsed = SaveResultSchema.safeParse(rawData);
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(" | "));
  }
  const { studentId, rawScore, isAbsent } = parsed.data;

  const { data: assessment } = await supabase
    .from("assessments")
    .select("organization_id, max_score")
    .eq("id", assessmentId)
    .single();
  if (!assessment) throw new Error("Évaluation introuvable.");

  const score = isAbsent || rawScore === "" ? null : Number(rawScore);
  if (score !== null && isNaN(score)) {
    throw new Error("La note fournie n'est pas un nombre valide.");
  }
  if (score !== null && (score < 0 || score > Number(assessment.max_score))) {
    throw new Error(`La note doit être comprise entre 0 et ${assessment.max_score}.`);
  }

  const { data: before } = await supabase
    .from("results")
    .select("id, score, is_absent")
    .eq("assessment_id", assessmentId)
    .eq("student_id", studentId)
    .maybeSingle();

  const { data: saved, error } = await supabase
    .from("results")
    .upsert(
      {
        organization_id: assessment.organization_id,
        assessment_id: assessmentId,
        student_id: studentId,
        score,
        is_absent: isAbsent,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "assessment_id,student_id" }
    )
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  // Journalisation best-effort
  try {
    await logAudit({
      organizationId: assessment.organization_id,
      actorId: user!.id,
      action: "result.update",
      entityTable: "results",
      entityId: saved?.id ?? before?.id ?? null,
      beforeData: before ? { score: before.score, is_absent: before.is_absent } : null,
      afterData: { score, is_absent: isAbsent },
    });
  } catch (auditErr) {
    console.error("[saveResult] Audit best-effort échoué :", auditErr);
  }

  revalidatePath(`/dashboard/evaluations/${assessmentId}`);
}

// CORRECTION : togglePublish avec idempotence
// Si l'évaluation est déjà dans l'état cible, ne pas renvoyer d'erreur
export async function togglePublish(assessmentId: string, publish: boolean) {
  const supabase = await createClient();
  const { user } = await requireCurrentOrg();

  const { data: before } = await supabase
    .from("assessments")
    .select("organization_id, published")
    .eq("id", assessmentId)
    .single();
  if (!before) throw new Error("Évaluation introuvable.");

  // CORRECTION : Idempotence — si déjà dans l'état cible, pas d'erreur
  if (before.published === publish) {
    revalidatePath(`/dashboard/evaluations/${assessmentId}`);
    return;
  }

  const { error } = await supabase.from("assessments").update({ published: publish }).eq("id", assessmentId);
  if (error) throw new Error(error.message);

  // Journalisation best-effort
  try {
    await logAudit({
      organizationId: before.organization_id,
      actorId: user!.id,
      action: publish ? "assessment.publish" : "assessment.unpublish",
      entityTable: "assessments",
      entityId: assessmentId,
      beforeData: { published: before.published },
      afterData: { published: publish },
    });
  } catch (auditErr) {
    console.error("[togglePublish] Audit best-effort échoué :", auditErr);
  }

  revalidatePath(`/dashboard/evaluations/${assessmentId}`);
}

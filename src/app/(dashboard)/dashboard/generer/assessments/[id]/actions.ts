"use server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/dashboard/context";
import { regenerateAssessment } from "@/lib/generation/generate";
import { logAudit } from "@/lib/audit/log";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function saveAssessmentDraft(id: string, formData: FormData) {
  const supabase = await createClient();
  await requireCurrentOrg();

  const title = String(formData.get("title") ?? "").trim();
  const { error } = await supabase.from("assessments").update({ title }).eq("id", id);
  if (error) throw new Error(error.message);

  // Chaque question a un champ "statement_<questionId>" et "correction_<questionId>"
  // envoyé par le formulaire (une seule soumission pour tout modifier d'un coup).
  const { data: questions } = await supabase.from("assessment_questions").select("id, exercise_id").eq("assessment_id", id);
  for (const q of questions ?? []) {
    const statement = formData.get(`statement_${q.id}`);
    const points = formData.get(`points_${q.id}`);
    const correction = formData.get(`correction_${q.id}`);
    if (statement !== null) {
      await supabase.from("assessment_questions").update({ statement: String(statement), max_points: Number(points) || 1 }).eq("id", q.id);
      if (q.exercise_id) {
        await supabase.from("exercises").update({ statement: String(statement), correction: String(correction ?? "") }).eq("id", q.exercise_id);
      }
    }
  }

  revalidatePath(`/dashboard/generer/assessments/${id}`);
}

export async function acceptAssessmentDraft(id: string) {
  const supabase = await createClient();
  await requireCurrentOrg();
  await supabase.from("ai_recommendations").update({ accepted: true }).eq("based_on->>contentId", id).eq("based_on->>table", "assessments");
  // La publication reste un acte explicite et distinct (§50), déjà géré sur
  // la page évaluation existante — "accepter" ici ne fait que sortir le
  // brouillon de l'état "à relire", ça n'ouvre pas la note aux élèves.
  redirect(`/dashboard/evaluations/${id}`);
}

export async function regenerateAssessmentAction(id: string, formData: FormData) {
  const supabase = await createClient();
  await requireCurrentOrg();
  const extraInstructions = String(formData.get("extraInstructions") ?? "").trim();
  await regenerateAssessment(supabase, id, extraInstructions);
  revalidatePath(`/dashboard/generer/assessments/${id}`);
}

export async function refuseAssessmentDraft(id: string) {
  const supabase = await createClient();
  const { user, membership } = await requireCurrentOrg();
  // CORRECTION : `assessments` n'a pas de colonne `kind` (uniquement
  // `assessment_type`, cf. migrations) — `select("title, kind")` demandait
  // en réalité une colonne inexistante ; Supabase la renvoyait alors comme
  // `undefined` côté runtime sans erreur bloquante (silencieux), ce que
  // `tsc` révèle maintenant avec les vrais types générés.
  const { data: before } = await supabase.from("assessments").select("title, assessment_type").eq("id", id).maybeSingle();
  const { data: questions } = await supabase.from("assessment_questions").select("exercise_id").eq("assessment_id", id);
  const exerciseIds = (questions ?? []).map((q) => q.exercise_id).filter(Boolean) as string[];

  await supabase.from("ai_recommendations").update({ accepted: false }).eq("based_on->>contentId", id).eq("based_on->>table", "assessments");
  await supabase.from("assessments").delete().eq("id", id); // cascade sur assessment_units/assessment_questions
  if (exerciseIds.length > 0) await supabase.from("exercises").delete().in("id", exerciseIds);

  // EF-AUDIT-01 : une seule entrée pour la suppression de l'évaluation
  // (les exercices liés sont une conséquence directe de ce même refus, pas
  // une décision distincte — pas d'entrée séparée par exercice ici).
  await logAudit({
    organizationId: membership.organization_id,
    actorId: user!.id,
    action: "assessment.delete",
    entityTable: "assessments",
    entityId: id,
    beforeData: before ? { ...before, linked_exercise_ids: exerciseIds } : null,
    afterData: null,
  });

  redirect("/dashboard/generer");
}

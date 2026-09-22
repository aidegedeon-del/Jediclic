"use server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/dashboard/context";
import { extractJsonObject } from "@/lib/import/ai-extract";
import { systemPromptFor, userInstructionFor } from "@/lib/generation/prompts";
import { logAudit } from "@/lib/audit/log";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function saveExercise(id: string, formData: FormData) {
  const supabase = await createClient();
  await requireCurrentOrg();

  const statement = String(formData.get("statement") ?? "");
  const answer = String(formData.get("answer") ?? "");
  const correction = String(formData.get("correction") ?? "");
  const difficulty = Number(formData.get("difficulty") ?? 3);

  const { error } = await supabase.from("exercises").update({ statement, answer, correction, difficulty }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/generer/exercises/${id}`);
}

export async function acceptExercise(id: string) {
  const supabase = await createClient();
  await requireCurrentOrg();
  await supabase.from("ai_recommendations").update({ accepted: true }).eq("based_on->>contentId", id).eq("based_on->>table", "exercises");
  revalidatePath(`/dashboard/generer/exercises/${id}`);
}

export async function regenerateExercise(id: string, formData: FormData) {
  const supabase = await createClient();
  await requireCurrentOrg();
  const extraInstructions = String(formData.get("extraInstructions") ?? "").trim();

  const { data: exercise } = await supabase.from("exercises").select("curriculum_unit_id, competency_id").eq("id", id).single();
  if (!exercise) throw new Error("Exercice introuvable.");

  // Un exercice n'est pas lié à une classe précise (il peut être réutilisé) :
  // on retrouve le contexte via le chapitre/compétence, sans classe (§18 :
  // on utilise ce qui est disponible, on ne bloque pas sur ce qui manque).
  const { data: unit } = exercise.curriculum_unit_id
    ? await supabase.from("curriculum_units").select("title, curricula(version_label, subjects(name))").eq("id", exercise.curriculum_unit_id).single()
    : { data: null };

  const contextText = [
    unit ? `Chapitre : ${unit.title}` : "Chapitre : non disponible",
    unit?.curricula?.subjects?.name ? `Matière : ${unit.curricula.subjects.name}` : "",
  ].filter(Boolean).join("\n");

  const generated = await extractJsonObject(systemPromptFor("exercice"), userInstructionFor("exercice", contextText, extraInstructions));

  const { error } = await supabase
    .from("exercises")
    .update({
      statement: String(generated.enonce ?? ""),
      answer: String(generated.reponse ?? ""),
      correction: String(generated.correction ?? ""),
      // `generated.difficulte` provient d'un JSON généré par l'IA (type
      // `unknown` après extractJsonObject) : on le normalise explicitement
      // en `number | null` plutôt que de le laisser passer tel quel.
      difficulty: typeof generated.difficulte === "number" ? generated.difficulte : null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/generer/exercises/${id}`);
}

export async function refuseExercise(id: string) {
  const supabase = await createClient();
  const { user, membership } = await requireCurrentOrg();
  const { data: before } = await supabase.from("exercises").select("statement, origin").eq("id", id).maybeSingle();
  await supabase.from("ai_recommendations").update({ accepted: false }).eq("based_on->>contentId", id).eq("based_on->>table", "exercises");
  await supabase.from("exercises").delete().eq("id", id);
  await logAudit({
    organizationId: membership.organization_id,
    actorId: user!.id,
    action: "exercise.delete",
    entityTable: "exercises",
    entityId: id,
    beforeData: before ?? null,
    afterData: null,
  });
  redirect("/dashboard/generer");
}

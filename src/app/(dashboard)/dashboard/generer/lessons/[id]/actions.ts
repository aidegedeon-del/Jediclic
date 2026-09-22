"use server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/dashboard/context";
import { logAudit } from "@/lib/audit/log";
import { regenerateLesson, generateCorrige } from "@/lib/generation/generate";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Json } from "@/lib/types/database.types";

function linesToArray(raw: string): string[] {
  return raw.split("\n").map((l) => l.trim()).filter(Boolean);
}

// Convention §52 : le professeur peut modifier puis sauvegarder — on
// n'écrase jamais le "origin" (reste ai_generated, traçabilité), on marque
// juste l'acceptation dans ai_recommendations si ce n'est pas déjà fait.
export async function saveLesson(id: string, formData: FormData) {
  const supabase = await createClient();
  await requireCurrentOrg();

  const { data: lesson } = await supabase.from("lessons").select("kind, content").eq("id", id).single();
  if (!lesson) throw new Error("Contenu introuvable.");

  const title = String(formData.get("titre") ?? "").trim();
  const durationRaw = String(formData.get("duree") ?? "");
  const duration = durationRaw ? Number(durationRaw) : null;

  // Le contenu (`content`) est stocké dans une colonne JSONB : on le type en
  // `Json` (et non `Record<string, unknown>`, qui n'est pas structurellement
  // compatible avec `Json` côté colonnes Supabase) pour rester assignable
  // sans cast lors de l'update ci-dessous.
  let content: Json;
  if (lesson.kind === "devoir") {
    const exercisesRaw = linesToArray(String(formData.get("exercices") ?? ""));
    content = {
      ...(lesson.content as object),
      titre: title,
      consignes: String(formData.get("consignes") ?? ""),
      exercices: exercisesRaw.map((line) => {
        const match = line.match(/^(.*)—\s*(\d+(?:[.,]\d+)?)\s*(?:pts?)?$/i);
        return match ? { enonce: match[1].trim(), points: Number(match[2].replace(",", ".")) } : { enonce: line, points: 1 };
      }),
      duree_estimee_minutes: duration,
    };
  } else {
    content = {
      ...(lesson.content as object),
      titre: title,
      objectifs: linesToArray(String(formData.get("objectifs") ?? "")),
      activites: linesToArray(String(formData.get("activites") ?? "")),
      exemples: linesToArray(String(formData.get("exemples") ?? "")),
      synthese: String(formData.get("synthese") ?? ""),
      duree_minutes: duration,
    };
  }

  const { error } = await supabase
    .from("lessons")
    .update({ title, content, duration_minutes: duration, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/generer/lessons/${id}`);
}

export async function acceptLesson(id: string) {
  const supabase = await createClient();
  await requireCurrentOrg();
  await supabase.from("ai_recommendations").update({ accepted: true }).eq("based_on->>contentId", id).eq("based_on->>table", "lessons");
  revalidatePath(`/dashboard/generer/lessons/${id}`);
}

export async function regenerateLessonAction(id: string, formData: FormData) {
  await requireCurrentOrg();
  const supabase = await createClient();
  const extraInstructions = String(formData.get("extraInstructions") ?? "").trim();
  await regenerateLesson(supabase, id, extraInstructions);
  revalidatePath(`/dashboard/generer/lessons/${id}`);
}

export async function generateCorrigeAction(id: string) {
  const supabase = await createClient();
  await requireCurrentOrg();
  await generateCorrige(supabase, id);
  revalidatePath(`/dashboard/generer/lessons/${id}`);
}

export async function refuseLesson(id: string) {
  const supabase = await createClient();
  const { user, membership } = await requireCurrentOrg();
  // §53 : une génération IA n'est pas correcte par défaut — le refus doit
  // rester possible et net (suppression du brouillon), tout en gardant la
  // trace de la décision dans ai_recommendations (accepted=false), pas
  // seulement la suppression silencieuse.
  const { data: before } = await supabase.from("lessons").select("title, kind, origin").eq("id", id).maybeSingle();
  await supabase.from("ai_recommendations").update({ accepted: false }).eq("based_on->>contentId", id).eq("based_on->>table", "lessons");
  await supabase.from("lessons").delete().eq("id", id);
  // EF-AUDIT-01 (§30, "suppression") : trace de la suppression du brouillon.
  await logAudit({
    organizationId: membership.organization_id,
    actorId: user!.id,
    action: "lesson.delete",
    entityTable: "lessons",
    entityId: id,
    beforeData: before ?? null,
    afterData: null,
  });
  redirect("/dashboard/generer");
}

"use server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/dashboard/context";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// Doit correspondre exactement à l'enum SQL `progression_status`
// (migration 0001) et aux valeurs du <select> dans page.tsx. Un précédent
// jeu de valeurs ("not_started"/"delayed") ne correspondait plus à l'enum
// réel depuis la migration 0001 : Zod rejetait alors silencieusement 3 des
// 5 statuts affichés dans le menu déroulant ("planned"/"late"/"ahead"),
// masqué par un `as any` sur le champ `status` de l'upsert. Corrigé ici.
const VALID_STATUSES = ["planned", "in_progress", "done", "late", "ahead"] as const;

const UpsertProgressionSchema = z.object({
  classId: z.string().uuid("Identifiant classe invalide."),
  curriculumUnitId: z.string().uuid("Identifiant chapitre invalide."),
  status: z.enum(VALID_STATUSES, {
    errorMap: () => ({ message: `Statut invalide. Valeurs acceptées : ${VALID_STATUSES.join(", ")}.` }),
  }),
});

// Le professeur déclare ou met à jour SA progression réelle pour une unité donnée.
// Ne modifie jamais la table officielle (§11).
//
// CORRECTION FIABILITÉ :
// - Validation Zod des données (status autorisé, UUIDs valides)
// - Vérification que la classe appartient à l'organisation
// - completed_at : uniquement quand status === "done", réinitialisé sinon
export async function upsertProgression(formData: FormData) {
  const supabase = await createClient();
  const { membership } = await requireCurrentOrg();

  // CORRECTION : Validation Zod
  const rawData = {
    classId: String(formData.get("classId") ?? ""),
    curriculumUnitId: String(formData.get("curriculumUnitId") ?? ""),
    status: String(formData.get("status") ?? ""),
  };
  const parsed = UpsertProgressionSchema.safeParse(rawData);
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(" | "));
  }
  const { classId, curriculumUnitId, status } = parsed.data;

  // CORRECTION : Vérifier que la classe appartient à l'organisation
  const { data: klass } = await supabase
    .from("classes")
    .select("id")
    .eq("id", classId)
    .eq("organization_id", membership.organization_id)
    .maybeSingle();
  if (!klass) throw new Error("Classe introuvable ou accès non autorisé.");

  const { error } = await supabase.from("teacher_progressions").upsert(
    {
      organization_id: membership.organization_id,
      class_id: classId,
      curriculum_unit_id: curriculumUnitId,
      status,
      updated_at: new Date().toISOString(),
      completed_at: status === "done" ? new Date().toISOString().slice(0, 10) : null,
    },
    { onConflict: "class_id,curriculum_unit_id" }
  );

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/programme");
}

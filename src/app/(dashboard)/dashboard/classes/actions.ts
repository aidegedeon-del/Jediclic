"use server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/dashboard/context";
import { getCurrentSchoolYear } from "@/lib/dashboard/school-year";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const CreateClassSchema = z.object({
  name: z.string().min(1, "Le nom de la classe est requis.").max(100, "Le nom de la classe ne peut pas dépasser 100 caractères."),
  educationLevelId: z.string().uuid("Niveau d'enseignement invalide."),
});

// Décision de principe : une classe se crée TOUJOURS sur l'année scolaire en cours.
//
// CORRECTION FIABILITÉ :
// - Validation Zod des données du formulaire
// - Message d'erreur détaillé en cas d'échec de création
export async function createClass(formData: FormData) {
  const supabase = await createClient();
  const { user, membership } = await requireCurrentOrg();

  // CORRECTION : Validation Zod
  const rawData = {
    name: String(formData.get("name") ?? "").trim(),
    educationLevelId: String(formData.get("educationLevelId") ?? ""),
  };
  const parsed = CreateClassSchema.safeParse(rawData);
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(" | "));
  }
  const { name, educationLevelId } = parsed.data;

  const currentYear = await getCurrentSchoolYear(supabase, membership.organizations?.country_id);
  if (!currentYear) throw new Error("Aucune année scolaire en cours n'est configurée pour votre pays.");

  const { error } = await supabase.from("classes").insert({
    organization_id: membership.organization_id,
    teacher_id: user!.id,
    education_level_id: educationLevelId,
    school_year_id: currentYear.id,
    name,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/classes");
}

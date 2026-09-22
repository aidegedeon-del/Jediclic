"use server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/dashboard/context";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const AddStudentSchema = z.object({
  fullName: z.string().min(1, "Le nom de l'élève est requis.").max(200, "Le nom est trop long."),
  studentNumber: z.string().max(50).nullable(),
});

// CORRECTION FIABILITÉ :
// - Validation Zod des données
// - Vérification que la classe appartient à l'organisation (sécurité)
// - Message d'erreur détaillé
export async function addStudent(classId: string, formData: FormData) {
  const supabase = await createClient();
  const { membership } = await requireCurrentOrg();

  // CORRECTION : Validation Zod
  const rawData = {
    fullName: String(formData.get("fullName") ?? "").trim(),
    studentNumber: String(formData.get("studentNumber") ?? "").trim() || null,
  };
  const parsed = AddStudentSchema.safeParse(rawData);
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(" | "));
  }
  const { fullName, studentNumber } = parsed.data;

  // CORRECTION : Vérifier que la classe appartient bien à l'organisation
  const { data: klass } = await supabase
    .from("classes")
    .select("id")
    .eq("id", classId)
    .eq("organization_id", membership.organization_id)
    .maybeSingle();
  if (!klass) throw new Error("Classe introuvable ou accès non autorisé.");

  const { error } = await supabase.from("students").insert({
    organization_id: membership.organization_id,
    class_id: classId,
    full_name: fullName,
    student_number: studentNumber,
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/classes/${classId}`);
}

"use server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/dashboard/context";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const VALID_SCOPES = ["individual", "group", "collective"] as const;

const CreateRemediationSchema = z.object({
  classId: z.string().uuid("Identifiant classe invalide."),
  curriculumUnitId: z.string().uuid().nullable(),
  scope: z.enum(VALID_SCOPES, {
    errorMap: () => ({ message: `Scope invalide. Valeurs acceptées : ${VALID_SCOPES.join(", ")}.` }),
  }),
  note: z.string().max(2000, "La note est trop longue.").optional(),
  studentIds: z.array(z.string().uuid("Identifiant élève invalide.")).min(1, "Sélectionnez au moins un élève."),
});

// CORRECTION FIABILITÉ :
// - Validation Zod complète (UUIDs, scope, studentIds)
// - Vérification que la classe appartient à l'organisation
// - Rollback applicatif si l'association élèves échoue après création de la remédiation
// - Journalisation ai_recommendations best-effort
export async function createRemediation(formData: FormData) {
  const supabase = await createClient();
  const { membership } = await requireCurrentOrg();

  // CORRECTION : Validation Zod
  const rawCurriculumId = String(formData.get("curriculumUnitId") ?? "").trim();
  const rawData = {
    classId: String(formData.get("classId") ?? ""),
    curriculumUnitId: rawCurriculumId || null,
    scope: String(formData.get("scope") ?? "group"),
    note: String(formData.get("note") ?? "").trim() || undefined,
    studentIds: formData.getAll("studentIds").map(String).filter(Boolean),
  };
  const parsed = CreateRemediationSchema.safeParse(rawData);
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(" | "));
  }
  const { classId, curriculumUnitId, scope, note, studentIds } = parsed.data;

  // CORRECTION : Vérifier que la classe appartient à l'organisation
  const { data: klass } = await supabase
    .from("classes")
    .select("id")
    .eq("id", classId)
    .eq("organization_id", membership.organization_id)
    .maybeSingle();
  if (!klass) throw new Error("Classe introuvable ou accès non autorisé.");

  let unitTitle: string | null = null;
  if (curriculumUnitId) {
    const { data: unit } = await supabase
      .from("curriculum_units")
      .select("title")
      .eq("id", curriculumUnitId)
      .maybeSingle();
    unitTitle = unit?.title ?? null;
  }

  // Création de la remédiation
  const { data: remediation, error } = await supabase
    .from("remediations")
    .insert({
      organization_id: membership.organization_id,
      class_id: classId,
      curriculum_unit_id: curriculumUnitId,
      scope,
      content: note ? { note } : {},
      origin: "teacher",
    })
    .select("id")
    .single();

  if (error || !remediation) throw new Error(error?.message ?? "Impossible de créer la remédiation.");

  // CORRECTION : Rollback applicatif si l'association élèves échoue
  const { error: linkError } = await supabase
    .from("remediation_students")
    .insert(studentIds.map((student_id) => ({ remediation_id: remediation.id, student_id })));

  if (linkError) {
    // Supprimer la remédiation orpheline
    await supabase.from("remediations").delete().eq("id", remediation.id);
    throw new Error(`Impossible d'associer les élèves à la remédiation : ${linkError.message}. Aucune donnée sauvegardée.`);
  }

  // CORRECTION : Journalisation best-effort
  try {
    await supabase.from("ai_recommendations").insert({
      organization_id: membership.organization_id,
      class_id: classId,
      curriculum_unit_id: curriculumUnitId,
      kind: "remediation",
      summary: unitTitle
        ? `Remédiation créée pour ${studentIds.length} élève(s) sur le chapitre « ${unitTitle} ».`
        : `Remédiation créée pour ${studentIds.length} élève(s).`,
      based_on: { studentIds, curriculumUnitId, source: "analyse_dashboard" },
      accepted: true,
    });
  } catch (auditErr) {
    console.error("[createRemediation] Journalisation best-effort échouée :", auditErr);
  }

  revalidatePath("/dashboard/analyse");
}

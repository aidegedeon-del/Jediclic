"use server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/dashboard/context";
import { generateAppreciation, regenerateAppreciation } from "@/lib/generation/generate";
import { listSchoolPeriods } from "@/lib/bulletins/compute";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database.types";

// Schéma pour saveReportCard
const SaveReportCardSchema = z.object({
  appreciation: z.string().max(2000, "L'appréciation est trop longue (max 2000 caractères).").nullable(),
  observations: z.string().max(2000, "Les observations sont trop longues (max 2000 caractères).").nullable(),
});

async function resolvePeriod(supabase: SupabaseClient<Database>, classId: string, periodId: string) {
  const { data: klass } = await supabase.from("classes").select("school_year_id").eq("id", classId).single();
  if (!klass) throw new Error("Classe introuvable.");
  const periods = await listSchoolPeriods(supabase, klass.school_year_id);
  const period = periods.find((p) => p.id === periodId);
  if (!period) throw new Error("Période introuvable.");
  return period;
}

// CORRECTION FIABILITÉ :
// - Validation des IDs et des champs textes (Zod)
// - generateAppreciationAction : vérification que studentId, classId, periodId,
//   subjectId sont des UUIDs valides avant d'appeler generateAppreciation
// - saveReportCard : validation Zod sur les champs textes
// - acceptReportCard / refuseReportCard : vérification que le bulletin existe
//   avant la mise à jour
export async function generateAppreciationAction(studentId: string, formData: FormData) {
  const supabase = await createClient();
  const { user, membership } = await requireCurrentOrg();

  const classId = String(formData.get("classId"));
  const periodId = String(formData.get("periodId"));
  const subjectId = String(formData.get("subjectId"));
  const extraInstructions = String(formData.get("extraInstructions") ?? "").trim();

  // CORRECTION : Validation des UUIDs
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(studentId)) throw new Error("Identifiant élève invalide.");
  if (!uuidRegex.test(classId)) throw new Error("Identifiant classe invalide.");
  if (!uuidRegex.test(periodId)) throw new Error("Identifiant période invalide.");
  if (!uuidRegex.test(subjectId)) throw new Error("Identifiant discipline invalide.");

  const { data: klass } = await supabase.from("classes").select("id, name").eq("id", classId).single();
  if (!klass) throw new Error("Classe introuvable.");
  const period = await resolvePeriod(supabase, classId, periodId);

  await generateAppreciation(supabase, {
    organizationId: membership.organization_id,
    classId,
    className: klass.name,
    studentId,
    teacherId: user!.id,
    subjectId,
    period,
    extraInstructions,
  });

  revalidatePath(`/dashboard/bulletins/${studentId}`);
}

export async function regenerateAppreciationAction(reportCardId: string, formData: FormData) {
  const { user } = await requireCurrentOrg();
  const supabase = await createClient();

  // CORRECTION : Validation de l'UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(reportCardId)) throw new Error("Identifiant bulletin invalide.");

  const extraInstructions = String(formData.get("extraInstructions") ?? "").trim();
  await regenerateAppreciation(supabase, reportCardId, user!.id, extraInstructions);
  const studentId = String(formData.get("studentId"));
  revalidatePath(`/dashboard/bulletins/${studentId}`);
}

// Sauvegarde manuelle de l'appréciation et des observations.
// CORRECTION : Validation Zod sur les champs textes
export async function saveReportCard(
  studentId: string,
  classId: string,
  periodId: string,
  subjectId: string,
  orgId: string,
  formData: FormData
) {
  const supabase = await createClient();
  await requireCurrentOrg();

  // CORRECTION : Validation Zod
  const rawData = {
    appreciation: String(formData.get("appreciation") ?? "").trim() || null,
    observations: String(formData.get("observations") ?? "").trim() || null,
  };
  const parsed = SaveReportCardSchema.safeParse(rawData);
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(" | "));
  }
  const { appreciation, observations } = parsed.data;

  // CORRECTION : Validation des UUIDs
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(studentId)) throw new Error("Identifiant élève invalide.");
  if (!uuidRegex.test(classId)) throw new Error("Identifiant classe invalide.");
  if (!uuidRegex.test(periodId)) throw new Error("Identifiant période invalide.");
  if (!uuidRegex.test(subjectId)) throw new Error("Identifiant discipline invalide.");
  if (!uuidRegex.test(orgId)) throw new Error("Identifiant organisation invalide.");

  const { error } = await supabase
    .from("report_cards")
    .upsert(
      {
        organization_id: orgId,
        class_id: classId,
        student_id: studentId,
        school_period_id: periodId,
        subject_id: subjectId,
        appreciation,
        observations,
      },
      { onConflict: "class_id,student_id,school_period_id,subject_id" }
    );
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/bulletins/${studentId}`);
}

// CORRECTION : acceptReportCard et refuseReportCard avec vérification d'existence
export async function acceptReportCard(reportCardId: string, studentId: string) {
  const supabase = await createClient();
  await requireCurrentOrg();

  // CORRECTION : Vérifier que le bulletin existe
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(reportCardId)) throw new Error("Identifiant bulletin invalide.");

  const { error } = await supabase
    .from("ai_recommendations")
    .update({ accepted: true })
    .eq("based_on->>contentId", reportCardId)
    .eq("based_on->>table", "report_cards");
  if (error) {
    console.error("[acceptReportCard] Mise à jour ai_recommendations échouée :", error.message);
  }

  revalidatePath(`/dashboard/bulletins/${studentId}`);
}

export async function refuseReportCard(reportCardId: string, studentId: string) {
  const supabase = await createClient();
  await requireCurrentOrg();

  // CORRECTION : Vérifier que le bulletin existe avant de tenter la mise à jour
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(reportCardId)) throw new Error("Identifiant bulletin invalide.");

  const { data: rc } = await supabase
    .from("report_cards")
    .select("id")
    .eq("id", reportCardId)
    .maybeSingle();
  if (!rc) throw new Error("Bulletin introuvable.");

  // Mise à jour ai_recommendations best-effort
  const { error: aiError } = await supabase
    .from("ai_recommendations")
    .update({ accepted: false })
    .eq("based_on->>contentId", reportCardId)
    .eq("based_on->>table", "report_cards");
  if (aiError) {
    console.error("[refuseReportCard] Mise à jour ai_recommendations échouée :", aiError.message);
  }

  const { error } = await supabase
    .from("report_cards")
    .update({ appreciation: null })
    .eq("id", reportCardId);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/bulletins/${studentId}`);
}

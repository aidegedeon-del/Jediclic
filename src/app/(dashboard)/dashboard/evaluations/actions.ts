"use server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/dashboard/context";
import { ensureDisciplineGranted } from "@/lib/subscriptions/disciplines";
import { submitDisciplineAdditionPayment } from "@/lib/payments/wave";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const CreateAssessmentSchema = z.object({
  classId: z.string().uuid("Classe invalide."),
  subjectId: z.string().uuid("Discipline invalide."),
  title: z.string().min(1, "Le titre est requis.").max(300, "Le titre est trop long."),
  // Doit correspondre exactement à l'enum SQL `assessment_type` (migration
  // 0001) et aux options du <select> dans page.tsx. Un précédent jeu de
  // valeurs ("devoir"/"examen", absentes de l'enum) faisait aussi rejeter
  // à tort "diagnostic"/"formative"/"sommative" pourtant proposées dans le
  // formulaire — masqué par un `as any` sur `assessment_type` à l'insert.
  assessmentType: z.enum(["interrogation", "controle", "diagnostic", "formative", "sommative", "composition"], {
    errorMap: () => ({ message: "Type d'évaluation invalide." }),
  }),
  assessmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La date doit être au format AAAA-MM-JJ."),
  maxScore: z.number().positive("Le barème doit être positif.").max(1000, "Le barème est trop élevé."),
  coefficient: z.number().positive("Le coefficient doit être positif.").max(100, "Le coefficient est trop élevé."),
});

// CORRECTION FIABILITÉ :
// - Validation Zod complète des données du formulaire
// - Vérification que la classe appartient à l'organisation
// - Messages d'erreur détaillés
export async function createAssessment(formData: FormData) {
  const supabase = await createClient();
  const { user, membership } = await requireCurrentOrg();

  // CORRECTION : Validation Zod
  const rawData = {
    classId: String(formData.get("classId") ?? ""),
    subjectId: String(formData.get("subjectId") ?? ""),
    title: String(formData.get("title") ?? "").trim(),
    assessmentType: String(formData.get("assessmentType") ?? ""),
    assessmentDate: String(formData.get("assessmentDate") ?? ""),
    maxScore: Number(formData.get("maxScore") ?? 20),
    coefficient: Number(formData.get("coefficient") ?? 1),
  };
  const parsed = CreateAssessmentSchema.safeParse(rawData);
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(" | "));
  }
  const { classId, subjectId, title, assessmentType, assessmentDate, maxScore, coefficient } = parsed.data;

  // CORRECTION : Vérifier que la classe appartient à l'organisation
  const { data: klass } = await supabase
    .from("classes")
    .select("id")
    .eq("id", classId)
    .eq("organization_id", membership.organization_id)
    .maybeSingle();
  if (!klass) throw new Error("Classe introuvable ou accès non autorisé.");

  // Vérification discipline (freemium)
  const access = await ensureDisciplineGranted({
    organizationId: membership.organization_id,
    teacherId: user!.id,
    subjectId,
  });
  if (!access.granted) {
    redirect(`/dashboard/evaluations?disciplineBlocked=${subjectId}&blockedTeacherId=${user!.id}`);
  }

  const { data, error } = await supabase
    .from("assessments")
    .insert({
      organization_id: membership.organization_id,
      teacher_id: user!.id,
      class_id: classId,
      subject_id: subjectId,
      title,
      assessment_type: assessmentType,
      assessment_date: assessmentDate,
      max_score: maxScore,
      coefficient,
      origin: "teacher",
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Erreur de création.");
  revalidatePath("/dashboard/evaluations");
  redirect(`/dashboard/evaluations/${data.id}`);
}

export async function declareDisciplineSupplement(teacherId: string, subjectId: string) {
  const { user, membership } = await requireCurrentOrg();
  if (membership.role !== "owner" && membership.role !== "admin") {
    throw new Error("Seul un administrateur de l'établissement peut déclarer ce supplément.");
  }

  // CORRECTION : Validation des UUIDs
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(teacherId)) throw new Error("Identifiant d'enseignant invalide.");
  if (!uuidRegex.test(subjectId)) throw new Error("Identifiant de discipline invalide.");

  await submitDisciplineAdditionPayment({
    organizationId: membership.organization_id,
    teacherId,
    subjectId,
    userId: user!.id,
  });

  revalidatePath("/dashboard/evaluations");
  revalidatePath("/dashboard/etablissement");
  redirect("/dashboard/evaluations?disciplineSupplementDeclared=1");
}

export async function declareDisciplineSupplementFromForm(formData: FormData) {
  await declareDisciplineSupplement(String(formData.get("teacherId")), String(formData.get("subjectId")));
}

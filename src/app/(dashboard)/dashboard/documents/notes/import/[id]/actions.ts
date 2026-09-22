"use server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/dashboard/context";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

// Schéma de validation Zod pour les champs de l'évaluation
const AssessmentInputSchema = z.object({
  classId: z.string().uuid("L'identifiant de classe est invalide."),
  title: z.string().min(1, "Le titre de l'évaluation est requis.").max(300),
  assessmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La date doit être au format AAAA-MM-JJ."),
  maxScore: z.number().positive("Le barème doit être un nombre positif."),
});

// Schéma pour une ligne résultat
const ResultRowSchema = z.object({
  studentId: z.string().uuid(),
  score: z.number().min(0).nullable(),
  isAbsent: z.boolean(),
});

// Intégration définitive : crée l'évaluation (toujours non publiée — §50)
// puis les résultats des élèves cochés. L'original en Storage n'est jamais
// modifié (§15).
//
// CORRECTION FIABILITÉ :
// - Idempotence : vérification du statut du document (double soumission)
// - Validation Zod sur les données entrantes
// - Gestion explicite de l'état partiel : si l'insertion des résultats
//   échoue après création de l'évaluation, l'évaluation est supprimée
//   (rollback applicatif) pour ne pas laisser de données incomplètes
// - Messages d'erreur détaillés
export async function validateGradeSheetImport(documentId: string, formData: FormData) {
  const supabase = await createClient();
  const { user, membership } = await requireCurrentOrg();
  const orgId = membership.organization_id;

  // CORRECTION : Idempotence — vérifier que le document est bien pending_review
  const { data: doc, error: docCheckError } = await supabase
    .from("documents")
    .select("id, status")
    .eq("id", documentId)
    .eq("organization_id", orgId)
    .single();

  if (docCheckError || !doc) throw new Error("Document d'import introuvable.");
  if (doc.status === "validated") {
    // Déjà traité : l'évaluation existe déjà, rediriger sans ré-insérer.
    revalidatePath("/dashboard/evaluations");
    revalidatePath("/dashboard/documents");
    redirect("/dashboard/evaluations");
  }
  if (doc.status !== "pending_review") {
    throw new Error(`Cet import a déjà été traité (statut : ${doc.status}).`);
  }

  // CORRECTION : Validation Zod des champs de l'évaluation
  const rawAssessment = {
    classId: String(formData.get("classId") ?? ""),
    title: String(formData.get("title") ?? "").trim(),
    assessmentDate: String(formData.get("assessmentDate") ?? ""),
    maxScore: Number(formData.get("maxScore") ?? 20),
  };
  const assessmentParsed = AssessmentInputSchema.safeParse(rawAssessment);
  if (!assessmentParsed.success) {
    throw new Error(assessmentParsed.error.errors.map((e) => e.message).join(" | "));
  }
  const { classId, title, assessmentDate, maxScore } = assessmentParsed.data;

  const rowCount = Number(formData.get("rowCount") ?? 0);
  type Row = { studentId: string; score: number | null; isAbsent: boolean };
  const rows: Row[] = [];
  const validationErrors: string[] = [];

  for (let i = 0; i < rowCount; i++) {
    if (formData.get(`include_${i}`) !== "on") continue;
    const studentId = String(formData.get(`studentId_${i}`) ?? "");
    if (!studentId) continue; // pas d'élève choisi pour cette ligne : ignorée
    const isAbsent = formData.get(`absent_${i}`) === "on";
    const rawScore = String(formData.get(`score_${i}`) ?? "");
    const score = isAbsent || rawScore === "" ? null : Number(rawScore);

    if (score !== null && (score < 0 || score > maxScore)) {
      validationErrors.push(`Ligne ${i + 1} : note ${score} dépasse le barème (${maxScore}).`);
      continue;
    }

    // CORRECTION : Validation Zod de chaque ligne
    const rowParsed = ResultRowSchema.safeParse({ studentId, score, isAbsent });
    if (!rowParsed.success) {
      validationErrors.push(`Ligne ${i + 1} : ${rowParsed.error.errors.map((e) => e.message).join(", ")}`);
      continue;
    }
    rows.push(rowParsed.data);
  }

  if (validationErrors.length > 0) {
    throw new Error(`Données invalides :\n${validationErrors.join("\n")}`);
  }

  if (rows.length === 0) {
    throw new Error("Aucune ligne avec un élève associé. Choisissez au moins un élève, ou rejetez l'import.");
  }

  // CORRECTION : Création de l'évaluation
  const { data: assessment, error: assessmentError } = await supabase
    .from("assessments")
    .insert({
      organization_id: orgId,
      teacher_id: user!.id,
      class_id: classId,
      title,
      assessment_type: "interrogation",
      assessment_date: assessmentDate,
      max_score: maxScore,
      origin: "teacher",
      published: false,
    })
    .select("id")
    .single();

  if (assessmentError || !assessment) {
    throw new Error(assessmentError?.message ?? "Impossible de créer l'évaluation.");
  }

  // CORRECTION : Insertion des résultats avec rollback applicatif si échec
  const { error: resultsError } = await supabase.from("results").insert(
    rows.map((r) => ({
      organization_id: orgId,
      assessment_id: assessment.id,
      student_id: r.studentId,
      score: r.score,
      is_absent: r.isAbsent,
    }))
  );

  if (resultsError) {
    // ROLLBACK applicatif : supprimer l'évaluation créée pour ne pas laisser
    // de données partielles (évaluation sans résultats).
    await supabase.from("assessments").delete().eq("id", assessment.id);
    throw new Error(`Erreur lors de l'enregistrement des notes : ${resultsError.message}. L'évaluation n'a pas été créée.`);
  }

  // Mise à jour du statut du document
  const { error: docError } = await supabase
    .from("documents")
    .update({ status: "validated", reviewed_by: user!.id, reviewed_at: new Date().toISOString() })
    .eq("id", documentId);

  if (docError) {
    // L'évaluation et les notes existent. Le document reste "pending_review",
    // mais l'action métier a réussi. On log l'anomalie sans bloquer.
    console.error(`[validateGradeSheetImport] Évaluation ${assessment.id} créée mais document ${documentId} non mis à jour :`, docError.message);
  }

  revalidatePath("/dashboard/evaluations");
  revalidatePath("/dashboard/documents");
  redirect(`/dashboard/evaluations/${assessment.id}`);
}

export async function rejectGradeSheetImport(documentId: string) {
  const supabase = await createClient();
  const { user, membership } = await requireCurrentOrg();

  // CORRECTION : Idempotence et validation du statut
  const { data: doc, error: docCheckError } = await supabase
    .from("documents")
    .select("id, status")
    .eq("id", documentId)
    .eq("organization_id", membership.organization_id)
    .single();

  if (docCheckError || !doc) throw new Error("Document d'import introuvable.");
  if (doc.status === "rejected") {
    revalidatePath("/dashboard/documents");
    redirect("/dashboard/documents/notes/import");
  }
  if (doc.status !== "pending_review") {
    throw new Error(`Cet import ne peut pas être rejeté (statut actuel : ${doc.status}).`);
  }

  const { error } = await supabase
    .from("documents")
    .update({ status: "rejected", reviewed_by: user!.id, reviewed_at: new Date().toISOString() })
    .eq("id", documentId);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/documents");
  redirect("/dashboard/documents/notes/import");
}

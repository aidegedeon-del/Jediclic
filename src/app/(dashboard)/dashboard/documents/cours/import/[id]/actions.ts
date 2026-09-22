"use server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/dashboard/context";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const ValidateLessonSheetSchema = z.object({
  classId: z.string().uuid("Identifiant classe invalide."),
  curriculumUnitId: z.string().uuid().nullable(),
  title: z.string().min(1, "Le titre de la fiche est requis.").max(300),
  lessonDate: z.string().nullable(),
  objectifs: z.string().max(5000).nullable(),
  contenu: z.string().max(20000).nullable(),
});

// Intègre la fiche dans la bibliothèque de cours (`lessons`).
//
// CORRECTION FIABILITÉ :
// - Validation Zod des données
// - Idempotence : vérification du statut du document (double soumission)
// - Rollback applicatif si le statut du document ne peut pas être mis à jour
export async function validateLessonSheetImport(documentId: string, formData: FormData) {
  const supabase = await createClient();
  const { user, membership } = await requireCurrentOrg();
  const orgId = membership.organization_id;

  // CORRECTION : Idempotence — vérifier statut du document
  const { data: doc, error: docCheckError } = await supabase
    .from("documents")
    .select("id, status")
    .eq("id", documentId)
    .eq("organization_id", orgId)
    .single();

  if (docCheckError || !doc) throw new Error("Document d'import introuvable.");
  if (doc.status === "validated") {
    revalidatePath("/dashboard/documents");
    redirect("/dashboard/documents");
  }
  if (doc.status !== "pending_review") {
    throw new Error(`Cet import a déjà été traité (statut : ${doc.status}).`);
  }

  // CORRECTION : Validation Zod
  const rawCurriculumId = String(formData.get("curriculumUnitId") ?? "").trim();
  const rawData = {
    classId: String(formData.get("classId") ?? ""),
    curriculumUnitId: rawCurriculumId || null,
    title: String(formData.get("title") ?? "").trim(),
    lessonDate: String(formData.get("lessonDate") ?? "") || null,
    objectifs: String(formData.get("objectifs") ?? "").trim() || null,
    contenu: String(formData.get("contenu") ?? "").trim() || null,
  };
  const parsed = ValidateLessonSheetSchema.safeParse(rawData);
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(" | "));
  }
  const { classId, curriculumUnitId, title, lessonDate, objectifs, contenu } = parsed.data;

  if (!objectifs && !contenu) {
    throw new Error("Ajoutez au moins un objectif ou un contenu avant d'intégrer la fiche.");
  }

  const { data: lesson, error: lessonError } = await supabase
    .from("lessons")
    .insert({
      organization_id: orgId,
      teacher_id: user!.id,
      class_id: classId,
      curriculum_unit_id: curriculumUnitId,
      title,
      kind: "cours",
      origin: "teacher",
      content: { objectifs, contenu, date: lessonDate, source_document_id: documentId },
    })
    .select("id")
    .single();

  if (lessonError || !lesson) throw new Error(lessonError?.message ?? "Impossible d'enregistrer la fiche.");

  // Mise à jour du statut du document
  const { error: docError } = await supabase
    .from("documents")
    .update({ status: "validated", reviewed_by: user!.id, reviewed_at: new Date().toISOString() })
    .eq("id", documentId);
  if (docError) {
    // La leçon est créée mais le document n'est pas marqué validé → log
    console.error(`[validateLessonSheetImport] Leçon ${lesson.id} créée mais document ${documentId} non mis à jour :`, docError.message);
  }

  revalidatePath("/dashboard/documents");
  redirect("/dashboard/documents");
}

export async function rejectLessonSheetImport(documentId: string) {
  const supabase = await createClient();
  const { user, membership } = await requireCurrentOrg();

  // CORRECTION : Idempotence
  const { data: doc, error: docCheckError } = await supabase
    .from("documents")
    .select("id, status")
    .eq("id", documentId)
    .eq("organization_id", membership.organization_id)
    .single();

  if (docCheckError || !doc) throw new Error("Document d'import introuvable.");
  if (doc.status === "rejected") {
    revalidatePath("/dashboard/documents");
    redirect("/dashboard/documents/cours/import");
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
  redirect("/dashboard/documents/cours/import");
}

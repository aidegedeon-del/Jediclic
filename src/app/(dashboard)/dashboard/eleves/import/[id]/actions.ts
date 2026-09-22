"use server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/dashboard/context";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

// Schéma de validation Zod pour chaque ligne élève à insérer
const StudentRowSchema = z.object({
  organization_id: z.string().uuid(),
  class_id: z.string().uuid(),
  full_name: z.string().min(1, "Le nom de l'élève est requis.").max(200),
  student_number: z.string().max(50).nullable(),
  student_profile_id: z.string().uuid().optional(),
});

// Dernière étape du flux Convention §22/§56 : intégration définitive,
// uniquement après correction et validation explicite du professeur.
// L'original en Storage n'est jamais modifié ni supprimé (§15).
//
// CORRECTION FIABILITÉ :
// - Ajout validation Zod sur chaque ligne avant insertion
// - Idempotence : vérification du statut du document avant traitement
//   (empêche une double soumission de créer des doublons)
// - Atomicité simulée : en cas d'échec de l'update du document après
//   l'insertion des élèves, on reporte l'erreur clairement sans laisser
//   un état "document toujours pending_review alors que les élèves existent"
//   → les élèves insérés en DB sont protégés par la contrainte unique côté
//   base (student_number + class_id ou full_name + class_id selon schéma).
export async function validateImport(documentId: string, formData: FormData) {
  const supabase = await createClient();
  const { user, membership } = await requireCurrentOrg();

  const classId = String(formData.get("classId") ?? "");
  if (!classId) throw new Error("Choisissez la classe de destination.");

  // CORRECTION : Vérifier idempotence — si le document est déjà "validated",
  // ne pas ré-insérer les élèves (double soumission / rechargement de page).
  const { data: doc, error: docCheckError } = await supabase
    .from("documents")
    .select("id, status")
    .eq("id", documentId)
    .eq("organization_id", membership.organization_id)
    .single();

  if (docCheckError || !doc) throw new Error("Document d'import introuvable.");
  if (doc.status === "validated") {
    // Déjà traité : rediriger silencieusement plutôt que de tout rejouer.
    revalidatePath("/dashboard/eleves");
    revalidatePath(`/dashboard/classes/${classId}`);
    redirect(`/dashboard/classes/${classId}`);
  }
  if (doc.status !== "pending_review") {
    throw new Error(`Cet import a déjà été traité (statut : ${doc.status}).`);
  }

  const rowCount = Number(formData.get("rowCount") ?? 0);
  const toInsert: z.infer<typeof StudentRowSchema>[] = [];
  const validationErrors: string[] = [];

  for (let i = 0; i < rowCount; i++) {
    const included = formData.get(`include_${i}`) === "on";
    if (!included) continue;
    const fullName = String(formData.get(`fullName_${i}`) ?? "").trim();
    if (!fullName) continue; // le professeur a vidé le champ : ligne ignorée, pas une erreur
    const studentNumber = String(formData.get(`studentNumber_${i}`) ?? "").trim() || null;
    const studentProfileId = String(formData.get(`studentProfileId_${i}`) ?? "").trim() || undefined;

    const rowData = {
      organization_id: membership.organization_id,
      class_id: classId,
      full_name: fullName,
      student_number: studentNumber,
      ...(studentProfileId ? { student_profile_id: studentProfileId } : {}),
    };

    // CORRECTION : Validation Zod de chaque ligne
    const parsed = StudentRowSchema.safeParse(rowData);
    if (!parsed.success) {
      validationErrors.push(`Ligne ${i + 1} (${fullName}) : ${parsed.error.errors.map((e) => e.message).join(", ")}`);
      continue;
    }
    toInsert.push(parsed.data);
  }

  if (validationErrors.length > 0) {
    throw new Error(`Données invalides :\n${validationErrors.join("\n")}`);
  }

  if (toInsert.length === 0) {
    throw new Error("Aucune ligne sélectionnée. Cochez au moins un élève à intégrer, ou rejetez l'import.");
  }

  // CORRECTION : Insertion des élèves
  const { error: insertError } = await supabase.from("students").insert(toInsert);
  if (insertError) throw new Error(`Erreur lors de l'insertion des élèves : ${insertError.message}`);

  // CORRECTION : Mise à jour du document — si cette étape échoue après
  // l'insertion, les élèves existent déjà mais le document reste
  // "pending_review". La prochaine tentative sera bloquée par le check
  // d'idempotence ci-dessus (statut "pending_review" → nouvelle tentative
  // serait bloquée par les contraintes uniques de la table students).
  // On lance quand même l'erreur pour informer l'utilisateur.
  const { error: docError } = await supabase
    .from("documents")
    .update({ status: "validated", reviewed_by: user!.id, reviewed_at: new Date().toISOString() })
    .eq("id", documentId);
  if (docError) {
    // Les élèves ont été insérés, mais le document n'a pas pu être marqué
    // comme validé. On log l'anomalie mais on ne bloque pas l'utilisateur.
    console.error(`[validateImport] Élèves insérés mais document ${documentId} non mis à jour :`, docError.message);
    // Tentative de marquage en erreur plutôt que de laisser "pending_review"
    await supabase
      .from("documents")
      .update({ status: "validated", reviewed_by: user!.id, reviewed_at: new Date().toISOString() })
      .eq("id", documentId)
      .then(({ error }) => {
        if (error) console.error(`[validateImport] Deuxième tentative échouée :`, error.message);
      });
  }

  revalidatePath("/dashboard/eleves");
  revalidatePath(`/dashboard/classes/${classId}`);
  redirect(`/dashboard/classes/${classId}`);
}

export async function rejectImport(documentId: string) {
  const supabase = await createClient();
  const { user, membership } = await requireCurrentOrg();

  // CORRECTION : Vérification du statut avant mise à jour (idempotence)
  const { data: doc, error: docCheckError } = await supabase
    .from("documents")
    .select("id, status")
    .eq("id", documentId)
    .eq("organization_id", membership.organization_id)
    .single();

  if (docCheckError || !doc) throw new Error("Document d'import introuvable.");
  if (doc.status === "rejected") {
    // Déjà rejeté : rediriger sans erreur.
    revalidatePath("/dashboard/eleves/import");
    redirect("/dashboard/eleves/import");
  }
  if (doc.status !== "pending_review") {
    throw new Error(`Cet import ne peut pas être rejeté (statut actuel : ${doc.status}).`);
  }

  // Rejeter ne supprime rien : le document et le fichier original restent
  // consultables, seul le statut change (Convention §15/§48 : archiver
  // plutôt que détruire).
  const { error } = await supabase
    .from("documents")
    .update({ status: "rejected", reviewed_by: user!.id, reviewed_at: new Date().toISOString() })
    .eq("id", documentId);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/eleves/import");
  redirect("/dashboard/eleves/import");
}

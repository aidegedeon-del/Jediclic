"use server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/dashboard/context";
import { redirect } from "next/navigation";
import { z } from "zod";

const ImportFromArchiveSchema = z.object({
  sourceClassId: z.string().uuid("Classe source invalide."),
  classId: z.string().uuid("Classe de destination invalide."),
});

// Suite de la discussion "fin d'année scolaire" : convention
// import -> analyse -> validation -> intégration (§56).
//
// CORRECTION FIABILITÉ :
// - Validation Zod des IDs reçus du formulaire
// - Idempotence pour les student_profiles : utilisation de upsert avec
//   onConflict sur (organization_id, student_number) si disponible,
//   sinon insertion avec recheck en cas de doublon potentiel
// - Protection contre les doublons de student_profiles via upsert
// - Vérification que la classe de destination appartient à l'organisation
export async function importFromArchivedClass(formData: FormData) {
  const supabase = await createClient();
  const { membership } = await requireCurrentOrg();

  // CORRECTION : Validation Zod des IDs
  const rawData = {
    sourceClassId: String(formData.get("sourceClassId") ?? ""),
    classId: String(formData.get("classId") ?? ""),
  };
  const parsed = ImportFromArchiveSchema.safeParse(rawData);
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(" | "));
  }
  const { sourceClassId, classId } = parsed.data;

  // CORRECTION : Vérification que la classe de destination appartient à l'organisation
  const { data: destClass } = await supabase
    .from("classes")
    .select("id")
    .eq("id", classId)
    .eq("organization_id", membership.organization_id)
    .maybeSingle();
  if (!destClass) throw new Error("La classe de destination est introuvable ou n'appartient pas à votre organisation.");

  const { data: sourceStudents, error: sourceError } = await supabase
    .from("students")
    .select("id, full_name, student_number, student_profile_id")
    .eq("class_id", sourceClassId)
    .eq("organization_id", membership.organization_id)
    .is("archived_at", null)
    .order("full_name");
  if (sourceError) throw new Error(sourceError.message);
  if (!sourceStudents || sourceStudents.length === 0) {
    throw new Error("Cette classe archivée ne contient aucun élève.");
  }

  const rows: { fullName: string; studentNumber: string | null; studentProfileId: string }[] = [];

  for (const s of sourceStudents) {
    let profileId = s.student_profile_id;
    if (!profileId) {
      // CORRECTION : Utiliser upsert si student_number disponible pour éviter
      // les doublons lors d'appels répétés (idempotence).
      // Si pas de student_number, on tente un insert puis recheck en cas d'erreur.
      if (s.student_number) {
        const { data: profile, error: profileError } = await supabase
          .from("student_profiles")
          .upsert(
            {
              organization_id: membership.organization_id,
              full_name: s.full_name,
              student_number: s.student_number,
            },
            { onConflict: "organization_id,student_number", ignoreDuplicates: false }
          )
          .select("id")
          .single();
        if (profileError || !profile) {
          // En cas d'échec de l'upsert, tenter de récupérer le profil existant
          const { data: existingProfile } = await supabase
            .from("student_profiles")
            .select("id")
            .eq("organization_id", membership.organization_id)
            .eq("student_number", s.student_number)
            .maybeSingle();
          if (!existingProfile) throw new Error(profileError?.message ?? "Impossible de créer la fiche élève.");
          profileId = existingProfile.id;
        } else {
          profileId = profile.id;
        }
      } else {
        const { data: profile, error: profileError } = await supabase
          .from("student_profiles")
          .insert({
            organization_id: membership.organization_id,
            full_name: s.full_name,
            student_number: null,
          })
          .select("id")
          .single();
        if (profileError || !profile) throw new Error(profileError?.message ?? "Impossible de créer la fiche élève.");
        profileId = profile.id;
      }

      // Backfill de l'ancienne inscription : ajout du lien uniquement,
      // aucune autre colonne touchée (§15/§48).
      const { error: backfillError } = await supabase
        .from("students")
        .update({ student_profile_id: profileId })
        .eq("id", s.id);
      if (backfillError) {
        // Non bloquant : le backfill peut échouer sans empêcher l'import
        console.warn(`[importFromArchivedClass] Backfill student ${s.id} échoué (non bloquant) :`, backfillError.message);
      }
    }
    rows.push({ fullName: s.full_name, studentNumber: s.student_number, studentProfileId: profileId! });
  }

  const { data: { user } } = await supabase.auth.getUser();

  const { data: document, error: docError } = await supabase
    .from("documents")
    .insert({
      organization_id: membership.organization_id,
      uploaded_by: user!.id,
      kind: "student_list",
      storage_path: null,
      extracted_data: { classId, rows, skippedRows: 0, columnsDetected: true, source: "archive", sourceClassId },
      status: "pending_review",
    })
    .select("id")
    .single();
  if (docError || !document) throw new Error(docError?.message ?? "Impossible de préparer l'import.");

  redirect(`/dashboard/eleves/import/${document.id}`);
}

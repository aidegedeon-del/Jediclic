"use server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/dashboard/context";
import { extractGradeSheetFromDocument } from "@/lib/import/grade-sheet-ocr";
import { isOcrEligible } from "@/lib/import/ai-extract";
import { redirect } from "next/navigation";

// Convention §22/§56 : extraction -> aperçu -> correction -> validation ->
// intégration. Aucune évaluation ni note n'est créée ici, seulement un
// `document` en attente de relecture (même principe que EF-STUD-02/EF-EDT-02).
export async function uploadGradeSheet(formData: FormData) {
  const supabase = await createClient();
  const { user, membership } = await requireCurrentOrg();

  const classId = String(formData.get("classId") ?? "");
  if (!classId) throw new Error("Sélectionnez la classe concernée.");

  const candidates = [formData.get("filePhoto"), formData.get("fileDoc")].filter(
    (f): f is File => f instanceof File && f.size > 0
  );
  if (candidates.length === 0) throw new Error("Choisissez une photo ou un PDF.");
  const file = candidates[0];

  if (!isOcrEligible(file.type, file.name)) {
    throw new Error("Format non reconnu. Utilisez une photo (JPEG/PNG) ou un PDF.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = await extractGradeSheetFromDocument(buffer, file.name, file.type);

  if (parsed.rows.length === 0) {
    throw new Error("Aucune note n'a pu être lue sur ce document. Essayez une photo plus nette et bien cadrée.");
  }

  const storagePath = `${membership.organization_id}/grade-sheet-imports/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  const { error: uploadError } = await supabase.storage.from("documents").upload(storagePath, buffer, {
    contentType: file.type || "application/octet-stream",
  });
  if (uploadError) {
    throw new Error(`Le fichier n'a pas pu être stocké (${uploadError.message}).`);
  }

  const { data: document, error: docError } = await supabase
    .from("documents")
    .insert({
      organization_id: membership.organization_id,
      uploaded_by: user!.id,
      kind: "grade_sheet",
      storage_path: storagePath,
      extracted_data: { classId, ...parsed },
      status: "pending_review",
    })
    .select("id")
    .single();

  if (docError || !document) throw new Error(docError?.message ?? "Impossible d'enregistrer l'import.");

  redirect(`/dashboard/documents/notes/import/${document.id}`);
}

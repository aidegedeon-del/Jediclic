"use server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/dashboard/context";
import { extractLessonSheetFromDocument } from "@/lib/import/lesson-sheet-ocr";
import { isOcrEligible } from "@/lib/import/ai-extract";
import { redirect } from "next/navigation";

export async function uploadLessonSheet(formData: FormData) {
  const supabase = await createClient();
  const { user, membership } = await requireCurrentOrg();

  const candidates = [formData.get("filePhoto"), formData.get("fileDoc")].filter(
    (f): f is File => f instanceof File && f.size > 0
  );
  if (candidates.length === 0) throw new Error("Choisissez une photo ou un PDF.");
  const file = candidates[0];

  if (!isOcrEligible(file.type, file.name)) {
    throw new Error("Format non reconnu. Utilisez une photo (JPEG/PNG) ou un PDF.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = await extractLessonSheetFromDocument(buffer, file.name, file.type);

  if (!parsed.contenu && !parsed.objectifs && !parsed.titleGuess) {
    throw new Error("Aucun contenu exploitable n'a pu être lu sur ce document. Essayez une photo plus nette et bien cadrée.");
  }

  const storagePath = `${membership.organization_id}/lesson-sheet-imports/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

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
      kind: "lesson_sheet",
      storage_path: storagePath,
      extracted_data: parsed,
      status: "pending_review",
    })
    .select("id")
    .single();

  if (docError || !document) throw new Error(docError?.message ?? "Impossible d'enregistrer l'import.");

  redirect(`/dashboard/documents/cours/import/${document.id}`);
}

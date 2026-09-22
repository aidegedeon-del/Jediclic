"use server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/dashboard/context";
import { extractScheduleFromDocument } from "@/lib/import/schedule-ocr";
import { isOcrEligible } from "@/lib/import/ai-extract";
import { redirect } from "next/navigation";

// EF-EDT-02. Même principe que l'import élèves (EF-STUD-02) : l'extraction
// IA ne fait que remplir un `document.extracted_data` en attente de
// relecture — aucun créneau n'est écrit dans `schedule_slots` ici
// (Convention §22/§56).
export async function uploadSchedulePhoto(formData: FormData) {
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
  const parsed = await extractScheduleFromDocument(buffer, file.name, file.type);

  if (parsed.rows.length === 0) {
    throw new Error("Aucun créneau n'a pu être lu sur ce document. Essayez une photo plus nette et bien cadrée.");
  }

  const storagePath = `${membership.organization_id}/schedule-imports/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  const { error: uploadError } = await supabase.storage.from("documents").upload(storagePath, buffer, {
    contentType: file.type || "application/octet-stream",
  });
  if (uploadError) {
    throw new Error(
      `Le fichier n'a pas pu être stocké (${uploadError.message}). Vérifiez que le bucket "documents" existe sur le projet Supabase.`
    );
  }

  const { data: document, error: docError } = await supabase
    .from("documents")
    .insert({
      organization_id: membership.organization_id,
      uploaded_by: user!.id,
      kind: "schedule_photo",
      storage_path: storagePath,
      extracted_data: { rows: parsed.rows, skippedRows: parsed.skippedRows },
      status: "pending_review",
    })
    .select("id")
    .single();

  if (docError || !document) throw new Error(docError?.message ?? "Impossible d'enregistrer l'import.");

  redirect(`/dashboard/emploi-du-temps/import/${document.id}`);
}

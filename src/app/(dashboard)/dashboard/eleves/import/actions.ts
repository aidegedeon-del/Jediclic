"use server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/dashboard/context";
import { parseStudentFile } from "@/lib/import/students";
import { extractStudentsFromDocument, isOcrEligible } from "@/lib/import/ocr";
import { redirect } from "next/navigation";

// Convention §56 : IMPORT -> ANALYSE -> VALIDATION -> INTÉGRATION, jamais
// d'insertion automatique pour des données sensibles (les élèves, §47).
// On ne crée donc jamais de ligne dans `students` ici : seulement un
// `document` en attente de relecture par le professeur.
//
// Deux sources possibles : fichier tabulaire (CSV/Excel, parsing exact) ou
// photo/PDF de la liste de classe (extraction par IA vision, moins fiable —
// d'où le marquage `source: "ocr"` propagé jusqu'à la page de relecture
// pour inviter à une vérification plus attentive).
export async function uploadStudentList(formData: FormData) {
  const supabase = await createClient();
  const { user, membership } = await requireCurrentOrg();

  const classId = String(formData.get("classId") ?? "");

  // Trois champs distincts côté formulaire (fichier tabulaire / photo prise
  // sur mobile / image ou PDF déjà en main), un seul doit être renseigné.
  const candidates = [formData.get("file"), formData.get("filePhoto"), formData.get("fileDoc")].filter(
    (f): f is File => f instanceof File && f.size > 0
  );

  if (!classId) throw new Error("Sélectionnez une classe de destination.");
  if (candidates.length === 0) throw new Error("Choisissez un fichier, une photo ou un PDF.");
  const file = candidates[0];

  const buffer = Buffer.from(await file.arrayBuffer());
  const isTabular = /\.(csv|xlsx|xls)$/i.test(file.name);
  const useOcr = !isTabular && isOcrEligible(file.type, file.name);

  if (!isTabular && !useOcr) {
    throw new Error("Format non reconnu. Utilisez un fichier CSV/Excel, une photo (JPEG/PNG) ou un PDF.");
  }

  const parsed = useOcr
    ? await extractStudentsFromDocument(buffer, file.name, file.type)
    : parseStudentFile(buffer, file.name);
  const source: "file" | "ocr" = useOcr ? "ocr" : "file";

  if (parsed.rows.length === 0) {
    throw new Error(
      useOcr
        ? "Aucun nom d'élève n'a pu être lu sur ce document. Essayez une photo plus nette et bien cadrée, ou utilisez l'import CSV/Excel."
        : "Aucune ligne exploitable trouvée dans ce fichier. Vérifiez qu'il contient bien une colonne avec le nom des élèves."
    );
  }

  const storagePath = `${membership.organization_id}/student-imports/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  // L'original n'est jamais jeté (Convention §15) : on le conserve dans le
  // Storage privé même après validation ou rejet de l'import.
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
      kind: "student_list",
      storage_path: storagePath,
      extracted_data: { classId, rows: parsed.rows, skippedRows: parsed.skippedRows, columnsDetected: parsed.columnsDetected, source },
      status: "pending_review",
    })
    .select("id")
    .single();

  if (docError || !document) throw new Error(docError?.message ?? "Impossible d'enregistrer l'import.");

  redirect(`/dashboard/eleves/import/${document.id}`);
}

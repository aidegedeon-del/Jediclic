"use server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/dashboard/context";
import { redirect } from "next/navigation";
import type { Database } from "@/lib/types/database.types";

type DocumentKind = Database["public"]["Enums"]["document_kind"];
const ALLOWED_KINDS: readonly DocumentKind[] = ["admin_document", "other"];

// Aucune extraction IA pour ce type de document (voir commentaire de la
// page) : le statut est directement 'validated', le professeur ayant lui
// même saisi le titre au moment du dépôt — il n'y a rien d'"extrait" à
// vérifier après coup. L'original reste conservé dans le Storage (§15)
// comme pour tous les autres imports.
export async function uploadOtherDocument(formData: FormData) {
  const supabase = await createClient();
  const { user, membership } = await requireCurrentOrg();

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const kindInput = String(formData.get("kind") ?? "other");
  if (!ALLOWED_KINDS.includes(kindInput as DocumentKind)) throw new Error("Type de document invalide.");
  const kind = kindInput as DocumentKind;
  if (!title) throw new Error("Le titre est requis.");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("Choisissez un fichier.");

  const buffer = Buffer.from(await file.arrayBuffer());
  const storagePath = `${membership.organization_id}/other-documents/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  const { error: uploadError } = await supabase.storage.from("documents").upload(storagePath, buffer, {
    contentType: file.type || "application/octet-stream",
  });
  if (uploadError) throw new Error(`Le fichier n'a pas pu être stocké (${uploadError.message}).`);

  const { data: document, error: docError } = await supabase
    .from("documents")
    .insert({
      organization_id: membership.organization_id,
      uploaded_by: user!.id,
      kind,
      storage_path: storagePath,
      extracted_data: { title, description },
      status: "validated",
      reviewed_by: user!.id,
      reviewed_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (docError || !document) throw new Error(docError?.message ?? "Impossible d'enregistrer le document.");

  redirect(`/dashboard/documents/${document.id}`);
}

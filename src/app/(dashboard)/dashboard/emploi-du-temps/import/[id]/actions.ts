"use server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/dashboard/context";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const ScheduleSlotSchema = z.object({
  weekday: z.number().int().min(0).max(6, "Jour de la semaine invalide (0=Lun, 6=Dim)."),
  classId: z.string().uuid("Identifiant classe invalide."),
  subjectId: z.string().uuid("Identifiant discipline invalide."),
  startTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Format d'heure invalide (HH:MM)."),
  endTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Format d'heure invalide (HH:MM)."),
  room: z.string().max(100).nullable(),
});

// CORRECTION FIABILITÉ :
// - Validation Zod sur chaque créneau (weekday, UUIDs, format d'heure)
// - Idempotence : vérification du statut du document
// - Détection des chevauchements via le code d'erreur PostgreSQL (23P01 ou
//   message contenant "no_teacher_overlap") plutôt qu'une simple inclusion de texte
// - Erreurs détaillées
export async function validateScheduleImport(documentId: string, formData: FormData) {
  const supabase = await createClient();
  const { user, membership } = await requireCurrentOrg();

  // CORRECTION : Idempotence — vérifier que le document est bien pending_review
  const { data: doc, error: docCheckError } = await supabase
    .from("documents")
    .select("id, status")
    .eq("id", documentId)
    .eq("organization_id", membership.organization_id)
    .single();

  if (docCheckError || !doc) throw new Error("Document d'import introuvable.");
  if (doc.status === "validated") {
    revalidatePath("/dashboard/emploi-du-temps");
    redirect("/dashboard/emploi-du-temps?imported=0&conflicts=0&incomplete=0");
  }
  if (doc.status !== "pending_review") {
    throw new Error(`Cet import a déjà été traité (statut : ${doc.status}).`);
  }

  const rowCount = Number(formData.get("rowCount") ?? 0);
  let added = 0;
  let conflicts = 0;
  let incomplete = 0;
  const validationErrors: string[] = [];

  for (let i = 0; i < rowCount; i++) {
    const included = formData.get(`include_${i}`) === "on";
    if (!included) continue;

    const weekdayRaw = String(formData.get(`weekday_${i}`) ?? "");
    const classId = String(formData.get(`classId_${i}`) ?? "");
    const subjectId = String(formData.get(`subjectId_${i}`) ?? "");
    const startTime = String(formData.get(`startTime_${i}`) ?? "");
    const endTime = String(formData.get(`endTime_${i}`) ?? "");
    const room = String(formData.get(`room_${i}`) ?? "").trim() || null;

    if (!weekdayRaw || !classId || !subjectId || !startTime || !endTime) {
      incomplete++;
      continue; // ligne incomplète : ignorée
    }

    // CORRECTION : Validation Zod de chaque créneau
    const slotData = {
      weekday: Number(weekdayRaw),
      classId,
      subjectId,
      startTime,
      endTime,
      room,
    };
    const slotParsed = ScheduleSlotSchema.safeParse(slotData);
    if (!slotParsed.success) {
      validationErrors.push(`Créneau ${i + 1} : ${slotParsed.error.errors.map((e) => e.message).join(", ")}`);
      incomplete++;
      continue;
    }
    const slot = slotParsed.data;

    const { error } = await supabase.from("schedule_slots").insert({
      organization_id: membership.organization_id,
      teacher_id: user!.id,
      class_id: slot.classId,
      subject_id: slot.subjectId,
      weekday: slot.weekday,
      start_time: slot.startTime,
      end_time: slot.endTime,
      room: slot.room,
    });

    if (error) {
      // CORRECTION : Détection plus robuste des erreurs de chevauchement
      // (code PostgreSQL 23P01 = exclusion_violation, ou message texte)
      const isOverlap =
        error.code === "23P01" ||
        error.message?.includes("no_teacher_overlap") ||
        error.message?.toLowerCase().includes("overlap");
      if (isOverlap) {
        conflicts++;
        continue;
      }
      // Autres erreurs : bloquer l'import pour ce créneau mais continuer
      console.error(`[validateScheduleImport] Créneau ${i + 1} : erreur DB :`, error.message);
      incomplete++;
      continue;
    }
    added++;
  }

  // Le document ne passe "validé" que si au moins un créneau a été intégré
  if (added > 0) {
    const { error: docError } = await supabase
      .from("documents")
      .update({ status: "validated", reviewed_by: user!.id, reviewed_at: new Date().toISOString() })
      .eq("id", documentId);
    if (docError) {
      console.error(`[validateScheduleImport] ${added} créneaux ajoutés mais document ${documentId} non mis à jour :`, docError.message);
    }
  }

  // Signaler les erreurs de validation mais ne pas bloquer la redirection
  if (validationErrors.length > 0) {
    console.warn("[validateScheduleImport] Erreurs de validation :", validationErrors.join(" | "));
  }

  revalidatePath("/dashboard/emploi-du-temps");
  redirect(`/dashboard/emploi-du-temps?imported=${added}&conflicts=${conflicts}&incomplete=${incomplete}`);
}

export async function rejectScheduleImport(documentId: string) {
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
    revalidatePath("/dashboard/emploi-du-temps/import");
    redirect("/dashboard/emploi-du-temps/import");
  }
  if (doc.status !== "pending_review") {
    throw new Error(`Cet import ne peut pas être rejeté (statut actuel : ${doc.status}).`);
  }

  const { error } = await supabase
    .from("documents")
    .update({ status: "rejected", reviewed_by: user!.id, reviewed_at: new Date().toISOString() })
    .eq("id", documentId);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/emploi-du-temps/import");
  redirect("/dashboard/emploi-du-temps/import");
}

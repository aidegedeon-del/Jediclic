"use server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/dashboard/context";
import { revalidatePath } from "next/cache";

export async function createSlot(formData: FormData) {
  const supabase = await createClient();
  const { user, membership } = await requireCurrentOrg();

  const { error } = await supabase.from("schedule_slots").insert({
    organization_id: membership.organization_id,
    teacher_id: user!.id,
    class_id: String(formData.get("classId")),
    subject_id: String(formData.get("subjectId")),
    weekday: Number(formData.get("weekday")),
    start_time: String(formData.get("startTime")),
    end_time: String(formData.get("endTime")),
    room: String(formData.get("room") ?? "") || null,
  });

  // La contrainte "no_teacher_overlap" (migration 0003) rejette les
  // chevauchements directement en base — Convention §18 / §26.
  if (error) {
    if (error.message.includes("no_teacher_overlap")) {
      throw new Error("Ce créneau chevauche un autre cours déjà programmé.");
    }
    throw new Error(error.message);
  }
  revalidatePath("/dashboard/emploi-du-temps");
}

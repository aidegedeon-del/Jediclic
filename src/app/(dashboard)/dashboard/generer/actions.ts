"use server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/dashboard/context";
import { generateAndPersist } from "@/lib/generation/generate";
import { GenerationType } from "@/lib/generation/prompts";
import { redirect } from "next/navigation";

export async function generateDraft(formData: FormData) {
  const supabase = await createClient();
  const { user, membership } = await requireCurrentOrg();

  const classId = String(formData.get("classId"));
  const curriculumUnitId = String(formData.get("curriculumUnitId") ?? "") || null;
  const competencyId = String(formData.get("competencyId") ?? "") || null;
  const type = String(formData.get("type")) as GenerationType;
  const extraInstructions = String(formData.get("extraInstructions") ?? "").trim();

  const result = await generateAndPersist(supabase, {
    organizationId: membership.organization_id,
    teacherId: user.id,
    classId,
    curriculumUnitId,
    competencyId,
    type,
    extraInstructions,
  });

  redirect(`/dashboard/generer/${result.table}/${result.id}`);
}

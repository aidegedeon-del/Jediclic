import { createClient } from "@/lib/supabase/server";

// Un compte = plusieurs disciplines possibles.
// Les 2 premières disciplines utilisées par un compte sont gratuites.
//
// CORRECTION FIABILITÉ :
// - La race condition (deux créations simultanées → deux inserts) était déjà
//   partiellement gérée (recheck après erreur d'insert).
// - On renforce : en cas d'erreur d'insert qui N'EST PAS une violation de
//   contrainte unique, on re-lance l'erreur plutôt que de silencieusement
//   accorder la discipline.
// - La vérification count/insert n'est pas atomique côté applicatif (Supabase
//   ne supporte pas les transactions de session via le client JS). La contrainte
//   unique en base reste la seule barrière réelle contre les doublons — ce module
//   est une défense en profondeur.
export const FREE_DISCIPLINES_PER_TEACHER = 2;

export interface DisciplineGrant {
  subjectId: string;
  subjectName: string;
  source: "free" | "payment_submission";
}

export async function getTeacherDisciplineGrants(
  organizationId: string,
  teacherId: string
): Promise<DisciplineGrant[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("teacher_discipline_grants")
    .select("subject_id, source, subjects(name)")
    .eq("organization_id", organizationId)
    .eq("teacher_id", teacherId)
    .order("granted_at");

  return (data ?? []).map((row) => ({
    subjectId: row.subject_id,
    subjectName: row.subjects?.name ?? "Discipline",
    // `source` est un `text` en base côté typegen (Supabase ne reflète pas
    // les contraintes CHECK dans les types générés), mais une contrainte
    // SQL CHECK (migration 0027) garantit que seules ces deux valeurs
    // existent réellement — cast précis, pas `any`.
    source: row.source as "free" | "payment_submission",
  }));
}

export type EnsureDisciplineResult =
  | { granted: true }
  | { granted: false; reason: "limit_reached"; grantedCount: number };

export async function ensureDisciplineGranted(params: {
  organizationId: string;
  teacherId: string;
  subjectId: string;
}): Promise<EnsureDisciplineResult> {
  const supabase = await createClient();

  // Vérification si la discipline est déjà accordée
  const { data: existing } = await supabase
    .from("teacher_discipline_grants")
    .select("id")
    .eq("organization_id", params.organizationId)
    .eq("teacher_id", params.teacherId)
    .eq("subject_id", params.subjectId)
    .maybeSingle();
  if (existing) return { granted: true };

  const { count } = await supabase
    .from("teacher_discipline_grants")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", params.organizationId)
    .eq("teacher_id", params.teacherId);
  const grantedCount = count ?? 0;

  if (grantedCount >= FREE_DISCIPLINES_PER_TEACHER) {
    return { granted: false, reason: "limit_reached", grantedCount };
  }

  const { error } = await supabase.rpc("grant_free_teacher_discipline", {
    p_organization_id: params.organizationId,
    p_subject_id: params.subjectId,
  });

  if (error) {
    if (error.message?.toLowerCase().includes("limite de deux disciplines gratuites")) {
      return { granted: false, reason: "limit_reached", grantedCount: FREE_DISCIPLINES_PER_TEACHER };
    }
    throw new Error(error.message);
  }

  return { granted: true };
}

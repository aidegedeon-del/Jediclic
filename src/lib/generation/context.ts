import { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database.types";

// Convention §18 : quand l'information est disponible, l'IA DOIT en tenir
// compte (pays, année scolaire, niveau, classe, matière, programme,
// chapitre, compétence, progression, durée, objectif) — et ne jamais
// produire un contenu générique quand ce contexte est connu. Ce module ne
// fait qu'assembler ce contexte à partir de ce qui existe déjà en base ;
// il n'invente jamais une donnée manquante (§19/§54 : dire "non disponible").
export type PedagogicalContext = {
  countryName: string | null;
  schoolYearLabel: string | null;
  levelName: string | null;
  className: string;
  subjectName: string | null;
  curriculumVersionLabel: string | null;
  chapterTitle: string | null;
  competencyTitle: string | null;
  competencyDescription: string | null;
  recommendedHours: number | null;
  teacherProgressionStatus: string | null;
  missing: string[]; // ce qui a été demandé mais n'existe pas en base — à énoncer, jamais à inventer
};

export async function buildPedagogicalContext(
  supabase: SupabaseClient<Database>,
  params: { classId: string; curriculumUnitId?: string | null; competencyId?: string | null }
): Promise<PedagogicalContext> {
  const missing: string[] = [];

  const { data: klass } = await supabase
    .from("classes")
    .select(
      "id, name, education_level_id, school_year_id, education_levels(name, education_cycles(name, education_systems(name, country_id, countries(name)))), school_years(label)"
    )
    .eq("id", params.classId)
    .single();

  if (!klass) {
    return {
      countryName: null,
      schoolYearLabel: null,
      levelName: null,
      className: "Classe inconnue",
      subjectName: null,
      curriculumVersionLabel: null,
      chapterTitle: null,
      competencyTitle: null,
      competencyDescription: null,
      recommendedHours: null,
      teacherProgressionStatus: null,
      missing: ["classe"],
    };
  }

  const levelName = klass.education_levels?.name ?? null;
  const countryName = klass.education_levels?.education_cycles?.education_systems?.countries?.name ?? null;
  const schoolYearLabel = klass.school_years?.label ?? null;
  if (!countryName) missing.push("pays");
  if (!schoolYearLabel) missing.push("année scolaire");

  let subjectName: string | null = null;
  let curriculumVersionLabel: string | null = null;
  let chapterTitle: string | null = null;
  let recommendedHours: number | null = null;
  let competencyTitle: string | null = null;
  let competencyDescription: string | null = null;

  if (params.curriculumUnitId) {
    const { data: unit } = await supabase
      .from("curriculum_units")
      .select("title, recommended_hours, curricula(version_label, subjects(name))")
      .eq("id", params.curriculumUnitId)
      .single();
    if (unit) {
      chapterTitle = unit.title;
      recommendedHours = unit.recommended_hours ?? null;
      curriculumVersionLabel = unit.curricula?.version_label ?? null;
      subjectName = unit.curricula?.subjects?.name ?? null;
    } else {
      missing.push("chapitre du programme");
    }

    const { data: progression } = await supabase
      .from("teacher_progressions")
      .select("status")
      .eq("class_id", params.classId)
      .eq("curriculum_unit_id", params.curriculumUnitId)
      .maybeSingle();

    if (params.competencyId) {
      const { data: competency } = await supabase
        .from("competencies")
        .select("title, description")
        .eq("id", params.competencyId)
        .single();
      if (competency) {
        competencyTitle = competency.title;
        competencyDescription = competency.description ?? null;
      } else {
        missing.push("compétence");
      }
    }

    return {
      countryName,
      schoolYearLabel,
      levelName,
      className: klass.name,
      subjectName,
      curriculumVersionLabel,
      chapterTitle,
      competencyTitle,
      competencyDescription,
      recommendedHours,
      teacherProgressionStatus: progression?.status ?? null,
      missing,
    };
  }

  missing.push("chapitre du programme");
  return {
    countryName,
    schoolYearLabel,
    levelName,
    className: klass.name,
    subjectName,
    curriculumVersionLabel,
    chapterTitle,
    competencyTitle,
    competencyDescription,
    recommendedHours,
    teacherProgressionStatus: null,
    missing,
  };
}

// Rendu texte du contexte, injecté dans le prompt utilisateur envoyé à
// l'IA — et aussi affiché au professeur sur la page de génération pour la
// transparence (il voit exactement ce que l'IA a reçu).
export function renderContextForPrompt(ctx: PedagogicalContext): string {
  const lines = [
    `Pays : ${ctx.countryName ?? "non disponible"}`,
    `Année scolaire : ${ctx.schoolYearLabel ?? "non disponible"}`,
    `Niveau : ${ctx.levelName ?? "non disponible"}`,
    `Classe : ${ctx.className}`,
    `Matière : ${ctx.subjectName ?? "non disponible"}`,
    `Programme officiel : ${ctx.curriculumVersionLabel ?? "non disponible"}`,
    `Chapitre : ${ctx.chapterTitle ?? "non disponible"}`,
  ];
  if (ctx.competencyTitle) {
    lines.push(`Compétence visée : ${ctx.competencyTitle}${ctx.competencyDescription ? " — " + ctx.competencyDescription : ""}`);
  }
  if (ctx.recommendedHours) lines.push(`Durée recommandée par le programme : ${ctx.recommendedHours} h`);
  if (ctx.teacherProgressionStatus) lines.push(`Statut de progression du professeur sur ce chapitre : ${ctx.teacherProgressionStatus}`);
  if (ctx.missing.length > 0) {
    lines.push(
      `Informations NON disponibles en base (ne rien inventer à leur sujet, le signaler si pertinent) : ${ctx.missing.join(", ")}`
    );
  }
  return lines.join("\n");
}

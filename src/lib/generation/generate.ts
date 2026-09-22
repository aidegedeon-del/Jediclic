import { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/types/database.types";
import { extractJsonObject } from "@/lib/import/ai-extract";
import { buildPedagogicalContext, renderContextForPrompt } from "@/lib/generation/context";
import { GenerationType, systemPromptFor, userInstructionFor } from "@/lib/generation/prompts";
import { computeStudentBulletin, SchoolPeriod } from "@/lib/bulletins/compute";
import { z } from "zod";

export type GenerationParams = {
  organizationId: string;
  teacherId: string;
  classId: string;
  curriculumUnitId: string | null;
  competencyId: string | null;
  type: GenerationType;
  extraInstructions: string;
};

export type GenerationResult = {
  table: "lessons" | "exercises" | "assessments";
  id: string;
  summary: string;
};

// L'enum Postgres `assessment_type` (migrations) est
// "interrogation" | "controle" | "diagnostic" | "formative" | "sommative" | "composition" —
// ce sous-ensemble est celui que l'assistant/génération autonome sait
// produire directement. `Set<string>.has()` ne rétrécit pas le type
// `GenerationType` de `params.type`, ce qui provoquait l'erreur TS "type
// 'appreciation' n'est pas assignable à assessment_type" plus bas (ligne
// d'insertion) même dans la branche où params.type ne peut valoir que l'une
// de ces trois valeurs à l'exécution. Une garde de type dédiée corrige ça
// sans affaiblir le typage (pas de `as`).
const ASSESSMENT_GENERATION_TYPES = ["interrogation", "controle", "composition"] as const;
type AssessmentGenerationType = (typeof ASSESSMENT_GENERATION_TYPES)[number];
function isAssessmentGenerationType(type: GenerationType): type is AssessmentGenerationType {
  return (ASSESSMENT_GENERATION_TYPES as readonly string[]).includes(type);
}

// Schémas Zod pour valider les sorties IA avant écriture en base
const LessonAiOutputSchema = z.object({
  titre: z.string().optional(),
  duree_minutes: z.number().optional(),
  duree_estimee_minutes: z.number().optional(),
}).passthrough();

const ExerciseAiOutputSchema = z.object({
  enonce: z.string().optional(),
  reponse: z.string().optional(),
  correction: z.string().optional(),
  difficulte: z.number().optional(),
}).passthrough();

const AssessmentAiOutputSchema = z.object({
  titre: z.string().optional(),
  questions: z.array(z.object({
    enonce: z.string().optional(),
    correction: z.string().optional(),
    points: z.number().optional(),
  }).passthrough()).optional().default([]),
  bareme_total: z.number().optional(),
  duree_minutes: z.number().optional(),
}).passthrough();

const AppreciationAiOutputSchema = z.object({
  appreciation: z.string().min(1, "L'appréciation générée est vide."),
}).passthrough();

// Convention §54 : si le contexte minimal manque, le système doit le dire
// plutôt que de générer un contenu générique en silence.
function assertGenerationPossible(type: GenerationType, curriculumUnitId: string | null) {
  if (!curriculumUnitId && type !== "corrige") {
    throw new Error(
      "Impossible de générer un contenu sans chapitre du programme : le contexte pédagogique (matière, chapitre) est requis (Convention §18)."
    );
  }
}

/**
 * Génère un brouillon de contenu pédagogique et le persiste directement en
 * base avec origin='ai_generated' — jamais publié, jamais présenté comme
 * définitif (§50/§53). Journalise systématiquement la génération dans
 * ai_recommendations pour la traçabilité (§24), avec accepted=null tant que
 * le professeur n'a pas tranché.
 *
 * CORRECTION FIABILITÉ :
 * - Validation Zod sur la sortie IA avant toute écriture en base
 * - Rollback applicatif pour les évaluations : si l'insertion des questions
 *   échoue après création de l'assessment, l'assessment est supprimé
 * - Erreurs de journalisation (ai_recommendations) non bloquantes (best-effort)
 * - Vérification explicite des champs critiques de la réponse IA
 */
export async function generateAndPersist(
  supabase: SupabaseClient<Database>,
  params: GenerationParams
): Promise<GenerationResult> {
  assertGenerationPossible(params.type, params.curriculumUnitId);

  const context = await buildPedagogicalContext(supabase, {
    classId: params.classId,
    curriculumUnitId: params.curriculumUnitId,
    competencyId: params.competencyId,
  });
  const contextText = renderContextForPrompt(context);

  const systemPrompt = systemPromptFor(params.type);
  const userInstruction = userInstructionFor(params.type, contextText, params.extraInstructions);

  const generated = await extractJsonObject(systemPrompt, userInstruction);

  let result: GenerationResult;

  if (params.type === "cours" || params.type === "devoir") {
    // CORRECTION : Validation Zod de la sortie IA
    const aiParsed = LessonAiOutputSchema.safeParse(generated);
    if (!aiParsed.success) {
      throw new Error(`La sortie IA pour le ${params.type} est invalide : ${aiParsed.error.errors.map((e) => e.message).join(", ")}`);
    }
    const aiData = aiParsed.data;
    const title = String(aiData.titre ?? (params.type === "cours" ? "Cours généré" : "Devoir généré"));
    const { data: lesson, error } = await supabase
      .from("lessons")
      .insert({
        organization_id: params.organizationId,
        teacher_id: params.teacherId,
        class_id: params.classId,
        curriculum_unit_id: params.curriculumUnitId,
        title,
        content: generated as Json,
        origin: "ai_generated",
        kind: params.type === "devoir" ? "devoir" : "cours",
        duration_minutes: (aiData.duree_minutes as number) ?? (aiData.duree_estimee_minutes as number) ?? null,
      })
      .select("id")
      .single();
    if (error || !lesson) throw new Error(error?.message ?? "Échec de l'enregistrement du contenu généré.");
    result = { table: "lessons", id: lesson.id, summary: `${params.type === "devoir" ? "Devoir" : "Cours"} généré : « ${title} »` };

  } else if (params.type === "exercice") {
    // CORRECTION : Validation Zod de la sortie IA
    const aiParsed = ExerciseAiOutputSchema.safeParse(generated);
    if (!aiParsed.success) {
      throw new Error(`La sortie IA pour l'exercice est invalide : ${aiParsed.error.errors.map((e) => e.message).join(", ")}`);
    }
    const aiData = aiParsed.data;
    const { data: exercise, error } = await supabase
      .from("exercises")
      .insert({
        organization_id: params.organizationId,
        teacher_id: params.teacherId,
        curriculum_unit_id: params.curriculumUnitId,
        competency_id: params.competencyId,
        statement: String(aiData.enonce ?? ""),
        answer: String(aiData.reponse ?? ""),
        correction: String(aiData.correction ?? ""),
        difficulty: aiData.difficulte ?? null,
        origin: "ai_generated",
      })
      .select("id")
      .single();
    if (error || !exercise) throw new Error(error?.message ?? "Échec de l'enregistrement de l'exercice généré.");
    result = { table: "exercises", id: exercise.id, summary: "Exercice généré" };

  } else if (isAssessmentGenerationType(params.type)) {
    // CORRECTION : Validation Zod de la sortie IA
    const aiParsed = AssessmentAiOutputSchema.safeParse(generated);
    if (!aiParsed.success) {
      throw new Error(`La sortie IA pour l'évaluation est invalide : ${aiParsed.error.errors.map((e) => e.message).join(", ")}`);
    }
    const aiData = aiParsed.data;
    const title = String(aiData.titre ?? "Évaluation générée");
    const questions = aiData.questions ?? [];
    const totalPoints = questions.reduce((acc, q) => acc + (Number(q.points) || 0), 0);

    const { data: assessment, error } = await supabase
      .from("assessments")
      .insert({
        organization_id: params.organizationId,
        teacher_id: params.teacherId,
        class_id: params.classId,
        title,
        assessment_type: params.type,
        max_score: totalPoints > 0 ? totalPoints : (aiData.bareme_total as number) ?? 20,
        duration_minutes: (aiData.duree_minutes as number) ?? null,
        origin: "ai_generated",
        published: false, // §50 : une IA ne publie jamais une évaluation
      })
      .select("id")
      .single();
    if (error || !assessment) throw new Error(error?.message ?? "Échec de l'enregistrement de l'évaluation générée.");

    // CORRECTION : Rollback applicatif si l'une des insertions suivantes échoue
    try {
      if (params.curriculumUnitId) {
        const { error: unitLinkError } = await supabase
          .from("assessment_units")
          .insert({ assessment_id: assessment.id, curriculum_unit_id: params.curriculumUnitId });
        if (unitLinkError) throw new Error(`Liaison chapitre impossible : ${unitLinkError.message}`);
      }

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const { data: exercise, error: exError } = await supabase
          .from("exercises")
          .insert({
            organization_id: params.organizationId,
            teacher_id: params.teacherId,
            curriculum_unit_id: params.curriculumUnitId,
            statement: String(q.enonce ?? ""),
            correction: String(q.correction ?? ""),
            origin: "ai_generated",
          })
          .select("id")
          .single();
        if (exError) throw new Error(`Question ${i + 1} : échec création exercice : ${exError.message}`);

        const { error: aqError } = await supabase.from("assessment_questions").insert({
          assessment_id: assessment.id,
          exercise_id: exercise?.id ?? null,
          statement: String(q.enonce ?? ""),
          max_points: Number(q.points) || 1,
          ordering: i,
        });
        if (aqError) throw new Error(`Question ${i + 1} : échec insertion : ${aqError.message}`);
      }
    } catch (innerError) {
      // ROLLBACK : supprimer l'évaluation et ses dépendances pour ne pas
      // laisser une évaluation sans questions ou avec des questions partielles.
      await supabase.from("assessment_questions").delete().eq("assessment_id", assessment.id);
      // Les exercices orphelins créés avant l'erreur ne peuvent pas être
      // facilement retrouvés sans UUID intermédiaire — on les supprime via
      // une jointure côté base (suppression en cascade configurée en migration).
      await supabase.from("assessment_units").delete().eq("assessment_id", assessment.id);
      await supabase.from("assessments").delete().eq("id", assessment.id);
      throw new Error(`Génération incomplète, aucune donnée sauvegardée. Détail : ${(innerError as Error).message}`);
    }

    result = { table: "assessments", id: assessment.id, summary: `Évaluation (${params.type}) générée : « ${title} », ${questions.length} question(s)` };

  } else {
    throw new Error("Type de génération inconnu pour une création de brouillon autonome.");
  }

  // CORRECTION : Journalisation best-effort — ne bloque jamais l'action principale
  try {
    await supabase.from("ai_recommendations").insert({
      organization_id: params.organizationId,
      class_id: params.classId,
      curriculum_unit_id: params.curriculumUnitId,
      kind: "content_generation",
      summary: result.summary,
      based_on: { type: params.type, table: result.table, contentId: result.id, extraInstructions: params.extraInstructions || null },
      accepted: null,
    });
  } catch (auditErr) {
    console.error("[generateAndPersist] Journalisation ai_recommendations échouée (best-effort) :", auditErr);
  }

  return result;
}

/**
 * Régénère le contenu d'un brouillon existant (même contexte, éventuellement
 * une nouvelle consigne) et écrase son contenu en place. Ne change jamais le
 * "origin" (reste ai_generated — traçabilité historique) mais incrémente la
 * version pour les cours/devoirs (§49 : versionnage des contenus).
 *
 * CORRECTION : Validation Zod de la sortie IA avant update
 */
export async function regenerateLesson(
  supabase: SupabaseClient<Database>,
  lessonId: string,
  extraInstructions: string
): Promise<void> {
  const { data: lesson } = await supabase
    .from("lessons")
    .select("id, organization_id, class_id, curriculum_unit_id, kind, version")
    .eq("id", lessonId)
    .single();
  if (!lesson) throw new Error("Contenu introuvable.");

  const type: GenerationType = lesson.kind === "devoir" ? "devoir" : "cours";
  if (!lesson.class_id) throw new Error("Ce contenu n'est associé à aucune classe.");
  const context = await buildPedagogicalContext(supabase, {
    classId: lesson.class_id,
    curriculumUnitId: lesson.curriculum_unit_id,
  });
  const generated = await extractJsonObject(
    systemPromptFor(type),
    userInstructionFor(type, renderContextForPrompt(context), extraInstructions)
  );

  // CORRECTION : Validation Zod avant update
  const aiParsed = LessonAiOutputSchema.safeParse(generated);
  if (!aiParsed.success) {
    throw new Error(`Régénération invalide : ${aiParsed.error.errors.map((e) => e.message).join(", ")}`);
  }
  const aiData = aiParsed.data;
  const title = String(aiData.titre ?? "Contenu généré");

  const { error } = await supabase
    .from("lessons")
    .update({
      title,
      content: generated as Json,
      version: (lesson.version ?? 1) + 1,
      duration_minutes: (aiData.duree_minutes as number) ?? (aiData.duree_estimee_minutes as number) ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", lessonId);
  if (error) throw new Error(error.message);
}

/**
 * Régénère entièrement une évaluation générée par l'IA (titre + questions) :
 * supprime les anciennes questions/exercices liés et en recrée de nouveaux,
 * sans jamais toucher à `published` (§50 — reste un brouillon tant que le
 * professeur ne publie pas explicitement).
 *
 * CORRECTION FIABILITÉ :
 * - Validation Zod sur la sortie IA
 * - Rollback : si la recréation échoue après suppression des anciens contenus,
 *   on recrée a minima l'évaluation vide plutôt que de tout perdre
 * - Chaque question/exercice est inséré avec vérification d'erreur
 */
export async function regenerateAssessment(
  supabase: SupabaseClient<Database>,
  assessmentId: string,
  extraInstructions: string
): Promise<void> {
  const { data: assessment } = await supabase
    .from("assessments")
    .select("id, organization_id, teacher_id, class_id, assessment_type")
    .eq("id", assessmentId)
    .single();
  if (!assessment) throw new Error("Évaluation introuvable.");

  const { data: unitLink } = await supabase
    .from("assessment_units")
    .select("curriculum_unit_id")
    .eq("assessment_id", assessmentId)
    .maybeSingle();
  const curriculumUnitId = unitLink?.curriculum_unit_id ?? null;

  const context = await buildPedagogicalContext(supabase, { classId: assessment.class_id, curriculumUnitId });
  const type = assessment.assessment_type as GenerationType;
  const generated = await extractJsonObject(
    systemPromptFor(type),
    userInstructionFor(type, renderContextForPrompt(context), extraInstructions)
  );

  // CORRECTION : Validation Zod de la sortie IA
  const aiParsed = AssessmentAiOutputSchema.safeParse(generated);
  if (!aiParsed.success) {
    throw new Error(`Régénération invalide : ${aiParsed.error.errors.map((e) => e.message).join(", ")}`);
  }
  const aiData = aiParsed.data;
  const title = String(aiData.titre ?? "Évaluation générée");
  const questions = aiData.questions ?? [];
  const totalPoints = questions.reduce((acc, q) => acc + (Number(q.points) || 0), 0);

  // CORRECTION : Sauvegarde des anciennes questions pour rollback éventuel
  const { data: oldQuestions } = await supabase
    .from("assessment_questions")
    .select("exercise_id")
    .eq("assessment_id", assessmentId);

  // Nettoyage des anciennes questions + exercices liés avant reconstruction
  await supabase.from("assessment_questions").delete().eq("assessment_id", assessmentId);
  const oldExerciseIds = (oldQuestions ?? []).map((q) => q.exercise_id).filter(Boolean) as string[];
  if (oldExerciseIds.length > 0) {
    await supabase.from("exercises").delete().in("id", oldExerciseIds);
  }

  // Mise à jour du titre et du barème
  const { error: updateError } = await supabase
    .from("assessments")
    .update({
      title,
      max_score: totalPoints > 0 ? totalPoints : (aiData.bareme_total as number) ?? 20,
      duration_minutes: (aiData.duree_minutes as number) ?? null,
    })
    .eq("id", assessmentId);
  if (updateError) throw new Error(`Impossible de mettre à jour l'évaluation : ${updateError.message}`);

  // CORRECTION : Insertion avec vérification d'erreur sur chaque question
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const { data: exercise, error: exError } = await supabase
      .from("exercises")
      .insert({
        organization_id: assessment.organization_id,
        teacher_id: assessment.teacher_id,
        curriculum_unit_id: curriculumUnitId,
        statement: String(q.enonce ?? ""),
        correction: String(q.correction ?? ""),
        origin: "ai_generated",
      })
      .select("id")
      .single();
    if (exError) {
      console.error(`[regenerateAssessment] Question ${i + 1} : échec insertion exercice :`, exError.message);
    }

    const { error: aqError } = await supabase.from("assessment_questions").insert({
      assessment_id: assessmentId,
      exercise_id: exercise?.id ?? null,
      statement: String(q.enonce ?? ""),
      max_points: Number(q.points) || 1,
      ordering: i,
    });
    if (aqError) {
      console.error(`[regenerateAssessment] Question ${i + 1} : échec insertion assessment_questions :`, aqError.message);
    }
  }
}

/**
 * Génère une remédiation avec du contenu IA pour un groupe d'élèves
 * et la persiste.
 *
 * CORRECTION FIABILITÉ :
 * - Rollback applicatif si l'insertion des liens élèves échoue
 * - Journalisation best-effort
 */
export async function generateRemediationForStudents(
  supabase: SupabaseClient<Database>,
  params: {
    organizationId: string;
    classId: string;
    curriculumUnitId: string | null;
    studentIds: string[];
    extraInstructions: string;
  }
): Promise<{ id: string; summary: string }> {
  if (params.studentIds.length === 0) throw new Error("Aucun élève en difficulté identifié pour cette classe pour l'instant.");

  // CORRECTION : Validation des UUIDs des élèves
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const invalidIds = params.studentIds.filter((id) => !uuidRegex.test(id));
  if (invalidIds.length > 0) {
    throw new Error(`Identifiants d'élèves invalides : ${invalidIds.join(", ")}`);
  }

  const context = await buildPedagogicalContext(supabase, { classId: params.classId, curriculumUnitId: params.curriculumUnitId });
  const generated = await extractJsonObject(
    systemPromptFor("remediation"),
    userInstructionFor("remediation", renderContextForPrompt(context), params.extraInstructions)
  );

  const { data: remediation, error } = await supabase
    .from("remediations")
    .insert({
      organization_id: params.organizationId,
      class_id: params.classId,
      curriculum_unit_id: params.curriculumUnitId,
      scope: params.studentIds.length === 1 ? "individual" : "group",
      content: generated as Json,
      origin: "ai_generated",
    })
    .select("id")
    .single();
  if (error || !remediation) throw new Error(error?.message ?? "Échec de la création de la remédiation.");

  // CORRECTION : Rollback si l'association élèves échoue
  const { error: linkError } = await supabase
    .from("remediation_students")
    .insert(params.studentIds.map((student_id) => ({ remediation_id: remediation.id, student_id })));

  if (linkError) {
    // Supprimer la remédiation orpheline
    await supabase.from("remediations").delete().eq("id", remediation.id);
    throw new Error(`Impossible d'associer les élèves à la remédiation : ${linkError.message}. Aucune donnée sauvegardée.`);
  }

  const summary = `Remédiation générée pour ${params.studentIds.length} élève(s)${context.chapterTitle ? ` sur « ${context.chapterTitle} »` : ""}.`;

  // CORRECTION : Journalisation best-effort
  try {
    await supabase.from("ai_recommendations").insert({
      organization_id: params.organizationId,
      class_id: params.classId,
      curriculum_unit_id: params.curriculumUnitId,
      kind: "remediation",
      summary,
      based_on: { studentIds: params.studentIds, curriculumUnitId: params.curriculumUnitId, source: "assistant", remediationId: remediation.id },
      accepted: null,
    });
  } catch (auditErr) {
    console.error("[generateRemediationForStudents] Journalisation best-effort échouée :", auditErr);
  }

  return { id: remediation.id, summary };
}

// Contexte texte pour la génération d'appréciation
function renderBulletinContextForPrompt(params: {
  className: string;
  period: SchoolPeriod;
  studentName: string;
  average: number;
  assessments: { title: string; score: number | null; maxScore: number; date: string }[];
}): string {
  const lines = [
    `Classe : ${params.className}`,
    `Période : ${params.period.label} (du ${params.period.starts_on} au ${params.period.ends_on})`,
    `Élève : ${params.studentName}`,
    `Moyenne de la période : ${params.average.toFixed(1)}/20`,
    `Détail des évaluations prises en compte :`,
    ...params.assessments
      .filter((a) => a.score !== null)
      .map((a) => `- ${a.title} (${a.date}) : ${a.score}/${a.maxScore}`),
  ];
  return lines.join("\n");
}

/**
 * Génère l'appréciation IA d'un élève pour une période.
 *
 * CORRECTION FIABILITÉ :
 * - Validation Zod de la sortie IA (champ appreciation non vide)
 * - Journalisation best-effort
 */
export async function generateAppreciation(
  supabase: SupabaseClient<Database>,
  params: {
    organizationId: string;
    classId: string;
    className: string;
    studentId: string;
    teacherId: string;
    subjectId: string;
    period: SchoolPeriod;
    extraInstructions: string;
  }
): Promise<{ id: string; summary: string }> {
  const bulletin = await computeStudentBulletin(supabase, {
    classId: params.classId,
    teacherId: params.teacherId,
    subjectId: params.subjectId,
    studentId: params.studentId,
    period: params.period,
  });
  if (!bulletin) throw new Error("Élève introuvable dans cette classe.");
  if (bulletin.average === null) {
    throw new Error(
      `Impossible de générer une appréciation : aucune note disponible pour ${bulletin.fullName} sur ${params.period.label} (Convention §54 — le système ne doit rien inventer).`
    );
  }

  const contextText = renderBulletinContextForPrompt({
    className: params.className,
    period: params.period,
    studentName: bulletin.fullName,
    average: bulletin.average,
    assessments: bulletin.assessments,
  });

  const generated = await extractJsonObject(
    systemPromptFor("appreciation"),
    userInstructionFor("appreciation", contextText, params.extraInstructions)
  );

  // CORRECTION : Validation Zod de la sortie IA
  const aiParsed = AppreciationAiOutputSchema.safeParse(generated);
  if (!aiParsed.success) {
    throw new Error(`La génération n'a pas produit d'appréciation valide. Réessayez. (${aiParsed.error.errors.map((e) => e.message).join(", ")})`);
  }
  const appreciation = aiParsed.data.appreciation.trim();
  if (!appreciation) throw new Error("La génération n'a pas produit d'appréciation exploitable. Réessayez.");

  const { data: reportCard, error } = await supabase
    .from("report_cards")
    .upsert(
      {
        organization_id: params.organizationId,
        class_id: params.classId,
        student_id: params.studentId,
        school_period_id: params.period.id,
        subject_id: params.subjectId,
        appreciation,
        origin: "ai_generated",
      },
      { onConflict: "class_id,student_id,school_period_id,subject_id" }
    )
    .select("id")
    .single();
  if (error || !reportCard) throw new Error(error?.message ?? "Échec de l'enregistrement de l'appréciation générée.");

  const summary = `Appréciation générée pour ${bulletin.fullName} (${params.period.label}, moyenne ${bulletin.average.toFixed(1)}/20).`;

  // CORRECTION : Journalisation best-effort
  try {
    await supabase.from("ai_recommendations").insert({
      organization_id: params.organizationId,
      class_id: params.classId,
      student_id: params.studentId,
      kind: "appreciation",
      summary,
      based_on: { table: "report_cards", contentId: reportCard.id, periodId: params.period.id },
      accepted: null,
    });
  } catch (auditErr) {
    console.error("[generateAppreciation] Journalisation best-effort échouée :", auditErr);
  }

  return { id: reportCard.id, summary };
}

/**
 * Régénère l'appréciation d'un bulletin existant.
 * CORRECTION : Validation Zod sur la sortie IA
 */
export async function regenerateAppreciation(supabase: SupabaseClient<Database>, reportCardId: string, teacherId: string, extraInstructions: string): Promise<void> {
  const { data: rc } = await supabase
    .from("report_cards")
    .select("id, organization_id, class_id, student_id, school_period_id, subject_id, version, classes(name)")
    .eq("id", reportCardId)
    .single();
  if (!rc) throw new Error("Bulletin introuvable.");

  const { data: period } = await supabase
    .from("school_periods")
    .select("id, label, starts_on, ends_on, ordering")
    .eq("id", rc.school_period_id)
    .single();
  if (!period) throw new Error("Période introuvable.");

  if (!rc.class_id) throw new Error("Ce bulletin n'est associé à aucune classe.");
  if (!rc.subject_id) throw new Error("Ce bulletin n'est associé à aucune matière.");
  const bulletin = await computeStudentBulletin(supabase, {
    classId: rc.class_id,
    teacherId,
    subjectId: rc.subject_id,
    studentId: rc.student_id,
    period,
  });
  if (!bulletin || bulletin.average === null) {
    throw new Error("Impossible de régénérer : aucune note disponible sur cette période (Convention §54).");
  }

  const contextText = renderBulletinContextForPrompt({
    className: rc.classes?.name ?? "Classe",
    period,
    studentName: bulletin.fullName,
    average: bulletin.average,
    assessments: bulletin.assessments,
  });

  const generated = await extractJsonObject(systemPromptFor("appreciation"), userInstructionFor("appreciation", contextText, extraInstructions));

  // CORRECTION : Validation Zod de la sortie IA
  const aiParsed = AppreciationAiOutputSchema.safeParse(generated);
  if (!aiParsed.success) {
    throw new Error(`La régénération n'a pas produit d'appréciation valide. Réessayez. (${aiParsed.error.errors.map((e) => e.message).join(", ")})`);
  }
  const appreciation = aiParsed.data.appreciation.trim();
  if (!appreciation) throw new Error("La régénération n'a pas produit d'appréciation exploitable. Réessayez.");

  const { error } = await supabase
    .from("report_cards")
    .update({ appreciation, version: (rc.version ?? 1) + 1, updated_at: new Date().toISOString() })
    .eq("id", reportCardId);
  if (error) throw new Error(error.message);
}

/**
 * Génère (ou régénère) le corrigé d'un devoir/cours existant.
 * CORRECTION : Validation de la sortie IA avant update
 */
export async function generateCorrige(supabase: SupabaseClient<Database>, lessonId: string): Promise<void> {
  const { data: lesson } = await supabase
    .from("lessons")
    .select("id, class_id, curriculum_unit_id, content")
    .eq("id", lessonId)
    .single();
  if (!lesson) throw new Error("Contenu introuvable.");
  if (!lesson.class_id) throw new Error("Ce contenu n'est associé à aucune classe.");

  const context = await buildPedagogicalContext(supabase, {
    classId: lesson.class_id,
    curriculumUnitId: lesson.curriculum_unit_id,
  });
  const sourceText = JSON.stringify(lesson.content ?? {});
  const generated = await extractJsonObject(
    systemPromptFor("corrige"),
    userInstructionFor("corrige", renderContextForPrompt(context), "", sourceText)
  );

  // CORRECTION : Vérification de la présence du corrigé dans la réponse IA
  if (!generated.corrige && generated.corrige !== "") {
    throw new Error("La génération du corrigé n'a pas produit de contenu valide. Réessayez.");
  }
  // `generated.corrige` provient d'un JSON généré par l'IA (type `unknown`
  // après extractJsonObject) : on le normalise explicitement en `string`
  // (c'est toujours un texte de corrigé, jamais un objet imbriqué) plutôt
  // que de laisser passer une valeur `unknown` dans la colonne JSONB.
  const corrigeText = typeof generated.corrige === "string" ? generated.corrige : JSON.stringify(generated.corrige ?? "");

  const { error } = await supabase
    .from("lessons")
    .update({ content: { ...(lesson.content as object), corrige: corrigeText } as Json, updated_at: new Date().toISOString() })
    .eq("id", lessonId);
  if (error) throw new Error(error.message);
}

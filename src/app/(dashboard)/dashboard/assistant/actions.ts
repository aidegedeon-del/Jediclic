"use server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/dashboard/context";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database.types";
import { routeAssistantMessage } from "@/lib/assistant/router";
import { findBestMatch } from "@/lib/import/match";
import { generateAndPersist, generateRemediationForStudents, generateAppreciation, generateCorrige } from "@/lib/generation/generate";
import { computeClassAnalysis, computeClassAverage } from "@/lib/analysis/compute";
import { computeOrgProgressionDrift } from "@/lib/progress/compute";
import { listSchoolPeriods, getTeacherSubjectsForClass } from "@/lib/bulletins/compute";
import { listSchoolCalendarEvents, findCalendarEventForDate } from "@/lib/dashboard/school-calendar";
import { getOrgLicenseStatus } from "@/lib/subscriptions/quota";
import type { Json } from "@/lib/types/database.types";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// CORRECTION : Schéma de validation du message entrant
const AssistantMessageSchema = z.object({
  message: z.string().min(1, "Le message ne peut pas être vide.").max(2000, "Le message est trop long (max 2000 caractères)."),
});

async function resolveClass(supabase: SupabaseClient<Database>, orgId: string, className: string | null) {
  const { data: classes } = await supabase.from("classes").select("id, name, education_level_id, school_year_id").eq("organization_id", orgId).is("archived_at", null);
  if (!className) return { classes: classes ?? [], matchedClass: null };
  const matchedId = findBestMatch(className, classes ?? []);
  return { classes: classes ?? [], matchedClass: (classes ?? []).find((c) => c.id === matchedId) ?? null };
}

async function resolveChapter(supabase: SupabaseClient<Database>, educationLevelId: string, chapterTitle: string | null) {
  if (!chapterTitle) return null;
  const { data: curricula } = await supabase.from("curricula").select("id").eq("education_level_id", educationLevelId).eq("is_active", true);
  const curriculumIds = (curricula ?? []).map((c) => c.id);
  if (curriculumIds.length === 0) return null;
  const { data: units } = await supabase.from("curriculum_units").select("id, title").in("curriculum_id", curriculumIds);
  const matchedId = findBestMatch(chapterTitle, (units ?? []).map((u) => ({ id: u.id, name: u.title })));
  return (units ?? []).find((u) => u.id === matchedId) ?? null;
}

async function resolveStudent(supabase: SupabaseClient<Database>, classId: string, studentName: string | null) {
  if (!studentName) return null;
  const { data: students } = await supabase.from("students").select("id, full_name").eq("class_id", classId).is("archived_at", null);
  const matchedId = findBestMatch(studentName, (students ?? []).map((s) => ({ id: s.id, name: s.full_name })));
  return (students ?? []).find((s) => s.id === matchedId) ?? null;
}

async function resolveCurrentPeriod(supabase: SupabaseClient<Database>, schoolYearId: string) {
  const periods = await listSchoolPeriods(supabase, schoolYearId);
  const todayStr = new Date().toISOString().slice(0, 10);
  return periods.find((p) => p.starts_on <= todayStr && todayStr <= p.ends_on) ?? null;
}

function targetWeekday(when: "today" | "tomorrow" | null): number {
  const jsDay = new Date(when === "tomorrow" ? Date.now() + 86400000 : Date.now()).getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

// CORRECTION FIABILITÉ :
// - Validation Zod du message entrant (longueur, non-vide)
// - Retour explicite si message vide (au lieu du return silencieux)
// - Le try/catch global existant est conservé et renforcé
// - Erreur d'insertion du message utilisateur propagée (ne pas silencier)
export async function sendAssistantMessage(formData: FormData) {
  const supabase = await createClient();
  const { user, membership } = await requireCurrentOrg();
  const orgId = membership.organization_id;

  // CORRECTION : Validation Zod du message
  const rawMessage = String(formData.get("message") ?? "").trim();
  const parsed = AssistantMessageSchema.safeParse({ message: rawMessage });
  if (!parsed.success) {
    // Message invalide → ne pas appeler l'IA, retourner une erreur métier
    const errorMsg = parsed.error.errors.map((e) => e.message).join(" | ");
    await supabase.from("assistant_messages").insert({
      organization_id: orgId,
      user_id: user.id,
      role: "assistant",
      content: errorMsg,
      metadata: { intent: "validation_error" },
    });
    revalidatePath("/dashboard/assistant");
    return;
  }
  const message = parsed.data.message;

  // Enregistrement du message utilisateur
  const { error: userMsgError } = await supabase
    .from("assistant_messages")
    .insert({ organization_id: orgId, user_id: user.id, role: "user", content: message });
  if (userMsgError) {
    console.error("[sendAssistantMessage] Impossible d'enregistrer le message utilisateur :", userMsgError.message);
    // Non-bloquant : continuer même si l'historique n'est pas enregistré
  }

  let reply: string;
  let metadata: Json = {};

  try {
    const routed = await routeAssistantMessage(message);
    const { matchedClass } = await resolveClass(supabase, orgId, routed.className);

    const needsClass =
      routed.intent !== "unsupported" &&
      routed.intent !== "clarification_needed" &&
      routed.intent !== "query_schedule" &&
      routed.intent !== "query_pending_assessments" &&
      routed.intent !== "query_subscription_status";

    if (routed.intent === "clarification_needed") {
      reply = routed.clarificationQuestion || "Pouvez-vous préciser la classe concernée ?";
    } else if (routed.intent === "unsupported") {
      reply =
        "Je ne peux pas encore faire cela. Aujourd'hui je peux : préparer un cours, un devoir, un exercice, une interrogation/un contrôle/une composition, préparer une remédiation, rédiger une appréciation de bulletin, générer un corrigé, répondre sur les élèves/chapitres en difficulté, donner la moyenne ou l'effectif d'une classe, indiquer votre emploi du temps, lister ce qu'il reste à corriger, vérifier votre abonnement, ou faire un point sur votre progression.";
    } else if (routed.intent === "query_schedule") {
      const weekday = targetWeekday(routed.scheduleWhen);
      const dayLabel = routed.scheduleWhen === "tomorrow" ? "demain" : "aujourd'hui";
      const { data: slots } = await supabase
        .from("schedule_slots")
        .select("start_time, end_time, room, classes(name), subjects(name)")
        .eq("teacher_id", user.id)
        .eq("weekday", weekday)
        .order("start_time");
      metadata = { intent: routed.intent, weekday };
      if (!slots || slots.length === 0) {
        reply = `Vous n'avez aucun cours prévu ${dayLabel} dans votre emploi du temps.`;
      } else {
        const list = slots
          .map((s) => `${s.start_time.slice(0, 5)}-${s.end_time.slice(0, 5)} ${s.classes?.name ?? ""}${s.subjects?.name ? ` (${s.subjects.name})` : ""}${s.room ? ` — salle ${s.room}` : ""}`)
          .join(" · ");
        reply = `Votre emploi du temps ${dayLabel} : ${list}.`;
      }
    } else if (routed.intent === "query_pending_assessments") {
      if (routed.className && !matchedClass) {
        reply = `Je ne trouve pas de classe correspondant à « ${routed.className} ». Vérifiez le nom exact dans Classes.`;
      } else {
        let classesToCheck: { id: string; name: string }[];
        if (matchedClass) {
          classesToCheck = [{ id: matchedClass.id, name: matchedClass.name }];
        } else {
          const { data: myClasses } = await supabase
            .from("classes")
            .select("id, name")
            .eq("organization_id", orgId)
            .eq("teacher_id", user.id)
            .is("archived_at", null);
          classesToCheck = myClasses ?? [];
        }
        const classIds = classesToCheck.map((c) => c.id);
        const [{ data: assessments }, { data: students }] = await Promise.all([
          classIds.length > 0
            ? supabase.from("assessments").select("id, title, class_id, published").in("class_id", classIds)
            : Promise.resolve({ data: null }),
          classIds.length > 0
            ? supabase.from("students").select("id, class_id").in("class_id", classIds).is("archived_at", null)
            : Promise.resolve({ data: null }),
        ]);
        const classNameById = new Map(classesToCheck.map((c) => [c.id, c.name]));
        const studentsCountByClass = new Map<string, number>();
        for (const s of students ?? []) {
          studentsCountByClass.set(s.class_id, (studentsCountByClass.get(s.class_id) ?? 0) + 1);
        }
        const assessmentIds = (assessments ?? []).map((a) => a.id);
        const { data: results } = assessmentIds.length > 0
          ? await supabase.from("results").select("assessment_id").in("assessment_id", assessmentIds)
          : { data: null };
        const resultsCountByAssessment = new Map<string, number>();
        for (const r of results ?? []) {
          resultsCountByAssessment.set(r.assessment_id, (resultsCountByAssessment.get(r.assessment_id) ?? 0) + 1);
        }
        const pending = (assessments ?? []).filter((a) => {
          if (!a.published) return true;
          const expected = studentsCountByClass.get(a.class_id) ?? 0;
          const entered = resultsCountByAssessment.get(a.id) ?? 0;
          return expected > 0 && entered < expected;
        });
        if (pending.length === 0) {
          reply = matchedClass
            ? `Rien à corriger pour ${matchedClass.name} : toutes les évaluations sont publiées avec les notes saisies.`
            : "Rien à corriger : toutes vos évaluations sont publiées avec les notes saisies.";
        } else {
          const list = pending
            .map((a) => `${a.title} (${classNameById.get(a.class_id) ?? "classe"})${a.published ? " — notes incomplètes" : " — brouillon non publié"}`)
            .join(" · ");
          reply = `À traiter : ${list}.`;
        }
        metadata = { intent: routed.intent, classIds, pendingCount: pending.length };
      }
    } else if (routed.intent === "query_subscription_status") {
      const license = await getOrgLicenseStatus(orgId);
      metadata = { intent: routed.intent };
      if (!license.hasSubscription) {
        reply = "Aucun abonnement actif pour l'instant.";
      } else {
        const statusLabel = license.subscriptionStatus === "active" ? "actif" : license.subscriptionStatus === "past_due" ? "paiement dû" : license.subscriptionStatus ?? "";
        const periodEnd = license.currentPeriodEnd ? ` jusqu'au ${new Date(license.currentPeriodEnd).toLocaleDateString("fr-FR")}` : "";
        reply = `Abonnement ${license.plan?.name ?? ""} — statut : ${statusLabel}${periodEnd}.`;
      }
    } else if (needsClass && !matchedClass) {
      reply = routed.className
        ? `Je ne trouve pas de classe correspondant à « ${routed.className} ». Vérifiez le nom exact dans Classes.`
        : "Pour quelle classe ? (précisez le nom exact, ex. « 3e A »)";
    } else {
      const chapter = await resolveChapter(supabase, matchedClass!.education_level_id, routed.chapterTitle);
      metadata = { intent: routed.intent, classId: matchedClass!.id, curriculumUnitId: chapter?.id ?? null };

      switch (routed.intent) {
        case "generate_lesson":
        case "generate_devoir":
        case "generate_exercise":
        case "generate_assessment": {
          if (!chapter) {
            reply = routed.chapterTitle
              ? `Je ne trouve pas de chapitre correspondant à « ${routed.chapterTitle} » au programme de ${matchedClass!.name}. Vérifiez le titre exact dans Programme & progression.`
              : `Quel chapitre du programme pour ${matchedClass!.name} ?`;
          } else {
            const type =
              routed.intent === "generate_lesson"
                ? "cours"
                : routed.intent === "generate_devoir"
                ? "devoir"
                : routed.intent === "generate_exercise"
                ? "exercice"
                : routed.assessmentType ?? "interrogation";
            const result = await generateAndPersist(supabase, {
              organizationId: orgId,
              teacherId: user.id,
              classId: matchedClass!.id,
              curriculumUnitId: chapter.id,
              competencyId: null,
              type,
              extraInstructions: routed.extraInstructions ?? "",
            });
            reply = `${result.summary} pour ${matchedClass!.name} — chapitre « ${chapter.title} ». À relire ici : /dashboard/generer/${result.table}/${result.id}`;
            metadata = { ...metadata, table: result.table, contentId: result.id };
          }
          break;
        }
        case "generate_remediation": {
          const analysis = await computeClassAnalysis(supabase, matchedClass!.id);
          if (!analysis.hasData || analysis.studentsInDifficulty.length === 0) {
            reply = `Analyse impossible : aucune difficulté persistante détectée pour ${matchedClass!.name} avec les évaluations publiées disponibles actuellement.`;
          } else {
            const studentIds = analysis.studentsInDifficulty.map((s) => s.id);
            const result = await generateRemediationForStudents(supabase, {
              organizationId: orgId,
              classId: matchedClass!.id,
              curriculumUnitId: chapter?.id ?? null,
              studentIds,
              extraInstructions: routed.extraInstructions ?? "",
            });
            reply = `${result.summary} Voir la page Analyse & remédiation pour ${matchedClass!.name}.`;
            metadata = { ...metadata, remediationId: result.id, studentIds };
          }
          break;
        }
        case "query_difficulties": {
          const analysis = await computeClassAnalysis(supabase, matchedClass!.id);
          if (!analysis.hasData) {
            reply = `Analyse impossible : aucune note n'est disponible pour ${matchedClass!.name} pour l'instant.`;
          } else if (analysis.studentsInDifficulty.length === 0) {
            reply = `Les résultats disponibles n'indiquent aucune difficulté persistante pour ${matchedClass!.name} actuellement.`;
          } else {
            const names = analysis.studentsInDifficulty.slice(0, 8).map((s) => s.full_name).join(", ");
            const chapters = analysis.chapterStats
              .filter((c) => c.studentsBelow > 0)
              .slice(0, 5)
              .map((c) => `${c.title} (${c.average.toFixed(1)}/20)`)
              .join(", ");
            reply = `Pour ${matchedClass!.name}, les résultats disponibles indiquent une difficulté persistante pour : ${names}${analysis.studentsInDifficulty.length > 8 ? "…" : ""}.${chapters ? ` Chapitres concernés : ${chapters}.` : ""}`;
          }
          break;
        }
        case "progression_advice": {
          const drift = await computeOrgProgressionDrift(supabase, orgId);
          const classDrift = drift.filter((d) => d.classId === matchedClass!.id);
          const late = classDrift.filter((d) => d.drift.kind === "late");
          const ahead = classDrift.filter((d) => d.drift.kind === "ahead");
          if (classDrift.length === 0) {
            reply = `Aucune progression enregistrée pour ${matchedClass!.name} pour l'instant, ou le programme officiel n'est pas encore chargé pour ce niveau.`;
          } else if (late.length === 0 && ahead.length === 0) {
            reply = `Votre progression pour ${matchedClass!.name} est conforme au programme officiel sur les chapitres suivis.`;
          } else {
            const lateList = late.map((d) => `${d.unitTitle}${d.drift.daysDiff ? ` (${d.drift.daysDiff} j)` : ""}`).join(", ");
            const aheadList = ahead.map((d) => d.unitTitle).join(", ");
            reply = [
              late.length > 0 ? `⚠ En retard sur : ${lateList}.` : "",
              ahead.length > 0 ? `✓ En avance sur : ${aheadList}.` : "",
            ]
              .filter(Boolean)
              .join(" ");
          }
          break;
        }
        case "query_class_average": {
          const result = await computeClassAverage(supabase, matchedClass!.id);
          if (!result.hasData) {
            reply = `Aucune moyenne calculable pour ${matchedClass!.name} pour l'instant : aucune évaluation publiée avec des notes saisies.`;
          } else {
            reply = `La moyenne générale de ${matchedClass!.name} est de ${result.average!.toFixed(1)}/20 (sur ${result.studentsCount} élève${result.studentsCount > 1 ? "s" : ""}).`;
          }
          break;
        }
        case "generate_appreciation": {
          const student = await resolveStudent(supabase, matchedClass!.id, routed.studentName);
          if (!student) {
            reply = routed.studentName
              ? `Je ne trouve pas d'élève correspondant à « ${routed.studentName} » dans ${matchedClass!.name}. Vérifiez le nom exact.`
              : `Quel élève, dans ${matchedClass!.name} ?`;
            break;
          }
          const period = await resolveCurrentPeriod(supabase, matchedClass!.school_year_id);
          if (!period) {
            const calendarEvents = await listSchoolCalendarEvents(supabase, matchedClass!.school_year_id);
            const todayEvent = findCalendarEventForDate(calendarEvents, new Date().toISOString().slice(0, 10));
            reply = todayEvent
              ? `Nous sommes en ${todayEvent.label.toLowerCase()} aujourd'hui — aucun trimestre en cours pour ${matchedClass!.name}, revenez à la reprise.`
              : `Aucune période officielle ne couvre la date d'aujourd'hui pour ${matchedClass!.name} — impossible de déterminer sur quel trimestre générer l'appréciation.`;
            break;
          }
          const subjects = await getTeacherSubjectsForClass(supabase, { teacherId: user.id, classId: matchedClass!.id });
          if (subjects.length === 0) {
            reply = `Aucune discipline identifiée pour vous sur ${matchedClass!.name} (aucune évaluation créée pour cette classe). Créez d'abord une évaluation avant de générer une appréciation.`;
            break;
          }
          if (subjects.length > 1) {
            reply = `Vous couvrez plusieurs disciplines sur ${matchedClass!.name} (${subjects.map((s) => s.name).join(", ")}) — précisez laquelle depuis la page Bulletins.`;
            break;
          }
          const result = await generateAppreciation(supabase, {
            organizationId: orgId,
            classId: matchedClass!.id,
            className: matchedClass!.name,
            studentId: student.id,
            teacherId: user.id,
            subjectId: subjects[0].id,
            period,
            extraInstructions: routed.extraInstructions ?? "",
          });
          reply = `${result.summary} À relire ici : /dashboard/bulletins/${student.id}?classId=${matchedClass!.id}&periodId=${period.id}&subjectId=${subjects[0].id}`;
          metadata = { ...metadata, studentId: student.id, reportCardId: result.id, periodId: period.id };
          break;
        }
        case "query_student_count": {
          const { count } = await supabase
            .from("students")
            .select("id", { count: "exact", head: true })
            .eq("class_id", matchedClass!.id)
            .is("archived_at", null);
          reply = `${matchedClass!.name} compte ${count ?? 0} élève${(count ?? 0) > 1 ? "s" : ""}.`;
          break;
        }
        case "generate_corrige": {
          let lessonQuery = supabase
            .from("lessons")
            .select("id, title, kind")
            .eq("class_id", matchedClass!.id)
            .eq("kind", "devoir")
            .order("created_at", { ascending: false })
            .limit(1);
          if (chapter) lessonQuery = lessonQuery.eq("curriculum_unit_id", chapter.id);
          const { data: lessons } = await lessonQuery;
          const lesson = (lessons ?? [])[0];
          if (!lesson) {
            reply = chapter
              ? `Aucun devoir trouvé pour ${matchedClass!.name} sur le chapitre « ${chapter.title} ». Créez-le d'abord (les exercices ont déjà leur corrigé dès leur génération).`
              : `Aucun devoir trouvé pour ${matchedClass!.name}. Créez-le d'abord (les exercices ont déjà leur corrigé dès leur génération).`;
          } else {
            await generateCorrige(supabase, lesson.id);
            reply = `Corrigé généré pour « ${lesson.title} » (${matchedClass!.name}). À relire ici : /dashboard/generer/lessons/${lesson.id}`;
            metadata = { ...metadata, table: "lessons", contentId: lesson.id };
          }
          break;
        }
        default:
          reply = "Je ne peux pas encore faire cela.";
      }
    }
  } catch (e) {
    // CORRECTION : Message d'erreur plus informatif pour distinguer les erreurs
    // de configuration des erreurs métier
    const errMsg = e instanceof Error ? e.message : "erreur inconnue";
    if (errMsg.includes("GEMINI_API_KEY")) {
      reply = "Le service de génération IA n'est pas configuré. Contactez l'administrateur.";
    } else {
      reply = `Une erreur est survenue : ${errMsg}.`;
    }
    console.error("[sendAssistantMessage] Erreur :", errMsg);
  }

  const { error: assistantMsgError } = await supabase
    .from("assistant_messages")
    .insert({ organization_id: orgId, user_id: user.id, role: "assistant", content: reply, metadata });
  if (assistantMsgError) {
    console.error("[sendAssistantMessage] Impossible d'enregistrer la réponse :", assistantMsgError.message);
  }

  revalidatePath("/dashboard/assistant");
}

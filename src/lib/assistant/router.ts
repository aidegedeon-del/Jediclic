import { extractJsonObject } from "@/lib/import/ai-extract";

// PRD §51 : "Le professeur peut écrire naturellement : « Prépare mon cours
// de demain pour ma 3e A. » « Génère une interrogation sur le chapitre que
// nous venons de terminer. » « Quels sont les élèves qui ont le plus de
// difficultés ? » « Prépare une remédiation pour ces 6 élèves. » « Je suis
// en retard sur ma progression. Que dois-je faire ? »"
//
// Ce module ne fait qu'INTERPRÉTER le message en une intention structurée.
// Il ne résout jamais lui-même un nom de classe/chapitre en identifiant de
// base — ça reste au routeur serveur (src/app/.../assistant/actions.ts),
// avec findBestMatch, exactement comme pour les imports OCR (Convention §7 :
// aucune correspondance n'est appliquée sans qu'on puisse la vérifier).
export type AssistantIntent =
  | "generate_lesson"
  | "generate_devoir"
  | "generate_exercise"
  | "generate_assessment"
  | "generate_remediation"
  | "generate_appreciation"
  | "generate_corrige"
  | "query_difficulties"
  | "query_class_average"
  | "query_schedule"
  | "query_student_count"
  | "query_pending_assessments"
  | "query_subscription_status"
  | "progression_advice"
  | "clarification_needed"
  | "unsupported";

export type RoutedIntent = {
  intent: AssistantIntent;
  className: string | null;
  chapterTitle: string | null;
  assessmentType: "interrogation" | "controle" | "composition" | null;
  studentName: string | null;
  scheduleWhen: "today" | "tomorrow" | null;
  extraInstructions: string | null;
  clarificationQuestion: string | null;
};

const SYSTEM_PROMPT = `Tu es le routeur d'un assistant pédagogique pour professeurs (Côte d'Ivoire et pays francophones). Tu ne réponds JAMAIS toi-même à la demande : tu identifies uniquement quelle action le système doit exécuter, à partir du message du professeur.

Intentions possibles (utilise EXACTEMENT une de ces valeurs pour "intent") :
- "generate_lesson" : préparer un cours
- "generate_devoir" : préparer un devoir
- "generate_exercise" : générer un exercice
- "generate_assessment" : générer une interrogation / un contrôle / une composition (préciser "assessmentType")
- "generate_remediation" : préparer une remédiation pour les élèves en difficulté d'une classe
- "generate_appreciation" : rédiger/générer l'appréciation d'un bulletin pour un élève précis (préciser "studentName")
- "generate_corrige" : générer le corrigé du dernier devoir créé pour une classe (et un chapitre si précisé) — ne concerne jamais un exercice, qui a déjà son corrigé dès sa création
- "query_difficulties" : question sur les élèves ou chapitres en difficulté
- "query_class_average" : question sur la moyenne générale d'une classe
- "query_schedule" : question sur l'emploi du temps du professeur (préciser "scheduleWhen" : "today" si aujourd'hui, "tomorrow" si demain, sinon null)
- "query_student_count" : question sur le nombre d'élèves d'une classe
- "query_pending_assessments" : question sur les évaluations non publiées ou dont la saisie des notes n'est pas terminée ("qu'est-ce qu'il me reste à corriger"). Ne nécessite PAS forcément de classe : si aucune classe n'est mentionnée, laisser "className" à null (le système regardera toutes les classes du professeur).
- "query_subscription_status" : question sur l'état de l'abonnement/du paiement (ne nécessite jamais de classe)
- "progression_advice" : question sur l'avancement/le retard de la progression
- "clarification_needed" : la demande est dans le périmètre pédagogique mais une information indispensable manque (le plus souvent : quelle classe)
- "unsupported" : toute autre demande (hors périmètre de cet assistant)

Règles :
- Extrait "className", "chapterTitle" et "studentName" tels que mentionnés par le professeur, en texte libre, SANS les corriger ni les normaliser (le système fera la correspondance ensuite).
- N'invente jamais un nom de classe, de chapitre ou d'élève qui ne serait pas mentionné.
- Si le professeur ne précise pas de classe pour une action qui en a besoin, utilise "clarification_needed" et pose une question précise dans "clarificationQuestion". "query_schedule", "query_pending_assessments" et "query_subscription_status" n'ont jamais besoin de classe.
- Si le professeur demande une appréciation sans préciser l'élève, utilise "clarification_needed".
- Réponds UNIQUEMENT avec un objet JSON strict, sans texte avant/après, sans balises markdown.

Format JSON attendu :
{
  "intent": string,
  "className": string | null,
  "chapterTitle": string | null,
  "assessmentType": "interrogation" | "controle" | "composition" | null,
  "studentName": string | null,
  "scheduleWhen": "today" | "tomorrow" | null,
  "extraInstructions": string | null,
  "clarificationQuestion": string | null
}`;

export async function routeAssistantMessage(message: string): Promise<RoutedIntent> {
  const raw = await extractJsonObject(SYSTEM_PROMPT, `Message du professeur : "${message}"`);
  return {
    intent: (raw.intent as AssistantIntent) ?? "unsupported",
    className: (raw.className as string) ?? null,
    chapterTitle: (raw.chapterTitle as string) ?? null,
    assessmentType: (raw.assessmentType as "interrogation" | "controle" | "composition") ?? null,
    studentName: (raw.studentName as string) ?? null,
    scheduleWhen: (raw.scheduleWhen as "today" | "tomorrow") ?? null,
    extraInstructions: (raw.extraInstructions as string) ?? null,
    clarificationQuestion: (raw.clarificationQuestion as string) ?? null,
  };
}

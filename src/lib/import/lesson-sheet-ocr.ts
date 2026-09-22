import { extractJsonArray } from "./ai-extract";

// EF-DOC-01 : lecture d'une photo/PDF de fiche pédagogique / fiche de cours
// papier (PRD §20-21 : "photo d'une fiche pédagogique" -> reconnaître quand
// possible matière/classe/chapitre/notion/contenu/date). Même principe que
// schedule-ocr.ts et grade-sheet-ocr.ts : uniquement du texte libre en
// sortie, jamais un id deviné (Convention §7) — la page de relecture fait
// correspondre à une classe/un chapitre réels via menus déroulants.
export type ExtractedLessonSheet = {
  titleGuess: string | null;
  subjectNameRaw: string;
  classNameRaw: string;
  chapterNameRaw: string;
  dateGuess: string | null; // "YYYY-MM-DD" si identifiable
  objectifs: string | null;
  contenu: string | null;
};

const SYSTEM_PROMPT = `Tu extrais le contenu d'une fiche pédagogique/fiche de cours manuscrite ou imprimée (photo ou PDF) rédigée par un professeur, contexte scolaire ivoirien/francophone.

Règles strictes :
- Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, sans balises markdown.
- Forme exacte : {"title": string|null, "subjectName": string, "className": string, "chapterName": string, "date": string|null, "objectifs": string|null, "contenu": string|null}.
- "title" : titre de la séance/fiche si écrit, sinon null.
- "subjectName" : matière telle qu'écrite (ex: "Mathématiques"), chaîne vide si non identifiable.
- "className" : classe telle qu'écrite (ex: "4e B"), chaîne vide si non identifiable.
- "chapterName" : chapitre ou notion tel qu'écrit, chaîne vide si non identifiable.
- "date" : au format "YYYY-MM-DD" si lisible, sinon null.
- "objectifs" : objectifs pédagogiques transcrits tels quels (texte libre, plusieurs lignes possibles), null si absents de la fiche.
- "contenu" : le reste du contenu de la fiche transcrit tel quel (déroulé, activités, exemples, synthèse — tout ce qui n'est pas les objectifs), null si vide.
- Ne complète, ne corrige et n'invente jamais une information absente de la fiche : transcris fidèlement ce qui est écrit.
- Si le document n'est pas une fiche pédagogique exploitable, réponds avec toutes les chaînes vides/null.`;

function normalizeDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim()) ? value.trim() : null;
}

export async function extractLessonSheetFromDocument(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<ExtractedLessonSheet> {
  // Même contournement que grade-sheet-ocr.ts : on force un tableau à un
  // seul objet en sortie pour rester sur la brique extractJsonArray
  // partagée, sans dupliquer l'appel bas niveau à l'API.
  const raw = await extractJsonArray(
    buffer,
    filename,
    mimeType,
    `${SYSTEM_PROMPT}\n\nIMPORTANT : ta réponse finale doit être un TABLEAU JSON contenant exactement un seul objet respectant la forme décrite ci-dessus.`,
    "Extrait le contenu de cette fiche pédagogique."
  );

  const obj = (raw[0] ?? {}) as Record<string, unknown>;

  return {
    titleGuess: obj.title ? String(obj.title).trim() || null : null,
    subjectNameRaw: String(obj.subjectName ?? "").trim(),
    classNameRaw: String(obj.className ?? "").trim(),
    chapterNameRaw: String(obj.chapterName ?? "").trim(),
    dateGuess: normalizeDate(obj.date),
    objectifs: obj.objectifs ? String(obj.objectifs).trim() || null : null,
    contenu: obj.contenu ? String(obj.contenu).trim() || null : null,
  };
}

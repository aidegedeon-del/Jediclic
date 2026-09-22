import { extractJsonArray } from "./ai-extract";

// EF-DOC-01 : lecture d'une photo/PDF de feuille de notes papier (PRD §20-21 :
// "photo d'une fiche de notes" -> reconnaître élèves/évaluations/notes/barème).
// Comme pour l'emploi du temps (§7), on ne devine jamais un student_id : on
// ressort le nom lu tel quel, la page de relecture fait la correspondance
// avec les élèves réels de la classe choisie par le professeur (menus
// déroulants + suggestion via findBestMatch), jamais une création implicite.
export type ExtractedGradeRow = {
  studentNameRaw: string;
  score: number | null; // null si absent ou illisible
  isAbsent: boolean;
};

export type GradeSheetParseResult = {
  titleGuess: string | null;
  dateGuess: string | null; // "YYYY-MM-DD" si identifiable
  maxScoreGuess: number | null;
  rows: ExtractedGradeRow[];
  skippedRows: number;
};

const SYSTEM_PROMPT = `Tu extrais les informations d'une feuille de notes scolaire manuscrite ou imprimée (photo ou PDF), contexte scolaire ivoirien/francophone.

Règles strictes :
- Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, sans balises markdown.
- Forme exacte : {"title": string|null, "date": string|null, "maxScore": number|null, "rows": [{"studentName": string, "score": number|null, "absent": boolean}]}.
- "title" : intitulé de l'évaluation si écrit sur la feuille (ex: "Interrogation n°2 — Fonctions"), sinon null. N'invente jamais un titre.
- "date" : date de l'évaluation au format "YYYY-MM-DD" si lisible, sinon null. Ne devine jamais une année si elle n'est pas écrite.
- "maxScore" : barème (note maximale, ex: 20 ou 10) si indiqué, sinon null.
- "rows" : une ligne par élève repéré sur le document, dans l'ordre où elles apparaissent. "studentName" = nom tel qu'écrit (ne corrige pas l'orthographe). "score" = note lue si un nombre est visible pour cet élève, sinon null. "absent" = true seulement si le document indique explicitement une absence (ex: "ABS", "absent"), false sinon.
- Une ligne sans aucun nom lisible ne doit pas être incluse dans "rows".
- Si le document n'est pas exploitable, réponds {"title": null, "date": null, "maxScore": null, "rows": []}.`;

function normalizeDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? value.trim() : null;
}

export async function extractGradeSheetFromDocument(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<GradeSheetParseResult> {
  // extractJsonArray attend un tableau en sortie IA ; ici on a besoin d'un
  // objet (métadonnées + tableau imbriqué). On enveloppe donc la réponse
  // dans un tableau à un seul élément côté prompt pour rester sur la brique
  // partagée existante, sans dupliquer la logique d'appel bas niveau.
  const raw = await extractJsonArray(
    buffer,
    filename,
    mimeType,
    `${SYSTEM_PROMPT}\n\nIMPORTANT : ta réponse finale doit être un TABLEAU JSON contenant exactement un seul objet respectant la forme décrite ci-dessus. Exemple : [{"title": null, "date": null, "maxScore": 20, "rows": []}]`,
    "Extrait les informations et les notes de cette feuille."
  );

  const obj = (raw[0] ?? {}) as Record<string, unknown>;
  const rawRows = Array.isArray(obj.rows) ? (obj.rows as unknown[]) : [];

  const rows: ExtractedGradeRow[] = [];
  let skippedRows = 0;

  for (const entry of rawRows) {
    // `entry` provient d'un JSON extrait par l'IA à partir d'une photo/PDF :
    // aucune garantie de forme, traité comme objet non typé (jamais `any`)
    // et chaque champ validé/normalisé explicitement ci-dessous.
    const item = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
    const studentNameRaw = String(item.studentName ?? "").trim();
    if (!studentNameRaw) {
      skippedRows++;
      continue;
    }
    const absent = Boolean(item.absent);
    const scoreRaw = item.score;
    const score = !absent && typeof scoreRaw === "number" && Number.isFinite(scoreRaw) ? scoreRaw : null;
    rows.push({ studentNameRaw, score, isAbsent: absent });
  }

  return {
    titleGuess: obj.title ? String(obj.title).trim() || null : null,
    dateGuess: normalizeDate(obj.date),
    maxScoreGuess: typeof obj.maxScore === "number" && Number.isFinite(obj.maxScore) ? obj.maxScore : null,
    rows,
    skippedRows,
  };
}

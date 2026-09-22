import type { ParseResult, ParsedStudentRow } from "./students";
import { extractJsonArray, isOcrEligible } from "./ai-extract";

export { isOcrEligible };

// Convention §22/§56 : l'OCR ne fait qu'EXTRAIRE, jamais INTÉGRER. Le
// résultat retombe dans le même flux que l'import CSV/Excel (relecture,
// correction, validation manuelle avant écriture dans `students`).
const SYSTEM_PROMPT = `Tu extrais une liste d'élèves à partir d'une photo ou d'un PDF de liste de classe (manuscrite ou imprimée), souvent en contexte scolaire ivoirien/francophone.

Règles strictes :
- Réponds UNIQUEMENT avec un tableau JSON valide, sans texte autour, sans balises markdown.
- Chaque élément : {"fullName": string, "studentNumber": string|null}.
- "fullName" : nom complet tel qu'écrit sur le document (corrige uniquement les césures évidentes de mots coupés en fin de ligne). Ne complète JAMAIS un nom que tu ne peux pas lire avec certitude : si un nom est illisible, retranscris ta meilleure lecture même partielle plutôt que de l'omettre.
- "studentNumber" : matricule/numéro s'il y en a un dans le document (colonne "N°", "Matricule", etc.), sinon null.
- Ignore les en-têtes de colonnes, numéros de ligne purs, titres, signatures, tampons.
- Si le document ne contient aucune liste d'élèves exploitable, réponds avec un tableau vide [].`;

export async function extractStudentsFromDocument(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<ParseResult> {
  const raw = await extractJsonArray(
    buffer,
    filename,
    mimeType,
    SYSTEM_PROMPT,
    "Extrait la liste des élèves de ce document."
  );

  const rows: ParsedStudentRow[] = [];
  let skippedRows = 0;

  for (const entry of raw) {
    // `entry` provient d'un JSON extrait par l'IA à partir d'une photo/PDF :
    // aucune garantie de forme, traité comme objet non typé (jamais `any`)
    // et chaque champ validé/normalisé explicitement ci-dessous.
    const item = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
    const fullName = String(item.fullName ?? "").trim();
    if (!fullName) {
      skippedRows++;
      continue;
    }
    const studentNumberRaw = item.studentNumber;
    const studentNumber = studentNumberRaw ? String(studentNumberRaw).trim() || null : null;
    rows.push({ fullName, studentNumber });
  }

  return { rows, skippedRows, columnsDetected: true };
}

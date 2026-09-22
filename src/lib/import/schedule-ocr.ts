import { extractJsonArray } from "./ai-extract";

// EF-EDT-02 : lecture d'une photo/PDF d'emploi du temps (grille ou liste).
// Convention §7 : le système éducatif n'est jamais codé en dur — on ne
// devine donc jamais un class_id/subject_id, on ne fait que ressortir le
// texte lu (nom de classe, nom de matière) tel quel. C'est la page de
// relecture qui fera correspondre chaque ligne à une classe/matière réelle
// de l'organisation (menus déroulants), jamais une création automatique.
export const WEEKDAY_LABELS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

export type ExtractedScheduleRow = {
  weekday: number | null; // 0=lundi ... 6=dimanche, null si non identifié avec certitude
  subjectNameRaw: string;
  classNameRaw: string;
  startTime: string | null; // "HH:MM" 24h si reconnu
  endTime: string | null;
  room: string | null;
};

export type ScheduleParseResult = {
  rows: ExtractedScheduleRow[];
  skippedRows: number;
};

const SYSTEM_PROMPT = `Tu extrais un emploi du temps scolaire à partir d'une photo ou d'un PDF (grille avec jours en colonnes/lignes, ou liste), souvent en contexte scolaire ivoirien/francophone.

Règles strictes :
- Réponds UNIQUEMENT avec un tableau JSON valide, sans texte autour, sans balises markdown.
- Un élément du tableau = un créneau de cours. Champs : {"weekday": string|null, "subjectName": string, "className": string, "startTime": string|null, "endTime": string|null, "room": string|null}.
- "weekday" : un des mots exacts "lundi","mardi","mercredi","jeudi","vendredi","samedi","dimanche" (en minuscules, sans accent pour "e"), ou null si le jour n'est pas identifiable avec certitude pour ce créneau.
- "subjectName" : nom de la matière tel qu'écrit ou abrégé sur le document (ex: "Maths", "Français", "SVT").
- "className" : nom de la classe tel qu'écrit (ex: "6e A", "Terminale D").
- "startTime"/"endTime" : heure au format 24h "HH:MM" si lisible, sinon null. Ne devine jamais une heure que tu ne peux pas lire.
- "room" : salle si indiquée, sinon null.
- Si un créneau grille n'a ni matière ni classe lisible (case vide), ne l'inclus pas dans le résultat.
- Si le document ne contient aucun emploi du temps exploitable, réponds avec un tableau vide [].`;

function normalizeWeekday(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const norm = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  const idx = WEEKDAY_LABELS.indexOf(norm);
  return idx === -1 ? null : idx;
}

function normalizeTime(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const h = match[1].padStart(2, "0");
  const m = match[2];
  return `${h}:${m}`;
}

export async function extractScheduleFromDocument(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<ScheduleParseResult> {
  const raw = await extractJsonArray(
    buffer,
    filename,
    mimeType,
    SYSTEM_PROMPT,
    "Extrait l'emploi du temps de ce document, créneau par créneau."
  );

  const rows: ExtractedScheduleRow[] = [];
  let skippedRows = 0;

  for (const entry of raw) {
    // `entry` provient d'un JSON extrait par l'IA à partir d'une photo/PDF :
    // aucune garantie de forme (Convention §7, jamais de confiance aveugle
    // dans une extraction IA). On le traite comme un objet non typé, jamais
    // comme `any` (qui désactiverait toute vérification sur le reste du
    // fichier), et chaque champ est explicitement validé/normalisé
    // ci-dessous avant d'être utilisé.
    const item = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
    const subjectNameRaw = String(item.subjectName ?? "").trim();
    const classNameRaw = String(item.className ?? "").trim();
    if (!subjectNameRaw && !classNameRaw) {
      skippedRows++;
      continue;
    }
    rows.push({
      weekday: normalizeWeekday(item.weekday),
      subjectNameRaw,
      classNameRaw,
      startTime: normalizeTime(item.startTime),
      endTime: normalizeTime(item.endTime),
      room: item.room ? String(item.room).trim() || null : null,
    });
  }

  return { rows, skippedRows };
}

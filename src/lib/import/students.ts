import Papa from "papaparse";
import * as XLSX from "xlsx";

// PRD §25 : import CSV ou Excel. On tolère des en-têtes de colonnes variés
// (français/anglais, avec ou sans accents) plutôt que d'imposer un format
// unique — le professeur importe souvent un fichier qu'il a déjà, pas un
// gabarit qu'on lui fournit.
const FULL_NAME_ALIASES = ["nomcomplet", "nom", "eleve", "nomprenom", "nometeprenom", "fullname", "name", "etudiant"];
const STUDENT_NUMBER_ALIASES = ["matricule", "numero", "numeroeleve", "studentnumber", "id", "codeeleve", "n"];

export type ParsedStudentRow = {
  fullName: string;
  studentNumber: string | null;
};

export type ParseResult = {
  rows: ParsedStudentRow[];
  skippedRows: number; // lignes ignorées car sans nom exploitable
  columnsDetected: boolean; // false si on est retombé sur un heuristique de secours
};

function normalizeHeader(header: string): string {
  return header
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // retire les accents
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

function pickColumn(headers: string[], aliases: string[]): string | null {
  const normalized = headers.map((h) => ({ original: h, norm: normalizeHeader(h) }));
  for (const alias of aliases) {
    const match = normalized.find((h) => h.norm === alias);
    if (match) return match.original;
  }
  // correspondance partielle en secours (ex: "nom_eleve" contient "nom")
  for (const alias of aliases) {
    const match = normalized.find((h) => h.norm.includes(alias));
    if (match) return match.original;
  }
  return null;
}

function rowsToStudents(records: Record<string, any>[]): ParseResult {
  if (records.length === 0) return { rows: [], skippedRows: 0, columnsDetected: false };

  const headers = Object.keys(records[0]);
  const fullNameCol = pickColumn(headers, FULL_NAME_ALIASES);
  const studentNumberCol = pickColumn(headers, STUDENT_NUMBER_ALIASES);

  // Pas de colonne "nom" identifiable : on retombe sur la première colonne
  // du fichier (cas fréquent d'un export brut sans en-tête clair).
  const effectiveNameCol = fullNameCol ?? headers[0];

  const rows: ParsedStudentRow[] = [];
  let skippedRows = 0;

  for (const record of records) {
    const rawName = String(record[effectiveNameCol] ?? "").trim();
    if (!rawName) {
      skippedRows++;
      continue;
    }
    const rawNumber = studentNumberCol ? String(record[studentNumberCol] ?? "").trim() : "";
    rows.push({ fullName: rawName, studentNumber: rawNumber || null });
  }

  return { rows, skippedRows, columnsDetected: fullNameCol !== null };
}

export function parseStudentFile(buffer: Buffer, filename: string): ParseResult {
  const isCsv = /\.csv$/i.test(filename);

  if (isCsv) {
    const text = buffer.toString("utf-8");
    const { data } = Papa.parse<Record<string, any>>(text, {
      header: true,
      skipEmptyLines: true,
      delimiter: "", // auto-détection (virgule ou point-virgule)
    });
    return rowsToStudents(data);
  }

  // Excel (.xlsx / .xls)
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  const records = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });
  return rowsToStudents(records);
}

// Brique partagée par tous les imports "photo/PDF" (élèves, emploi du
// temps, et futurs imports documents génériques — EF-DOC-01). Un seul
// endroit qui parle à l'IA (API Google Gemini, niveau gratuit), un seul
// endroit à faire évoluer si le modèle ou le format de réponse change.
//
// Convention §22/§56 : cette brique ne fait qu'EXTRAIRE des données brutes.
// Elle n'écrit jamais dans une table métier — c'est toujours à l'appelant
// (et in fine au professeur, via la page de relecture) de valider.
//
// Choix Gemini plutôt qu'Anthropic (changement demandé par l'utilisateur,
// 22 sept. 2026) : niveau gratuit sans carte bancaire, quota quotidien
// suffisant pour le démarrage. Le modèle reste configurable via
// GEMINI_MODEL si besoin de changer sans toucher au code.
const DEFAULT_MODEL = "gemini-2.0-flash";

// Forme minimale de la réponse de l'API Gemini generateContent, pour éviter
// tout `any` implicite sur `response.json()` ci-dessous.
type GeminiPart = { text?: string };
type GeminiContent = { parts?: GeminiPart[] };
type GeminiCandidate = { content?: GeminiContent };
type GeminiGenerateContentResponse = { candidates?: GeminiCandidate[] };

const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export function isOcrEligible(mimeType: string, filename: string): boolean {
  if (SUPPORTED_IMAGE_TYPES.has(mimeType)) return true;
  if (mimeType === "application/pdf") return true;
  // Certains navigateurs mobiles envoient un mimeType vide pour les photos
  // prises via l'appareil : on retombe sur l'extension.
  return /\.(jpe?g|png|webp|gif|pdf)$/i.test(filename);
}

function guessMediaType(mimeType: string, filename: string): string {
  if (SUPPORTED_IMAGE_TYPES.has(mimeType) || mimeType === "application/pdf") return mimeType;
  if (/\.pdf$/i.test(filename)) return "application/pdf";
  if (/\.png$/i.test(filename)) return "image/png";
  if (/\.webp$/i.test(filename)) return "image/webp";
  if (/\.gif$/i.test(filename)) return "image/gif";
  return "image/jpeg";
}

// Appel bas niveau, partagé par l'extraction OCR (image/PDF -> tableau) et
// par la génération de contenu pédagogique (texte -> objet), pour n'avoir
// qu'un seul endroit qui parle à l'API Gemini (cf. commentaire de tête).
//
// Convertit les blocs de type Anthropic (image/document/text) utilisés par
// les appelants (extractJsonArray/extractJsonObject) vers le format de
// "parts" attendu par Gemini, pour ne pas avoir à toucher aux 4 modules OCR
// ni à la génération pédagogique qui appellent cette brique.
function toGeminiParts(userContent: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return userContent.map((block) => {
    if (block.type === "text") {
      return { text: block.text as string };
    }
    // block.type === "image" | "document" (PDF), forme Anthropic
    // { source: { type: "base64", media_type, data } }
    const source = block.source as { media_type: string; data: string };
    return { inline_data: { mime_type: source.media_type, data: source.data } };
  });
}

async function callGemini(
  systemPrompt: string,
  userContent: Array<Record<string, unknown>>,
  options?: { model?: string; maxTokens?: number }
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Cette fonctionnalité nécessite une clé GEMINI_API_KEY configurée côté serveur.");
  }

  const model = options?.model || process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: toGeminiParts(userContent) }],
        generationConfig: {
          maxOutputTokens: options?.maxTokens ?? 4000,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`Échec de l'appel à l'IA (${response.status}). ${errText.slice(0, 200)}`);
  }

  const data = (await response.json()) as GeminiGenerateContentResponse;
  return (data.candidates ?? [])
    .flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("\n")
    .trim();
}

function stripJsonFences(text: string): string {
  return text.replace(/^```json\s*|^```\s*|```$/gm, "").trim();
}

/**
 * Envoie une photo/PDF à l'IA vision avec un prompt système donné et
 * attend en retour un tableau JSON strict. Ne fait aucune hypothèse sur la
 * forme des éléments du tableau — c'est au system prompt appelant de la
 * définir, et à l'appelant de valider chaque champ.
 */
export async function extractJsonArray(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  systemPrompt: string,
  userInstruction: string
): Promise<unknown[]> {
  const mediaType = guessMediaType(mimeType, filename);
  const base64 = buffer.toString("base64");

  const contentBlock =
    mediaType === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
      : { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } };

  const textOutput = await callGemini(systemPrompt, [contentBlock, { type: "text", text: userInstruction }]);
  const jsonText = stripJsonFences(textOutput);

  let raw: unknown;
  try {
    raw = JSON.parse(jsonText);
  } catch {
    throw new Error(
      "Le document n'a pas pu être analysé automatiquement (réponse illisible). Réessayez avec une photo plus nette."
    );
  }

  if (!Array.isArray(raw)) {
    throw new Error("Le document n'a pas pu être analysé automatiquement (format inattendu).");
  }

  return raw;
}

/**
 * Variante texte -> objet JSON, utilisée par la génération de contenu
 * pédagogique (EF-EVAL-02) et par l'assistant IA global : pas de
 * pièce jointe, juste un system prompt + une instruction utilisateur, et un
 * objet (pas un tableau) en retour. Mêmes garanties : aucune écriture en
 * base ici, l'appelant valide et décide.
 */
export async function extractJsonObject(
  systemPrompt: string,
  userInstruction: string,
  options?: { model?: string; maxTokens?: number }
): Promise<Record<string, unknown>> {
  const textOutput = await callGemini(systemPrompt, [{ type: "text", text: userInstruction }], options);
  const jsonText = stripJsonFences(textOutput);

  let raw: unknown;
  try {
    raw = JSON.parse(jsonText);
  } catch {
    throw new Error("La génération IA n'a pas pu être analysée (réponse illisible). Réessayez.");
  }

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error("La génération IA n'a pas pu être analysée (format inattendu).");
  }

  return raw as Record<string, unknown>;
}

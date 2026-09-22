// Brique partagée par tous les imports "photo/PDF" (élèves, emploi du
// temps, et futurs imports documents génériques — EF-DOC-01). Un seul
// endroit qui parle à l'API Anthropic, un seul endroit à faire évoluer si
// le modèle ou le format de réponse change.
//
// Convention §22/§56 : cette brique ne fait qu'EXTRAIRE des données brutes.
// Elle n'écrit jamais dans une table métier — c'est toujours à l'appelant
// (et in fine au professeur, via la page de relecture) de valider.
const DEFAULT_MODEL = "claude-sonnet-5";

// Forme minimale de la réponse de l'API Messages Anthropic, pour éviter
// tout `any` implicite sur `response.json()` ci-dessous.
type AnthropicContentBlock = { type: string; text?: string };
type AnthropicMessagesResponse = { content?: AnthropicContentBlock[] };

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
// qu'un seul endroit qui parle à l'API Anthropic (cf. commentaire de tête).
async function callAnthropic(
  systemPrompt: string,
  userContent: Array<Record<string, unknown>>,
  options?: { model?: string; maxTokens?: number }
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("Cette fonctionnalité nécessite une clé ANTHROPIC_API_KEY configurée côté serveur.");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: options?.model || process.env.ANTHROPIC_OCR_MODEL || DEFAULT_MODEL,
      max_tokens: options?.maxTokens ?? 4000,
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`Échec de l'appel à l'IA (${response.status}). ${errText.slice(0, 200)}`);
  }

  const data = (await response.json()) as AnthropicMessagesResponse;
  return (data.content ?? [])
    .filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
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

  const textOutput = await callAnthropic(systemPrompt, [contentBlock, { type: "text", text: userInstruction }]);
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
  const textOutput = await callAnthropic(systemPrompt, [{ type: "text", text: userInstruction }], options);
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

// Pré-sélectionne la meilleure correspondance entre un texte lu (OCR) et
// une entité existante (classe, matière), pour préremplir le menu déroulant
// de la page de relecture. Ne crée jamais rien : c'est une suggestion que
// le professeur peut changer avant validation (Convention §7).
function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();
}

export function findBestMatch<T extends { id: string; name: string }>(rawName: string, options: T[]): string | null {
  if (!rawName || options.length === 0) return null;
  const target = normalize(rawName);
  if (!target) return null;

  const exact = options.find((o) => normalize(o.name) === target);
  if (exact) return exact.id;

  const contains = options.find((o) => normalize(o.name).includes(target) || target.includes(normalize(o.name)));
  if (contains) return contains.id;

  return null;
}

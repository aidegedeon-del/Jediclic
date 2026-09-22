import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatScore(score: number | null, max = 20) {
  if (score === null || score === undefined) return "—";
  return `${score.toFixed(1)}/${max}`;
}

// CORRECTION FIABILITÉ : computeAverage — défense contre les cas pathologiques
// - maxScore à 0 ou négatif → ignorer la ligne (division par zéro)
// - coefficient à 0 ou négatif → ignorer la ligne (ne contribue pas)
// - score NaN → traité comme null (ligne ignorée)
// - totalCoef = 0 après filtrage → retourner null plutôt qu'un NaN silencieux
export function computeAverage(scores: { score: number | null; maxScore: number; coefficient: number }[]): number | null {
  const valid = scores.filter(
    (s) =>
      s.score !== null &&
      !isNaN(s.score) &&
      s.maxScore > 0 &&
      s.coefficient > 0
  ) as { score: number; maxScore: number; coefficient: number }[];

  if (valid.length === 0) return null;

  const totalWeighted = valid.reduce((acc, s) => acc + (s.score / s.maxScore) * 20 * s.coefficient, 0);
  const totalCoef = valid.reduce((acc, s) => acc + s.coefficient, 0);

  if (totalCoef <= 0) return null;

  const result = totalWeighted / totalCoef;
  // Défense finale : si le résultat est NaN ou Infinity (ne devrait plus arriver
  // après les filtres ci-dessus, mais protection ultime)
  if (!isFinite(result) || isNaN(result)) return null;

  return result;
}

"use client";

import { Button } from "@/components/ui/button";

// PRD §63 (Export et impression) : priorité "PDF + impression". Choix
// volontaire de s'appuyer sur l'impression navigateur (Ctrl/Cmd+P →
// "Enregistrer en PDF") plutôt qu'une génération PDF côté serveur : aucune
// dépendance lourde supplémentaire (ex. Chromium headless), fiable sur
// n'importe quel hébergeur, et le rendu imprimé est piloté par les classes
// `print:` déjà présentes sur ces pages.
export function PrintButton({ label = "Imprimer / Enregistrer en PDF" }: { label?: string }) {
  return (
    <Button type="button" variant="secondary" className="print:hidden" onClick={() => window.print()}>
      {label}
    </Button>
  );
}

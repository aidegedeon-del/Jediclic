"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

// "Le prof doit toujours pouvoir télécharger tout ce qu'il veut" dans les
// archives (22 août 2026) — export Excel de la liste d'élèves d'une classe
// archivée. Réutilise `xlsx` (SheetJS), déjà une dépendance du projet pour
// l'import de listes (src/lib/import/students.ts) : rien de nouveau à
// ajouter à package.json.
export function DownloadStudentListButton({
  className,
  schoolYearLabel,
  students,
}: {
  className: string;
  schoolYearLabel: string;
  students: { fullName: string; studentNumber: string | null }[];
}) {
  const [pending, setPending] = useState(false);

  return (
    <Button
      type="button"
      variant="secondary"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          const XLSX = await import("xlsx");
          const sheet = XLSX.utils.json_to_sheet(
            students.map((s) => ({ "Nom complet": s.fullName, Matricule: s.studentNumber ?? "" }))
          );
          const workbook = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(workbook, sheet, className.slice(0, 31));
          const slug = (s: string) =>
            s
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .replace(/[^a-zA-Z0-9]+/g, "-")
              .replace(/(^-|-$)/g, "")
              .toLowerCase();
          XLSX.writeFile(workbook, `eleves-${slug(className)}-${slug(schoolYearLabel)}.xlsx`);
        } finally {
          setPending(false);
        }
      }}
    >
      <Download className="mr-2 h-4 w-4" />
      {pending ? "Génération…" : "Télécharger la liste (Excel)"}
    </Button>
  );
}

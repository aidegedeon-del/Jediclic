"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadStudentBulletinPdf, downloadClassBulletinsPdf } from "@/lib/pdf/bulletin-pdf";
import type { BulletinStudentRow, SchoolPeriod } from "@/lib/bulletins/compute";

// Mode "Télécharger" ajouté À CÔTÉ du mode "Imprimer / Enregistrer en PDF"
// existant (print-button.tsx) — à la demande explicite de l'utilisateur,
// les deux coexistent, celui-ci ne remplace pas l'impression navigateur.
// Génère un vrai fichier .pdf (jsPDF, texte réel — pas une capture d'écran).

type HeaderProps = {
  organizationName: string;
  className: string;
  schoolYearLabel: string | null;
  subjectName: string | null;
  period: SchoolPeriod;
};

export function DownloadStudentBulletinButton(props: HeaderProps & { row: BulletinStudentRow }) {
  const [pending, setPending] = useState(false);

  return (
    <Button
      type="button"
      variant="secondary"
      className="print:hidden"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          await downloadStudentBulletinPdf(props);
        } finally {
          setPending(false);
        }
      }}
    >
      <Download className="mr-2 h-4 w-4" />
      {pending ? "Génération…" : "Télécharger le PDF"}
    </Button>
  );
}

export function DownloadClassBulletinsButton(
  props: HeaderProps & { classAverage: number | null; rows: BulletinStudentRow[] }
) {
  const [pending, setPending] = useState(false);

  return (
    <Button
      type="button"
      variant="secondary"
      className="print:hidden"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          await downloadClassBulletinsPdf(props);
        } finally {
          setPending(false);
        }
      }}
    >
      <Download className="mr-2 h-4 w-4" />
      {pending ? "Génération…" : `Télécharger les ${props.rows.length} bulletin(s) (PDF)`}
    </Button>
  );
}

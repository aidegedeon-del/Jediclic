import type { BulletinStudentRow, SchoolPeriod } from "@/lib/bulletins/compute";
import { formatScore } from "@/lib/utils";

// Génération PDF *réelle* (vrai fichier .pdf téléchargé), en plus du mode
// "Imprimer / Enregistrer en PDF" existant (window.print, PRD §63). À la
// demande explicite de l'utilisateur : le mode "Télécharger" doit être
// ajouté à ce qui existe déjà, pas le remplacer — les deux boutons
// coexistent (voir download-pdf-button.tsx / print-button.tsx).
//
// Choix : jsPDF, une librairie 100% client (pas de Chromium headless, pas de
// dépendance serveur) — même logique de simplicité/portabilité que le choix
// déjà fait pour l'impression. Le contenu est reconstruit à partir des mêmes
// données que PrintableBulletin/PrintableClassSummary (jamais une capture
// d'écran du DOM : texte réel, net, sélectionnable dans le PDF).
//
// import dynamique de "jspdf" dans les fonctions ci-dessous (pas d'import en
// haut de fichier) : ce module est utilisé uniquement depuis un composant
// "use client" au clic sur le bouton, jamais au chargement de la page.

const MARGIN = 14;
const PAGE_WIDTH = 210; // A4 portrait, mm

type BulletinHeaderInfo = {
  organizationName: string;
  className: string;
  schoolYearLabel: string | null;
  subjectName: string | null;
  period: SchoolPeriod;
};

function bulletinTitle(params: { periodLabel: string; subjectName: string | null; className: string; schoolYearLabel: string | null }) {
  const { periodLabel, subjectName, className, schoolYearLabel } = params;
  return `Moyenne de ${periodLabel.toLowerCase()} de ${subjectName ?? "discipline non renseignée"} de ${className}${
    schoolYearLabel ? ` ${schoolYearLabel}` : ""
  }`;
}

function drawHeader(doc: import("jspdf").jsPDF, info: BulletinHeaderInfo, extra?: string) {
  let y = MARGIN;
  doc.setFontSize(8);
  doc.setTextColor(110);
  doc.text(info.organizationName.toUpperCase(), MARGIN, y);
  y += 6;

  doc.setFontSize(13);
  doc.setTextColor(20);
  const title = bulletinTitle({
    periodLabel: info.period.label,
    subjectName: info.subjectName,
    className: info.className,
    schoolYearLabel: info.schoolYearLabel,
  });
  const titleLines = doc.splitTextToSize(title, PAGE_WIDTH - MARGIN * 2);
  doc.text(titleLines, MARGIN, y);
  y += titleLines.length * 5.5;

  doc.setFontSize(8);
  doc.setTextColor(110);
  const sub = `du ${info.period.starts_on} au ${info.period.ends_on}${extra ? ` · ${extra}` : ""}`;
  doc.text(sub, MARGIN, y);
  y += 4;

  doc.setDrawColor(210);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  return y + 8;
}

// Bulletin d'un seul élève (même contenu que PrintableBulletin).
export async function downloadStudentBulletinPdf(params: BulletinHeaderInfo & { row: BulletinStudentRow }) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const { row } = params;

  let y = drawHeader(doc, params);

  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text("ÉLÈVE", MARGIN, y);
  doc.setFontSize(12);
  doc.setTextColor(20);
  doc.text(row.fullName, MARGIN, y + 5);
  if (row.rank !== null) {
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text(`Rang : ${row.rank}`, PAGE_WIDTH - MARGIN, y + 5, { align: "right" });
  }
  y += 12;

  // Tableau des évaluations
  const colX = { title: MARGIN, date: MARGIN + 80, coef: MARGIN + 115, score: MARGIN + 140 };
  doc.setFontSize(8.5);
  doc.setTextColor(110);
  doc.text("Évaluation", colX.title, y);
  doc.text("Date", colX.date, y);
  doc.text("Coef.", colX.coef, y);
  doc.text("Note", colX.score, y);
  y += 2;
  doc.setDrawColor(220);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 5;

  doc.setTextColor(20);
  if (row.assessments.length === 0) {
    doc.setTextColor(140);
    doc.text("Aucune évaluation publiée sur cette période.", MARGIN, y);
    y += 6;
  } else {
    for (const a of row.assessments) {
      if (y > 270) {
        doc.addPage();
        y = MARGIN;
      }
      const titleLines = doc.splitTextToSize(a.title, 75);
      doc.text(titleLines, colX.title, y);
      doc.text(a.date, colX.date, y);
      doc.text(String(a.coefficient), colX.coef, y);
      doc.text(formatScore(a.score, a.maxScore), colX.score, y);
      y += Math.max(5, titleLines.length * 4.5);
      doc.setDrawColor(235);
      doc.line(MARGIN, y - 2, PAGE_WIDTH - MARGIN, y - 2);
    }
  }

  y += 4;
  doc.setFillColor(245, 245, 245);
  doc.rect(MARGIN, y, PAGE_WIDTH - MARGIN * 2, 9, "F");
  doc.setFontSize(9.5);
  doc.setTextColor(20);
  doc.text("Moyenne de la période", MARGIN + 3, y + 6);
  doc.setFontSize(11);
  doc.text(row.average !== null ? `${row.average.toFixed(1)}/20` : "—", PAGE_WIDTH - MARGIN - 3, y + 6, { align: "right" });
  y += 16;

  doc.setFontSize(8.5);
  doc.setTextColor(110);
  doc.text("APPRÉCIATION", MARGIN, y);
  y += 5;
  doc.setFontSize(9.5);
  doc.setTextColor(20);
  const appLines = doc.splitTextToSize(row.reportCard?.appreciation || "—", PAGE_WIDTH - MARGIN * 2);
  doc.text(appLines, MARGIN, y);
  y += appLines.length * 4.5 + 6;

  doc.setFontSize(8.5);
  doc.setTextColor(110);
  doc.text("OBSERVATIONS", MARGIN, y);
  y += 5;
  doc.setFontSize(9.5);
  doc.setTextColor(20);
  const obsLines = doc.splitTextToSize(row.reportCard?.observations || "—", PAGE_WIDTH - MARGIN * 2);
  doc.text(obsLines, MARGIN, y);
  y += obsLines.length * 4.5 + 14;

  if (y > 270) {
    doc.addPage();
    y = MARGIN;
  }
  doc.setFontSize(8.5);
  doc.setTextColor(110);
  doc.text("Signature du professeur", PAGE_WIDTH - MARGIN, y, { align: "right" });
  doc.setDrawColor(180);
  doc.line(PAGE_WIDTH - MARGIN - 50, y + 8, PAGE_WIDTH - MARGIN, y + 8);

  doc.save(fileName(`bulletin-${row.fullName}`, params));
}

// Vue "classe" (même contenu que PrintableClassSummary) : moyenne de classe +
// tableau élève par élève, PUIS une page par élève (même logique que la page
// bulletins/imprimer, "ce qui est à l'écran doit être aussi imprimable et
// pdf").
export async function downloadClassBulletinsPdf(
  params: BulletinHeaderInfo & { classAverage: number | null; rows: BulletinStudentRow[] }
) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const { rows, classAverage } = params;

  let y = drawHeader(doc, params, `${rows.length} élève(s)`);

  doc.setFillColor(245, 245, 245);
  doc.rect(MARGIN, y, PAGE_WIDTH - MARGIN * 2, 10, "F");
  doc.setFontSize(9.5);
  doc.setTextColor(20);
  doc.text("Moyenne de la classe dans la discipline", MARGIN + 3, y + 6.5);
  doc.setFontSize(13);
  doc.text(classAverage !== null ? `${classAverage.toFixed(1)}/20` : "—", PAGE_WIDTH - MARGIN - 3, y + 6.5, { align: "right" });
  y += 16;

  const colX = { rank: MARGIN, name: MARGIN + 14, avg: MARGIN + 90, app: MARGIN + 112 };
  doc.setFontSize(8.5);
  doc.setTextColor(110);
  doc.text("Rang", colX.rank, y);
  doc.text("Élève", colX.name, y);
  doc.text("Moyenne", colX.avg, y);
  doc.text("Appréciation", colX.app, y);
  y += 2;
  doc.setDrawColor(220);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 5;

  doc.setTextColor(20);
  if (rows.length === 0) {
    doc.setTextColor(140);
    doc.text("Aucun élève dans cette classe.", MARGIN, y);
    y += 6;
  } else {
    for (const r of rows) {
      if (y > 275) {
        doc.addPage();
        y = MARGIN;
      }
      const appLines = doc.splitTextToSize(r.reportCard?.appreciation || "—", PAGE_WIDTH - MARGIN - colX.app);
      doc.text(String(r.rank ?? "—"), colX.rank, y);
      doc.text(r.fullName, colX.name, y);
      doc.text(r.average !== null ? r.average.toFixed(1) : "—", colX.avg, y);
      doc.text(appLines, colX.app, y);
      y += Math.max(5, appLines.length * 4.5);
      doc.setDrawColor(235);
      doc.line(MARGIN, y - 2, PAGE_WIDTH - MARGIN, y - 2);
    }
  }

  // Une page détaillée par élève, comme sur la page écran/impression.
  for (const row of rows) {
    doc.addPage();
    // Réutilise le rendu détaillé en dessinant directement (pas d'appel
    // récursif à downloadStudentBulletinPdf, qui créerait/sauverait un
    // second document) : on reconstruit la même page dans CE document.
    let py = drawHeader(doc, params);
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text("ÉLÈVE", MARGIN, py);
    doc.setFontSize(12);
    doc.setTextColor(20);
    doc.text(row.fullName, MARGIN, py + 5);
    if (row.rank !== null) {
      doc.setFontSize(9);
      doc.setTextColor(110);
      doc.text(`Rang : ${row.rank}`, PAGE_WIDTH - MARGIN, py + 5, { align: "right" });
    }
    py += 12;

    const sCol = { title: MARGIN, date: MARGIN + 80, coef: MARGIN + 115, score: MARGIN + 140 };
    doc.setFontSize(8.5);
    doc.setTextColor(110);
    doc.text("Évaluation", sCol.title, py);
    doc.text("Date", sCol.date, py);
    doc.text("Coef.", sCol.coef, py);
    doc.text("Note", sCol.score, py);
    py += 2;
    doc.setDrawColor(220);
    doc.line(MARGIN, py, PAGE_WIDTH - MARGIN, py);
    py += 5;

    doc.setTextColor(20);
    if (row.assessments.length === 0) {
      doc.setTextColor(140);
      doc.text("Aucune évaluation publiée sur cette période.", MARGIN, py);
      py += 6;
    } else {
      for (const a of row.assessments) {
        if (py > 270) {
          doc.addPage();
          py = MARGIN;
        }
        const titleLines = doc.splitTextToSize(a.title, 75);
        doc.text(titleLines, sCol.title, py);
        doc.text(a.date, sCol.date, py);
        doc.text(String(a.coefficient), sCol.coef, py);
        doc.text(formatScore(a.score, a.maxScore), sCol.score, py);
        py += Math.max(5, titleLines.length * 4.5);
        doc.setDrawColor(235);
        doc.line(MARGIN, py - 2, PAGE_WIDTH - MARGIN, py - 2);
      }
    }

    py += 4;
    doc.setFillColor(245, 245, 245);
    doc.rect(MARGIN, py, PAGE_WIDTH - MARGIN * 2, 9, "F");
    doc.setFontSize(9.5);
    doc.setTextColor(20);
    doc.text("Moyenne de la période", MARGIN + 3, py + 6);
    doc.setFontSize(11);
    doc.text(row.average !== null ? `${row.average.toFixed(1)}/20` : "—", PAGE_WIDTH - MARGIN - 3, py + 6, { align: "right" });
    py += 16;

    doc.setFontSize(8.5);
    doc.setTextColor(110);
    doc.text("APPRÉCIATION", MARGIN, py);
    py += 5;
    doc.setFontSize(9.5);
    doc.setTextColor(20);
    const appLines = doc.splitTextToSize(row.reportCard?.appreciation || "—", PAGE_WIDTH - MARGIN * 2);
    doc.text(appLines, MARGIN, py);
    py += appLines.length * 4.5 + 6;

    doc.setFontSize(8.5);
    doc.setTextColor(110);
    doc.text("OBSERVATIONS", MARGIN, py);
    py += 5;
    doc.setFontSize(9.5);
    doc.setTextColor(20);
    const obsLines = doc.splitTextToSize(row.reportCard?.observations || "—", PAGE_WIDTH - MARGIN * 2);
    doc.text(obsLines, MARGIN, py);
  }

  doc.save(fileName(`bulletins-${params.className}`, params));
}

function fileName(prefix: string, info: BulletinHeaderInfo) {
  const slug = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .toLowerCase();
  return `${slug(prefix)}-${slug(info.period.label)}${info.schoolYearLabel ? `-${slug(info.schoolYearLabel)}` : ""}.pdf`;
}

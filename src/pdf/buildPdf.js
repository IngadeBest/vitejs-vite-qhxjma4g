import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/* Constanten en data - geëxporteerd voor tests */
export const KLASSEN = [
  { code: "we0", labelKey: "WE0", naam: "Introductieklasse (WE0)", min: 6, max: 8 },
  { code: "we1", labelKey: "WE1", naam: "WE1", min: 6, max: 10 },
  { code: "we2", labelKey: "WE2", naam: "WE2", min: 8, max: 12 },
  { code: "we2p", labelKey: "WE2+", naam: "WE2+", min: 8, max: 12 },
  { code: "we3", labelKey: "WE3", naam: "WE3", min: 10, max: 14 },
  { code: "we4", labelKey: "WE4", naam: "WE4", min: 12, max: 16 },
  { code: "yr", labelKey: "YR", naam: "Young Riders", min: 10, max: 14 },
  { code: "junior", labelKey: "JR", naam: "Junioren", min: 10, max: 14 },
];

export const ONDERDELEN = [
  { code: "dressuur", label: "Dressuur" },
  { code: "stijl", label: "Stijltrail" },
  { code: "speed", label: "Speedtrail" },
];

export const ALG_PUNTEN_WE0_WE1 = [
  "Zuiverheid van de gangen en regelmatigheid van de bewegingen van het paard",
  "Schwung, dynamiek, elasticiteit van de overgangen, losheid van de rugspieren",
  "Gehoorzaamheid, reactie op de hulpen, oplettendheid richting ruiter en vertrouwen in de ruiter",
  "Zit en rijwijze van de ruiter",
];

export const ALG_PUNTEN_WE2PLUS = [
  "Stap/galop/stap overgangen",
  "Zuiverheid van de gangen en regelmatigheid van de bewegingen van het paard",
  "Schwung, dynamiek, elasticiteit van de overgangen, losheid van de rugspieren",
  "Gehoorzaamheid, reactie op de hulpen, oplettendheid richting ruiter en vertrouwen in de ruiter",
  "Zit en rijwijze van de ruiter, effectiviteit van de hulpen",
];

/* PDF Layout Constanten */
const BLUE = [16, 39, 84];
const MARGIN = { left: 40, right: 40 };
const BORDER_COLOR = [160, 160, 160];
const HEADER_COLOR = [220, 230, 245];

const COL_WIDTHS = {
  NUM: 25,
  LETTER: 40,
  EXERCISE: 140,
  HEEL: 35,
  HALF: 35,
  PENALTY: 50,
  NOTE: 190
};

const COL_WIDTHS_SPEED = {
  NUM: 25,
  OBSTACLE: 140,
  RULE: 100,
  SCORE: 45,
  NOTE: 205
};

/* Helper functies */
function titleBar(doc, title, subtitle) {
  const W = doc.internal.pageSize.getWidth();
  doc.setFillColor(...BLUE);
  doc.rect(0, 0, W, 64, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(title, 40, 40);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  if (subtitle) doc.text(subtitle, 40, 56);
  doc.setTextColor(0, 0, 0);
}

function infoBoxesSideBySide(doc, info) {
  const startY = 74;
  autoTable(doc, {
    startY,
    head: [],
    body: [
      ["Wedstrijd", info.wedstrijd_naam || ""],
      ["Datum", info.datum || ""],
      ["Jury", info.jury || ""],
      ["Klasse", info.klasse_naam || info.klasse || ""],
      ["Onderdeel", info.onderdeel_label || info.onderdeel || ""],
    ],
    styles: { fontSize: 9, cellPadding: 4, lineColor: BORDER_COLOR, lineWidth: 0.5 },
    theme: "grid",
    margin: { left: MARGIN.left, right: 280 },
    tableWidth: "auto",
    columnStyles: { 0: { cellWidth: 100, fontStyle: "bold" }, 1: { cellWidth: "auto" } },
  });
  const leftY = doc.lastAutoTable.finalY;
  
  autoTable(doc, {
    startY,
    head: [],
    body: [
      ["Ruiter", info.ruiter || "", "", ""],
      ["Paard", info.paard || "", "", ""],
      ["Startnummer", info.startnummer || "", "", ""],
      ["Percentage", "", "Plaatsing", ""],
      ["", "", "", ""],
    ],
    styles: { fontSize: 9, cellPadding: 4, lineColor: BORDER_COLOR, lineWidth: 0.5 },
    theme: "grid",
    margin: { left: MARGIN.left + 280, right: MARGIN.right },
    tableWidth: "auto",
    columnStyles: {
      0: { cellWidth: 58, fontStyle: "bold" },
      1: { cellWidth: 52 },
      2: { cellWidth: 58, fontStyle: "bold" },
      3: { cellWidth: 52 },
    },
    didParseCell: (data) => {
      if (data.row.index < 3 && (data.column.index === 2 || data.column.index === 3)) {
        data.cell.styles.lineWidth = 0;
      }
      if (data.row.index === 4) {
        data.cell.styles.minCellHeight = 18;
      }
    },
  });
  const rightY = doc.lastAutoTable.finalY;
  return Math.max(leftY, rightY);
}

function obstaclesTable(doc, items, startY, options = {}) {
  const { compact = false } = options;
  const isSpeedData = items.length > 0 && Array.isArray(items[0]);
  let head, body, colStyles;

  if (isSpeedData) {
    head = [["#", "Hindernis", "Strafbepaling", "Straf", "Opmerking"]];
    body = items.map((row, i) => [i + 1, row[0], row[1], "", ""]);
    colStyles = {
      0: { cellWidth: COL_WIDTHS_SPEED.NUM, halign: "center" },
      1: { cellWidth: COL_WIDTHS_SPEED.OBSTACLE, halign: "left" },
      2: { cellWidth: COL_WIDTHS_SPEED.RULE, fontSize: 8, fontStyle: "italic", textColor: 80 },
      3: { cellWidth: COL_WIDTHS_SPEED.SCORE, halign: "center" },
      4: { cellWidth: COL_WIDTHS_SPEED.NOTE }
    };
  } else {
    head = [["#", "Onderdeel / obstakel", "Heel", "Half", "Correctie", "Opmerking"]];
    body = items.map((o, i) => [i + 1, o, "", "", "", ""]);
    colStyles = {
      0: { cellWidth: COL_WIDTHS.NUM, halign: "center" },
      1: { cellWidth: COL_WIDTHS.LETTER + COL_WIDTHS.EXERCISE },
      2: { cellWidth: COL_WIDTHS.HEEL, halign: "center" },
      3: { cellWidth: COL_WIDTHS.HALF, halign: "center" },
      4: { cellWidth: COL_WIDTHS.PENALTY, halign: "center" },
      5: { cellWidth: COL_WIDTHS.NOTE }
    };
  }

  autoTable(doc, {
    startY,
    head,
    body,
    styles: {
      fontSize: compact ? 8.5 : 9,
      cellPadding: compact ? { top: 6, right: 3, bottom: 6, left: 3 } : { top: 8, right: 3, bottom: 8, left: 3 },
      lineColor: BORDER_COLOR,
      lineWidth: 0.5,
      valign: "middle",
      minCellHeight: compact ? 40 : 50
    },
    headStyles: {
      fillColor: HEADER_COLOR,
      textColor: 0,
      fontStyle: "bold",
      fontSize: 6,
      cellPadding: 0.5,
      halign: "left",
      minCellHeight: 8
    },
    theme: "grid",
    margin: MARGIN,
    columnStyles: colStyles
  });
  return doc.lastAutoTable.finalY;
}

function generalPointsTable(doc, punten, startY, startIndex, options = {}) {
  const { compact = false } = options;
  const rows = punten.map((naam, i) => {
    const text = String(naam || "").trim();
    const m = text.match(/^([A-E])\s+[\-–:]?\s*(.+)$/i);
    if (m) {
      return [m[1].toUpperCase(), m[2], "", "", ""];
    }
    return [startIndex + i, naam, "", "", ""];
  });
  autoTable(doc, {
    startY,
    head: [["#", "Algemene punten", "Heel", "Half", "Correctie", "Opmerking"]],
    body: rows,
    styles: {
      fontSize: compact ? 8.5 : 9,
      cellPadding: compact ? { top: 6, right: 3, bottom: 6, left: 3 } : { top: 8, right: 3, bottom: 8, left: 3 },
      lineColor: BORDER_COLOR,
      lineWidth: 0.5,
      valign: "middle",
      minCellHeight: compact ? 34 : 45
    },
    headStyles: {
      fillColor: HEADER_COLOR,
      textColor: 0,
      fontStyle: "bold",
      fontSize: 6,
      cellPadding: 0.5,
      halign: "left",
      minCellHeight: 8
    },
    theme: "grid",
    margin: MARGIN,
    columnStyles: {
      0: { cellWidth: COL_WIDTHS.NUM, halign: "center" },
      1: { cellWidth: COL_WIDTHS.LETTER + COL_WIDTHS.EXERCISE },
      2: { cellWidth: COL_WIDTHS.HEEL, halign: "center" },
      3: { cellWidth: COL_WIDTHS.HALF, halign: "center" },
      4: { cellWidth: COL_WIDTHS.PENALTY, halign: "center" },
      5: { cellWidth: COL_WIDTHS.NOTE },
    },
  });
  return doc.lastAutoTable.finalY;
}

function totalsBox(doc, startY, maxPoints = null, extraLabel = null, showPuntenaftrek = true, isDressuur = false, isSpeed = false) {
  let bodyRows = [];
  let colStyles = {};

  if (isSpeed) {
    bodyRows = [
      ["Totaal straftijd", "", ""],
      ["Gereden tijd", "", ""],
      ["Totaal tijd", "", ""]
    ];
    const labelWidth = COL_WIDTHS_SPEED.NUM + COL_WIDTHS_SPEED.OBSTACLE + COL_WIDTHS_SPEED.RULE;
    colStyles = {
      0: { cellWidth: labelWidth, halign: "left", fontStyle: "bold" },
      1: { cellWidth: COL_WIDTHS_SPEED.SCORE, halign: "center" },
      2: { cellWidth: COL_WIDTHS_SPEED.NOTE }
    };
  } else {
    const totalLabel = maxPoints ? `Totaal (max. ${maxPoints})` : "Totaal";
    bodyRows.push(["Subtotaal", "", "", "", ""]);
    if (showPuntenaftrek) {
      bodyRows.push(["Puntenaftrek en reden", "", "", "", ""]);
    }
    bodyRows.push([extraLabel || totalLabel, "", "", "", ""]);

    const labelWidth = COL_WIDTHS.NUM + COL_WIDTHS.LETTER + COL_WIDTHS.EXERCISE;
    colStyles = {
      0: { cellWidth: labelWidth, halign: "left" },
      1: { cellWidth: COL_WIDTHS.HEEL, halign: "center" },
      2: { cellWidth: COL_WIDTHS.HALF, halign: "center" },
      3: { cellWidth: COL_WIDTHS.PENALTY, halign: "center" },
      4: { cellWidth: COL_WIDTHS.NOTE }
    };
  }

  autoTable(doc, {
    startY,
    head: [],
    body: bodyRows,
    styles: {
      fontSize: 9,
      cellPadding: 5,
      lineColor: BORDER_COLOR,
      lineWidth: 0.5,
      fontStyle: "bold"
    },
    theme: "grid",
    margin: MARGIN,
    columnStyles: colStyles
  });
  return doc.lastAutoTable.finalY;
}

function signatureLine(doc) {
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Handtekening jury:", MARGIN.left, pageH - 24);
  doc.line(MARGIN.left + 110, pageH - 26, doc.internal.pageSize.getWidth() - MARGIN.right, pageH - 26);
}

function isGeneralDressuurPunt(text) {
  const t = String(text || "").toLowerCase();
  return (
    t.includes("gangen") ||
    t.includes("impuls") ||
    t.includes("gehoorzaamheid") ||
    t.includes("harmonie") ||
    t.includes("submission") ||
    t.includes("rijden op zit") ||
    t.includes("presentatie") ||
    t.includes("ruiter") ||
    t.includes("artistiek")
  );
}

function shouldAppendDressuurLine(currentGroup, letter, beoordeling, oefening) {
  if (!currentGroup || letter || beoordeling) return false;
  const trimmed = String(oefening || "").trim();
  if (!trimmed) return false;

  // Vervolgregels zijn in de praktijk gekoppeld aan een regel met letter of beoordeling.
  if (currentGroup.hasAnchor) return true;

  // Zonder anker alleen korte vervolgfragmenten samenvoegen (bijv. "met overgang ...").
  const firstChar = trimmed[0] || "";
  const startsAsContinuation = firstChar === "(" || firstChar === "," || (firstChar >= "a" && firstChar <= "z");
  return startsAsContinuation;
}

function alignedDressuurLetterText(doc, letters, oefeningen) {
  const maxLen = Math.max(letters.length, oefeningen.length);
  const letterLines = [];

  // Match autoTable content width for the Oefening column (cellWidth 140, padding 3+3).
  const oefeningTextWidth = COL_WIDTHS.EXERCISE - 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  for (let i = 0; i < maxLen; i++) {
    const letter = letters[i] ?? "";
    const oefening = oefeningen[i] ?? "";
    letterLines.push(letter);

    if (i < maxLen - 1) {
      const wrapped = doc.splitTextToSize(String(oefening), oefeningTextWidth);
      const visualLines = Array.isArray(wrapped) ? Math.max(1, wrapped.length) : 1;
      for (let j = 1; j < visualLines; j++) letterLines.push("");
    }
  }

  return letterLines.join("\n");
}

/**
 * Hoofdfunctie: bouwt een protocol PDF
 * @param {object} protocol - Protocol metadata (wedstrijd, ruiter, klasse, onderdeel, etc)
 * @param {array} items - Protocol items (oefeningen, obstakels, etc)
 * @returns {jsPDF} - PDF document object
 */
export function buildProtocolPdf(protocol, items) {
  const doc = new jsPDF({ unit: "pt", format: "A4" });
  const p = protocol;

  const title = p.onderdeel === "dressuur" ? "Working Point • Dressuurprotocol"
    : p.onderdeel === "stijl" ? "Working Point • Stijltrail Protocol"
      : "Working Point • Speedtrail Protocol";

  titleBar(doc, title, `${p.klasse_naam || p.klasse}`);
  const infoY = infoBoxesSideBySide(doc, p);

  // DRESSUUR LOGICA
  if (p.onderdeel === "dressuur") {
    const tableData = [];
    const algemenePuntenData = [];
    let currentGroup = null;
    let groupNumber = 0;
    let inAlgemenePunten = false;

    items.forEach((item) => {
      if (Array.isArray(item) && item.length >= 2) {
        const letter = item[0] || "";
        const oefening = item[1] || "";
        const beoordeling = item[3] || item[2] || "";

        if (!letter && !beoordeling && isGeneralDressuurPunt(oefening)) {
          inAlgemenePunten = true;
          currentGroup = null;
        }

        if (inAlgemenePunten) {
          algemenePuntenData.push(oefening);
          return;
        }

        const isNewGroup = letter && beoordeling;

        if (isNewGroup || (oefening && !currentGroup)) {
          groupNumber++;
          currentGroup = {
            nummer: groupNumber.toString(),
            letters: [letter],
            oefeningen: [oefening],
            beoordeling: beoordeling,
            puntenHeel: "",
            puntenHalf: "",
            isHeader: false,
            hasAnchor: Boolean(letter || beoordeling)
          };
          tableData.push(currentGroup);
        } else if (shouldAppendDressuurLine(currentGroup, letter, beoordeling, oefening)) {
          currentGroup.letters.push("");
          currentGroup.oefeningen.push(oefening);
        } else if (letter && !beoordeling) {
          groupNumber++;
          currentGroup = {
            nummer: groupNumber.toString(),
            letters: [letter],
            oefeningen: [oefening],
            beoordeling: "",
            puntenHeel: "",
            puntenHalf: "",
            isHeader: false,
            hasAnchor: Boolean(letter || beoordeling)
          };
          tableData.push(currentGroup);
        } else if (oefening) {
          groupNumber++;
          currentGroup = {
            nummer: groupNumber.toString(),
            letters: [letter],
            oefeningen: [oefening],
            beoordeling: beoordeling,
            puntenHeel: "",
            puntenHalf: "",
            isHeader: false,
            hasAnchor: Boolean(letter || beoordeling)
          };
          tableData.push(currentGroup);
        }
      }
    });

    const formattedData = tableData.map(group => [
      group.nummer,
      alignedDressuurLetterText(doc, group.letters, group.oefeningen),
      group.oefeningen.join("\n"),
      group.puntenHeel,
      group.puntenHalf,
      "",
      group.beoordeling
    ]);

    autoTable(doc, {
      startY: infoY + 16,
      head: [["#", "Letter", "Oefening", "Heel", "Half", "Correctie", "Beoordeling/Opmerkingen"]],
      body: formattedData,
      styles: {
        fontSize: 9,
        cellPadding: { top: 8, right: 3, bottom: 8, left: 3 },
        lineColor: BORDER_COLOR,
        lineWidth: 0.5,
        valign: "top",
        overflow: 'linebreak',
        minCellHeight: 60
      },
      headStyles: {
        fillColor: HEADER_COLOR,
        textColor: 0,
        fontStyle: "bold",
        fontSize: 6,
        cellPadding: 0.5,
        halign: "left",
        valign: "middle",
        minCellHeight: 8
      },
      theme: "grid",
      margin: MARGIN,
      columnStyles: {
        0: { cellWidth: COL_WIDTHS.NUM, halign: "center" },
        1: { cellWidth: COL_WIDTHS.LETTER, halign: "left" },
        2: { cellWidth: COL_WIDTHS.EXERCISE, halign: "left" },
        3: { cellWidth: COL_WIDTHS.HEEL, halign: "center" },
        4: { cellWidth: COL_WIDTHS.HALF, halign: "center" },
        5: { cellWidth: COL_WIDTHS.PENALTY, halign: "center" },
        6: { cellWidth: COL_WIDTHS.NOTE }
      }
    });

    const afterOefeningen = doc.lastAutoTable.finalY;
    let afterAlg = afterOefeningen;

    if (algemenePuntenData.length > 0) {
      const pageHeight = doc.internal.pageSize.height;
      const spaceLeft = pageHeight - afterOefeningen - MARGIN.bottom;

      let startY = afterOefeningen + 12;
      if (spaceLeft < 150) {
        doc.addPage();
        startY = 40;
      }

      afterAlg = generalPointsTable(doc, algemenePuntenData, startY, groupNumber + 1);
    }

    totalsBox(doc, afterAlg + 6, p.max_score ? Number(p.max_score) : null, null, true, true, false);
    signatureLine(doc);
    return doc;
  }

  // STIJL & SPEED LOGICA
  const isSpeed = p.onderdeel === "speed";
  const isStijl = p.onderdeel === "stijl";
  const useCompactStijlLayout = isStijl && Array.isArray(items) && items.length >= 8;
  const afterItems = obstaclesTable(doc, items, infoY + 16, { compact: useCompactStijlLayout });
  let afterAlg = afterItems;

  if (isStijl) {
    const punten = (p.klasse === "we0" || p.klasse === "we1") ? ALG_PUNTEN_WE0_WE1 : ALG_PUNTEN_WE2PLUS;

    const pageHeight = doc.internal.pageSize.height;
    const spaceLeft = pageHeight - afterItems - MARGIN.bottom;

    let startY = afterItems + (useCompactStijlLayout ? 8 : 12);
    if (spaceLeft < 150) {
      doc.addPage();
      startY = 40;
    }

    afterAlg = generalPointsTable(doc, punten, startY, items.length + 1, { compact: useCompactStijlLayout });
  }

  totalsBox(
    doc,
    afterAlg + (useCompactStijlLayout ? 4 : 6),
    p.max_score ? Number(p.max_score) : null,
    isSpeed ? "Tijd / Strafseconden / Totaal" : null,
    false,
    false,
    isSpeed
  );

  signatureLine(doc);
  return doc;
}

/**
 * Genereert een PDF blob voor download
 */
export async function generatePdfBlob(protocol, items) {
  try {
    const doc = buildProtocolPdf(protocol, items);
    return doc.output("blob");
  } catch (error) {
    console.error('Error creating PDF:', error);
    throw new Error('Kon PDF niet genereren: ' + error.message);
  }
}

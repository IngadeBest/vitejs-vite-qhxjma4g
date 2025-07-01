import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabaseClient";
import { Link } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import domtoimage from "dom-to-image";

const klasses = ["WE Intro", "WE1", "WE2", "WE3", "WE4"];

export default function Einduitslag() {
  const [ruiters, setRuiters] = useState([]);
  const [scores, setScores] = useState([]);
  const [proeven, setProeven] = useState([]);
  const [loading, setLoading] = useState(true);
  const tableRefs = useRef({});

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const { data: ruiterData } = await supabase.from("ruiters").select("*");
      const { data: scoreData } = await supabase.from("scores").select("*");
      const { data: proefData } = await supabase.from("proeven").select("*");
      setRuiters(ruiterData || []);
      setScores(scoreData || []);
      setProeven(proefData || []);
      setLoading(false);
    }
    fetchData();
  }, []);

  // Dynamisch: onderdelen per klasse
  function getOnderdelenVoorKlasse(klasse) {
    return proeven
      .filter(p => p.klasse === klasse)
      .map(p => p.onderdeel)
      .filter((v, i, arr) => arr.indexOf(v) === i); // unieke volgorde
  }

  function getPercentage(scoreObj, proef) {
    if (!proef || scoreObj.dq) return 0;
    return proef.max_score
      ? (scoreObj.score / proef.max_score) * 100
      : 0;
  }

  function berekenEindklassement(klasse) {
    const onderdelen = getOnderdelenVoorKlasse(klasse);
    const klasseRuiters = ruiters.filter(r => r.klasse === klasse);

    // Proeven per onderdeel
    let proevenPerOnderdeel = {};
    onderdelen.forEach(onderdeel => {
      proevenPerOnderdeel[onderdeel] = proeven.find(
        p => p.klasse === klasse && p.onderdeel === onderdeel
      );
    });

    // Resultaten per ruiter
    let deelnemers = klasseRuiters.map(r => {
      let aantalDQ = 0;
      let totaalPunten = 0;
      let perOnderdeel = [];
      let percentages = {};

      onderdelen.forEach(onderdeel => {
        const proef = proevenPerOnderdeel[onderdeel];
        let scoreObj = proef
          ? scores.find(s => s.proef_id === proef.id && s.ruiter_id === r.id)
          : null;
        let dq = scoreObj ? !!scoreObj.dq : true; // als niet gestart, is DQ
        let punten = 0;
        let percentage = getPercentage(scoreObj || { dq: true }, proef);

        // Puntentelling WEH
        if (proef && scoreObj) {
          // Haal ALLE scores op voor dit proef-onderdeel (incl. DQ's)
          let scoresVoorProef = scores
            .filter(s => s.proef_id === proef.id)
            .map(s => ({
              ...s,
              naam: ruiters.find(r2 => r2.id === s.ruiter_id)?.naam || "",
              paard: ruiters.find(r2 => r2.id === s.ruiter_id)?.paard || "",
            }));
          const aantalGestart = scoresVoorProef.length;
          let zonderDQ = scoresVoorProef.filter(s => !s.dq);
          zonderDQ.sort((a, b) => b.score - a.score);

          // Plaats bepalen
          let plaats = zonderDQ.findIndex(s => s.ruiter_id === r.id) + 1;
          if (plaats > 0) {
            // Ex aequo groep
            let score = scoreObj.score;
            // let exaequo = zonderDQ.filter(s => s.score === score); // evt. voor weergave
            // Punten voor deze plaats
            punten = plaats === 1
              ? aantalGestart + 1
              : aantalGestart - (plaats - 1);
          }
          // DQ: altijd 0 punten
          if (dq) {
            punten = 0;
            plaats = zonderDQ.length + 1; // onderaan
          }
          perOnderdeel.push({
            onderdeel,
            plek: plaats,
            punten,
            dq,
            percentage: Number(percentage.toFixed(2))
          });
        } else {
          // Niet gestart = DQ
          aantalDQ++;
          perOnderdeel.push({
            onderdeel,
            plek: null,
            punten: 0,
            dq: true,
            percentage: 0
          });
        }

        if (dq) aantalDQ++;
        totaalPunten += punten;
        percentages[onderdeel] = Number(percentage.toFixed(2));
      });

      return {
        id: r.id,
        naam: r.naam,
        paard: r.paard,
        totaalPunten,
        aantalDQ,
        perOnderdeel,
        percentages,
      };
    });

    // Sorteren: eerst aantal DQ's (laag naar hoog), dan totaalpunten (hoog naar laag),
    // dan percentages dressuur, stijltrail, speedtrail (indien van toepassing)
    deelnemers.sort((a, b) => {
      if (a.aantalDQ !== b.aantalDQ) return a.aantalDQ - b.aantalDQ;
      if (a.totaalPunten !== b.totaalPunten) return b.totaalPunten - a.totaalPunten;
      // Ex equo! Tiebreakers:
      // 1. Dressuurpercentage
      if ((b.percentages.Dressuur ?? 0) !== (a.percentages.Dressuur ?? 0)) {
        return (b.percentages.Dressuur ?? 0) - (a.percentages.Dressuur ?? 0);
      }
      // 2. Stijltrailpercentage
      if ((b.percentages.Stijltrail ?? 0) !== (a.percentages.Stijltrail ?? 0)) {
        return (b.percentages.Stijltrail ?? 0) - (a.percentages.Stijltrail ?? 0);
      }
      // 3. Speedtrailpercentage (alleen als het onderdeel bestaat in deze klasse)
      if (
        onderdelen.includes("Speedtrail") &&
        (b.percentages.Speedtrail ?? 0) !== (a.percentages.Speedtrail ?? 0)
      ) {
        return (b.percentages.Speedtrail ?? 0) - (a.percentages.Speedtrail ?? 0);
      }
      // 4. Nog steeds gelijk: ex aequo
      return 0;
    });

    // Plaatsen en ex equo-markering (perfect voor groepen!)
    let eindresultaat = [];
    let plek = 1;
    let i = 0;
    while (i < deelnemers.length) {
      // Zoek alle ex-aequo's vanaf i
      let groep = [deelnemers[i]];
      while (
        i + groep.length < deelnemers.length &&
        deelnemers[i].aantalDQ === deelnemers[i + groep.length].aantalDQ &&
        deelnemers[i].totaalPunten === deelnemers[i + groep.length].totaalPunten &&
        (deelnemers[i].percentages.Dressuur ?? 0) === (deelnemers[i + groep.length].percentages.Dressuur ?? 0) &&
        (deelnemers[i].percentages.Stijltrail ?? 0) === (deelnemers[i + groep.length].percentages.Stijltrail ?? 0) &&
        (
          (!onderdelen.includes("Speedtrail")) ||
          (deelnemers[i].percentages.Speedtrail ?? 0) === (deelnemers[i + groep.length].percentages.Speedtrail ?? 0)
        )
      ) {
        groep.push(deelnemers[i + groep.length]);
      }
      // Sterretje als ex aequo (groep > 1)
      let plekLabel = groep.length > 1 ? plek + "*" : plek + "";
      for (let j = 0; j < groep.length; j++) {
        eindresultaat.push({
          ...groep[j],
          plek: plekLabel
        });
      }
      plek += groep.length;
      i += groep.length;
    }

    return { eindresultaat, onderdelen }; // geef ook onderdelen door
  }

  function exportPDF(klasse, eindstand, onderdelen) {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(`Einduitslag klasse ${klasse}`, 14, 16);
    let head = [
      ["Plaats", "Ruiter", "Paard", ...onderdelen, "Totaal punten"]
    ];
    let body = eindstand.map(e => [
      e.plek,
      e.naam,
      e.paard,
      ...onderdelen.map(onderdeel => {
        const item = e.perOnderdeel.find(x => x.onderdeel === onderdeel);
        return item
          ? item.dq
            ? "DQ"
            : `${item.punten} (${item.plek})`
          : "-";
      }),
      e.totaalPunten
    ]);
    autoTable(doc, {
      head,
      body,
      startY: 22,
      theme: "grid",
      headStyles: { fillColor: [32, 69, 116] },
      styles: { fontSize: 11 }
    });
    doc.save(`Einduitslag_${klasse}.pdf`);
  }

  function exportExcel(klasse, eindstand, onderdelen) {
    const ws_data = [
      ["Plaats", "Ruiter", "Paard", ...onderdelen, "Totaal punten"],
      ...eindstand.map(e => [
        e.plek,
        e.naam,
        e.paard,
        ...onderdelen.map(onderdeel => {
          const item = e.perOnderdeel.find(x => x.onderdeel === onderdeel);
          return item
            ? item.dq
              ? "DQ"
              : `${item.punten} (${item.plek})`
            : "-";
        }),
        e.totaalPunten
      ])
    ];
    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Einduitslag_${klasse}`);
    XLSX.writeFile(wb, `Einduitslag_${klasse}.xlsx`);
  }

  function exportAfbeelding(klasse) {
    if (tableRefs.current[klasse]) {
      domtoimage.toPng(tableRefs.current[klasse])
        .then(dataUrl => {
          const link = document.createElement("a");
          link.download = `Einduitslag_${klasse}.png`;
          link.href = dataUrl;
          link.click();
        });
    }
  }

  return (
    <div style={{ background: "#f5f7fb", minHeight: "100vh", padding: "24px 0" }}>
      <div style={{
        maxWidth: 1100,
        background: "#fff",
        borderRadius: 16,
        boxShadow: "0 6px 24px #20457422",
        margin: "0 auto",
        padding: "40px 32px 28px 32px",
        fontFamily: "system-ui, sans-serif"
      }}>
        <div style={{ marginBottom: 12, textAlign: "right" }}>
          <Link
            to="/score-invoer"
            style={{
              color: "#3a8bfd",
              fontWeight: 700,
              textDecoration: "none",
              fontSize: 18,
              border: "1px solid #3a8bfd",
              borderRadius: 8,
              padding: "5px 18px",
              background: "#f5f7fb",
              transition: "background 0.2s, color 0.2s",
              marginRight: 10,
            }}
            onMouseOver={e => e.currentTarget.style.background = "#e7f0fa"}
            onMouseOut={e => e.currentTarget.style.background = "#f5f7fb"}
          >
            ← Terug naar score-invoer
          </Link>
        </div>
        <h2 style={{ fontSize: 33, fontWeight: 900, color: "#204574", letterSpacing: 1.2, marginBottom: 22 }}>
          Einduitslag per klasse
        </h2>
        {loading ? (
          <div style={{ textAlign: "center", fontSize: 22, color: "#888", padding: 40 }}>Laden...</div>
        ) : (
          klasses.map(klasse => {
            const { eindresultaat, onderdelen } = berekenEindklassement(klasse);
            if (!eindresultaat.length) return null;
            return (
              <div key={klasse} style={{ marginBottom: 38 }}>
                <h3 style={{
                  color: "#3a8bfd",
                  background: "#f2f8ff",
                  padding: "8px 16px",
                  borderRadius: 12,
                  display: "inline-block",
                  fontWeight: 800,
                  fontSize: 23,
                  letterSpacing: 1.1,
                  marginBottom: 9,
                }}>
                  Klasse {klasse}
                </h3>
                <div style={{ marginBottom: 8, textAlign: "right" }}>
                  <button onClick={() => exportPDF(klasse, eindresultaat, onderdelen)} style={{ marginLeft: 0 }}>Export PDF</button>
                  <button onClick={() => exportExcel(klasse, eindresultaat, onderdelen)} style={{ marginLeft: 8 }}>Export Excel</button>
                  <button onClick={() => exportAfbeelding(klasse)} style={{ marginLeft: 8 }}>Export afbeelding</button>
                </div>
                <div ref={el => (tableRefs.current[klasse] = el)}>
                  <table style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    marginTop: 12,
                    marginBottom: 16,
                    background: "#fafdff",
                    borderRadius: 8,
                  }}>
                    <thead>
                      <tr style={{ background: "#d3e6fd", color: "#174174" }}>
                        <th style={{ padding: 8 }}>Plaats</th>
                        <th style={{ padding: 8 }}>Ruiter</th>
                        <th style={{ padding: 8 }}>Paard</th>
                        {onderdelen.map(onderdeel =>
                          <th style={{ padding: 8 }} key={onderdeel}>{onderdeel}</th>
                        )}
                        <th style={{ padding: 8 }}>Totaal punten</th>
                      </tr>
                    </thead>
                    <tbody>
                      {eindresultaat.map(e => (
                        <tr key={e.id}>
                          <td style={{
                            padding: 8,
                            fontWeight: 800,
                            color: e.aantalDQ === onderdelen.length ? "#b23e3e" : "#204574"
                          }}>{e.plek}</td>
                          <td style={{ padding: 8 }}>{e.naam}</td>
                          <td style={{ padding: 8 }}>{e.paard}</td>
                          {onderdelen.map(onderdeel => {
                            const item = e.perOnderdeel.find(x => x.onderdeel === onderdeel);
                            return (
                              <td style={{ padding: 8, textAlign: "center" }} key={onderdeel}>
                                {item
                                  ? item.dq
                                    ? <span style={{ color: "#b23e3e", fontWeight: 700 }}>DQ</span>
                                    : <>{item.punten} <span style={{ color: "#888", fontWeight: 400 }}>({item.plek})</span></>
                                  : "-"}
                              </td>
                            );
                          })}
                          <td style={{ padding: 8, fontWeight: 700 }}>{e.totaalPunten}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

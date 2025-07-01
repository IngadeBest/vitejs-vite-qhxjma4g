import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabaseClient";
import { Link } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import domtoimage from "dom-to-image";

// Klassen & onderdelen
const klasses = ["WE Intro", "WE1", "WE2", "WE3", "WE4"];
const onderdelen = ["Dressuur", "Stijltrail", "Speedtrail"];

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

  // ---- Correcte WEH-puntentelling met ex aequo en DQ, altijd incl. DQ's! ----
  function berekenEindklassement(klasse) {
    const klasseRuiters = ruiters.filter(r => r.klasse === klasse);

    let tussenstanden = {};
    onderdelen.forEach(onderdeel => {
      const proef = proeven.find(
        p => p.klasse === klasse && p.onderdeel === onderdeel
      );
      if (!proef) return;

      // LET OP: alle scores voor deze proef, incl. DQ's!
      let scoresVoorProef = scores
        .filter(s => s.proef_id === proef.id)
        .map(s => ({
          ...s,
          naam: ruiters.find(r => r.id === s.ruiter_id)?.naam || "",
          paard: ruiters.find(r => r.id === s.ruiter_id)?.paard || "",
        }));

      const aantalGestart = scoresVoorProef.length;

      let zonderDQ = scoresVoorProef.filter(s => !s.dq);
      let metDQ = scoresVoorProef.filter(s => s.dq);

      zonderDQ.sort((a, b) => b.score - a.score);

      let i = 0;
      while (i < zonderDQ.length) {
        let exaequoGroep = [zonderDQ[i]];
        while (
          i + exaequoGroep.length < zonderDQ.length &&
          zonderDQ[i].score === zonderDQ[i + exaequoGroep.length].score
        ) {
          exaequoGroep.push(zonderDQ[i + exaequoGroep.length]);
        }
        const plaats = i + 1;
        let puntenVoorPlaats = [];
        for (let j = 0; j < exaequoGroep.length; j++) {
          let index = plaats + j;
          let punten = index === 1
            ? aantalGestart + 1
            : aantalGestart - (index - 2);
          puntenVoorPlaats.push(punten);
        }
        const punten = Math.min(...puntenVoorPlaats);

        exaequoGroep.forEach(s => {
          tussenstanden[s.ruiter_id] = tussenstanden[s.ruiter_id] || [];
          tussenstanden[s.ruiter_id].push({
            onderdeel,
            plek: plaats,
            punten,
            dq: false,
          });
        });
        i += exaequoGroep.length;
      }

      // DQ's onderaan, altijd 0 punten
      metDQ.forEach((s, idx) => {
        tussenstanden[s.ruiter_id] = tussenstanden[s.ruiter_id] || [];
        tussenstanden[s.ruiter_id].push({
          onderdeel,
          plek: zonderDQ.length + idx + 1,
          punten: 0,
          dq: true,
        });
      });
    });

    // Einduitslag op basis van totaalpunten
    let eindstand = klasseRuiters.map(r => {
      let perOnderdeel = tussenstanden[r.id] || [];
      let totaalPunten = perOnderdeel.reduce((sum, s) => sum + s.punten, 0);
      let heeftDQ = perOnderdeel.some(s => s.dq);
      return {
        id: r.id,
        naam: r.naam,
        paard: r.paard,
        totaalPunten,
        perOnderdeel,
        heeftDQ,
      };
    });

    let zonderDQ = eindstand.filter(e => !e.heeftDQ);
    let metDQ = eindstand.filter(e => e.heeftDQ);

    zonderDQ.sort((a, b) => b.totaalPunten - a.totaalPunten);

    let eindresultaat = [];
    let plek = 1, exaequoCount = 1, vorige = null;
    zonderDQ.forEach((e, i) => {
      if (i > 0 && e.totaalPunten === vorige) {
        exaequoCount++;
      } else if (i > 0) {
        plek += exaequoCount;
        exaequoCount = 1;
      }
      vorige = e.totaalPunten;
      eindresultaat.push({ ...e, plek });
    });

    metDQ.forEach(e => {
      eindresultaat.push({ ...e, plek: "DQ" });
    });

    return eindresultaat;
  }

  // ---- Exports (PDF, Excel, Afbeelding) ----
  function exportPDF(klasse, eindstand) {
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

  function exportExcel(klasse, eindstand) {
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
            const eindstand = berekenEindklassement(klasse);
            if (!eindstand.length) return null;
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
                {/* Export buttons per klasse */}
                <div style={{ marginBottom: 8, textAlign: "right" }}>
                  <button onClick={() => exportPDF(klasse, eindstand)} style={{ marginLeft: 0 }}>Export PDF</button>
                  <button onClick={() => exportExcel(klasse, eindstand)} style={{ marginLeft: 8 }}>Export Excel</button>
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
                      {eindstand.map(e => (
                        <tr key={e.id}>
                          <td style={{
                            padding: 8,
                            fontWeight: 800,
                            color: e.plek === "DQ" ? "#b23e3e" : "#204574"
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

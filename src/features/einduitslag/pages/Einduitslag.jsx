import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
// heavy libs: imported on-demand below to avoid module-init side-effects in the main bundle

// HELPER: 'mm:ss:hh'
function formatTime(secs) {
  if (secs == null) return "";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  const h = Math.round((secs - Math.floor(secs)) * 100);
  return [m, s, h].map((v, i) => v.toString().padStart(2, "0")).join(":");
}

// --- Sorteer klasses met Jeugd direct na hoofdklasse, altijd Intro, WE1, WE2, WE3, WE4 ---
const KLASSERIJ = [
  "WE Intro", "WE1", "WE2", "WE3", "WE4",
];
function sorteerKlasses(klasses) {
  // Vul lijst met hoofdklasses + direct erna Jeugd-variant als ze bestaan
  let resultaat = [];
  KLASSERIJ.forEach(hoofd => {
    if (klasses.includes(hoofd)) resultaat.push(hoofd);
    const jeugd = hoofd + " - Jeugd";
    if (klasses.includes(jeugd)) resultaat.push(jeugd);
  });
  // Voeg rest toe (bijvoorbeeld onbekende nieuwe klasses)
  const rest = klasses.filter(k => !resultaat.includes(k)).sort();
  return [...resultaat, ...rest];
}

import Container from "@/ui/Container";

export default function Einduitslag() {
  const [ruiters, setRuiters] = useState([]);
  const [proeven, setProeven] = useState([]);
  const [scores, setScores] = useState([]);
  const [klasses, setKlasses] = useState([]);
  const refs = useRef({}); // voor afbeelding export

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    const [r, p, s] = await Promise.all([
      supabase.from("ruiters").select("*"),
      supabase.from("proeven").select("*"),
      supabase.from("scores").select("*"),
    ]);
    setRuiters(r.data || []);
    setProeven(p.data || []);
    setScores(s.data || []);
    // Automatisch alle klasses uit proeven (inclusief Jeugd)
    const unieke = Array.from(new Set((p.data || []).map(x => x.klasse)));
    setKlasses(sorteerKlasses(unieke));
  }

  function berekenEindstand(klasse) {
    const proevenInKlasse = proeven.filter(p => p.klasse === klasse);
    const onderdelen = ["Dressuur", "Stijltrail", "Speedtrail"].filter(o =>
      proevenInKlasse.some(p => p.onderdeel === o)
    );
    const deelnemers = ruiters.filter(r => r.klasse === klasse);

    const perRuiter = deelnemers.map(r => {
      let resultaat = { naam: r.naam, paard: r.paard, totaalpunten: 0, dqCount: 0, onderdelen: {} };
      onderdelen.forEach(onderdeel => {
        const proef = proevenInKlasse.find(p => p.onderdeel === onderdeel);
        if (proef) {
          const sc = scores.find(s => s.proef_id === proef.id && s.ruiter_id === r.id);
          if (onderdeel === "Speedtrail") {
            resultaat.onderdelen[onderdeel] = {
              tijd: sc?.score ?? null,
              dq: !!sc?.dq,
              scoreLabel: sc?.dq ? "DQ" : (sc?.score != null ? formatTime(sc.score) : "-"),
            };
          } else {
            let perc = proef.max_score && sc && !sc.dq ? Math.round((sc.score / proef.max_score) * 1000) / 10 : 0;
            resultaat.onderdelen[onderdeel] = {
              punten: sc?.score ?? null,
              percentage: perc,
              dq: !!sc?.dq,
              scoreLabel: sc?.dq ? "DQ" : sc?.score != null ? `${sc.score} (${perc}%)` : "-",
            };
          }
          if (sc?.dq) resultaat.dqCount++;
        }
      });
      return resultaat;
    });

    // Plaatsingspunten per onderdeel: hoogste = n+1
    let uitslag = [...perRuiter];
    onderdelen.forEach(onderdeel => {
      let groep = uitslag
        .map(d => ({
          ...d,
          raw: onderdeel === "Speedtrail"
            ? (d.onderdelen[onderdeel]?.dq ? Infinity : d.onderdelen[onderdeel]?.tijd)
            : (d.onderdelen[onderdeel]?.dq ? -999999 : d.onderdelen[onderdeel]?.punten)
        }))
        .filter(d => d.raw !== null && d.raw !== undefined);

      groep.sort((a, b) => onderdeel === "Speedtrail" ? a.raw - b.raw : b.raw - a.raw);

      // Punten toekennen, ex aequo correct
      let plek = 1, i = 0;
      while (i < groep.length) {
        let exEq = [groep[i]];
        while (
          i + exEq.length < groep.length &&
          groep[i].raw === groep[i + exEq.length].raw
        ) exEq.push(groep[i + exEq.length]);
        let punten = plek === 1
          ? groep.length + 1
          : groep.length - (plek - 1);
        for (let d of exEq) {
          uitslag.find(u => u.naam === d.naam).onderdelen[onderdeel].plaats = plek + (exEq.length > 1 ? "*" : "");
          uitslag.find(u => u.naam === d.naam).onderdelen[onderdeel].plaatsingspunten = d.raw === Infinity || d.raw === -999999 ? 0 : punten;
        }
        plek += exEq.length;
        i += exEq.length;
      }
    });

    uitslag.forEach(u => {
      u.totaalpunten = onderdelen.reduce(
        (sum, o) => sum + (u.onderdelen[o]?.plaatsingspunten || 0), 0
      );
    });

    uitslag.sort((a, b) => {
      if (a.dqCount !== b.dqCount) return a.dqCount - b.dqCount;
      if (b.totaalpunten !== a.totaalpunten) return b.totaalpunten - a.totaalpunten;
      const percA = a.onderdelen["Dressuur"]?.percentage || 0, percB = b.onderdelen["Dressuur"]?.percentage || 0;
      if (percB !== percA) return percB - percA;
      const percStA = a.onderdelen["Stijltrail"]?.percentage || 0, percStB = b.onderdelen["Stijltrail"]?.percentage || 0;
      if (percStB !== percStA) return percStB - percStA;
      const spdA = a.onderdelen["Speedtrail"]?.tijd || Infinity, spdB = b.onderdelen["Speedtrail"]?.tijd || Infinity;
      return spdA - spdB;
    });

    let eindstand = [];
    let plek = 1, i = 0;
    while (i < uitslag.length) {
      let groep = [uitslag[i]];
      while (
        i + groep.length < uitslag.length &&
        uitslag[i].dqCount === uitslag[i + groep.length].dqCount &&
        uitslag[i].totaalpunten === uitslag[i + groep.length].totaalpunten &&
        (uitslag[i].onderdelen["Dressuur"]?.percentage || 0) === (uitslag[i + groep.length].onderdelen["Dressuur"]?.percentage || 0) &&
        (uitslag[i].onderdelen["Stijltrail"]?.percentage || 0) === (uitslag[i + groep.length].onderdelen["Stijltrail"]?.percentage || 0) &&
        (uitslag[i].onderdelen["Speedtrail"]?.tijd || Infinity) === (uitslag[i + groep.length].onderdelen["Speedtrail"]?.tijd || Infinity)
      ) groep.push(uitslag[i + groep.length]);
      let plekLabel = groep.length > 1 ? plek + "*" : plek + "";
      for (let d of groep) d.plaats = plekLabel;
      eindstand.push(...groep);
      plek += groep.length;
      i += groep.length;
    }

    return { onderdelen, eindstand };
  }

  // --- EXPORTS ---
  function handleExportExcel(klasse, onderdelen, eindstand) {
    return (async () => {
      const mod = await import('xlsx');
      const XLSX = (mod && (mod.default || mod)) || mod;
      const ws = XLSX.utils.json_to_sheet(
        eindstand.map(item => ({
          Plaats: item.plaats,
          Ruiter: item.naam,
          Paard: item.paard,
          ...Object.fromEntries(onderdelen.map(o =>
            [o, item.onderdelen[o]?.scoreLabel + (item.onderdelen[o]?.plaats ? ` (${item.onderdelen[o].plaats})` : "")]
          )),
          "Totaal punten": item.totaalpunten
        }))
      );
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, klasse);
      XLSX.writeFile(wb, `Einduitslag_${klasse}.xlsx`);
    })();
  }

  async function handleExportPDF(klasse) {
    const el = refs.current[klasse];
    const [{ default: html2canvas }, modJsPDF] = await Promise.all([import('html2canvas'), import('jspdf')]);
    const jsPDFLib = (modJsPDF && (modJsPDF.default || modJsPDF.jsPDF)) || modJsPDF;
    const canvas = await html2canvas(el, { backgroundColor: "#fff", scale: 2 });
    const pdf = new (jsPDFLib.default || jsPDFLib)({
      orientation: "landscape",
      unit: "pt",
      format: [canvas.width, canvas.height + 60]
    });
    pdf.addImage(canvas, "PNG", 10, 30, canvas.width - 20, canvas.height - 40);
    pdf.text(`Einduitslag ${klasse}`, 30, 20);
    pdf.save(`Einduitslag_${klasse}.pdf`);
  }

  async function handleExportAfbeelding(klasse) {
    const el = refs.current[klasse];
    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(el, { backgroundColor: "#fff", scale: 2 });
    const link = document.createElement("a");
    link.download = `Einduitslag_${klasse}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <div style={{ background: "#f5f7fb", minHeight: "100vh", padding: 24 }}>
      <Container maxWidth={900}>
        <div style={{
          background: "#fff",
          borderRadius: 16,
          boxShadow: "0 6px 24px #20457422",
          padding: "40px 32px 28px 32px",
          fontFamily: "system-ui, sans-serif"
        }}>
        <h2 style={{ fontSize: 33, fontWeight: 900, color: "#204574", letterSpacing: 1.2, marginBottom: 22 }}>
          Einduitslag per klasse
        </h2>
        {klasses.map(klasse => {
          const { onderdelen, eindstand } = berekenEindstand(klasse);
          if (eindstand.length === 0) return null;
          return (
            <div key={klasse} style={{ marginBottom: 40 }}>
              <div style={{
                fontWeight: 800,
                background: "#e6eefb",
                color: "#296fe6",
                padding: "8px 16px",
                borderRadius: 10,
                display: "inline-block",
                fontSize: 22,
                marginBottom: 14
              }}>{`Klasse ${klasse}`}</div>
              <div ref={el => (refs.current[klasse] = el)}>
                <table style={{ width: "100%", borderCollapse: "collapse", background: "#fafdff", borderRadius: 8 }}>
                  <thead>
                    <tr style={{ background: "#d3e6fd", color: "#174174" }}>
                      <th style={{ padding: 8 }}>Plaats</th>
                      <th style={{ padding: 8 }}>Ruiter</th>
                      <th style={{ padding: 8 }}>Paard</th>
                      {onderdelen.map(o =>
                        <th key={o} style={{ padding: 8 }}>{o}</th>
                      )}
                      <th style={{ padding: 8 }}>Totaal punten</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eindstand.map((item, idx) => (
                      <tr key={item.naam + item.paard}>
                        <td style={{ padding: 8, fontWeight: 700 }}>{item.plaats}</td>
                        <td style={{ padding: 8 }}>{item.naam}</td>
                        <td style={{ padding: 8 }}>{item.paard}</td>
                        {onderdelen.map(o => (
                          <td key={o} style={{ padding: 8 }}>
                            {item.onderdelen[o]?.scoreLabel}
                            {item.onderdelen[o]?.plaats &&
                              ` (${item.onderdelen[o].plaats})`}
                          </td>
                        ))}
                        <td style={{ padding: 8, fontWeight: 700 }}>{item.totaalpunten}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ margin: "12px 0 0 0", display: "flex", gap: 12 }}>
                <button onClick={() => handleExportPDF(klasse, onderdelen, eindstand)}
                  style={{ padding: "7px 16px", fontWeight: 700, borderRadius: 8, border: "1px solid #d3e6fd", background: "#fafdff", cursor: "pointer" }}>
                  Export PDF
                </button>
                <button onClick={() => handleExportExcel(klasse, onderdelen, eindstand)}
                  style={{ padding: "7px 16px", fontWeight: 700, borderRadius: 8, border: "1px solid #d3e6fd", background: "#fafdff", cursor: "pointer" }}>
                  Export Excel
                </button>
                <button onClick={() => handleExportAfbeelding(klasse)}
                  style={{ padding: "7px 16px", fontWeight: 700, borderRadius: 8, border: "1px solid #d3e6fd", background: "#fafdff", cursor: "pointer" }}>
                  Export afbeelding
                </button>
              </div>
            </div>
          );
        })}
        </div>
      </Container>
    </div>
  );
}

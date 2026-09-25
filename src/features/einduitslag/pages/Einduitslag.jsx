import { loadScoreData } from '@/features/scoring/scoreData';
import { CLASSES } from "@/rules/weh/classes";
import { calculateStandings } from "@/rules/weh/rankings";
import { useAccess } from "@/features/auth/AdminGate";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useWedstrijden } from "@/features/inschrijven/pages/hooks/useWedstrijden";
import { useWedstrijdContext } from "@/features/wedstrijden/context/WedstrijdContext";
import "./Einduitslag.css";
// heavy libs: imported on-demand below to avoid module-init side-effects in the main bundle


// HELPER: Normalize klasse names to consistent format

// --- Sorteer klasses met Jeugd direct na hoofdklasse, altijd Intro, WE1, WE2, WE3, WE4 ---
const KLASSERIJ = CLASSES.map(c => c.naam);
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
  const { items: alleWedstrijden, loading: loadingWed } = useWedstrijden(false);
  const { isAdmin, scoreWedstrijdIds } = useAccess();
  const wedstrijden = alleWedstrijden.filter(w => isAdmin || scoreWedstrijdIds.includes(w.id));
  const { selectedWedstrijdId: appSelectedWedstrijdId } = useWedstrijdContext();
  const [selectedWedstrijdId, setSelectedWedstrijdId] = useState("");
  const [ruiters, setRuiters] = useState([]);
  const [proeven, setProeven] = useState([]);
  const [scores, setScores] = useState([]);
  const [klasses, setKlasses] = useState([]);
  const refs = useRef({}); // voor afbeelding export

  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (appSelectedWedstrijdId) setSelectedWedstrijdId(appSelectedWedstrijdId);
  }, [appSelectedWedstrijdId]);
  useEffect(() => {
    let cancelled = false;
    setRuiters([]); setProeven([]); setScores([]); setKlasses([]); setLoadError('');
    if (!selectedWedstrijdId) return;
    setLoading(true);
    loadScoreData(supabase, selectedWedstrijdId).then(({participants,tests,scores}) => {
      if (cancelled) return;
      setRuiters(participants); setProeven(tests); setScores(scores);
      setKlasses(sorteerKlasses([...new Set([...tests.map(t=>t.klasse),...participants.map(p=>p.klasse)])]));
    }).catch(e=>{if(!cancelled) setLoadError(e.message);}).finally(()=>{if(!cancelled)setLoading(false);});
    return ()=>{cancelled=true;};
  }, [selectedWedstrijdId, refresh]);

  function berekenEindstand(klasse) {
    try {
      return calculateStandings({ klasse, participants: ruiters, tests: proeven, scores });
    } catch (error) {
      return { onderdelen: [], eindstand: [], error: error.message };
    }
  }

  // --- EXPORTS ---
  function handleExportExcel(klasse, onderdelen, eindstand) {
    return (async () => {
      const mod = await import('xlsx');
      const XLSX = (mod && (mod.default || mod)) || mod;
      const ws = XLSX.utils.json_to_sheet(
        eindstand.map(item => ({
          Plaats: item.plaats,
          Startnummer: item.startnummer,
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
    <div className="eu-page">
      <Container maxWidth={900}>
        <div className="eu-shell">
        <h2 className="eu-title">
          Einduitslag per klasse
        </h2>
        
        {/* Wedstrijd selectie */}
        <div className="eu-select-card">
          <label className="eu-label">
            Wedstrijd:
          </label>
          <select 
            value={selectedWedstrijdId} 
            onChange={(e) => setSelectedWedstrijdId(e.target.value)}
            disabled={loadingWed}
            className="eu-select"
          >
            <option value="">{loadingWed ? "Laden..." : "— Selecteer wedstrijd —"}</option>
            {wedstrijden.map(w => (
              <option key={w.id} value={w.id}>
                {w.naam} {w.datum ? `(${w.datum})` : ""}
              </option>
            ))}
          </select>
        </div>

        <button className="eu-button" disabled={loading} onClick={()=>setRefresh(n=>n+1)}>Uitslag verversen</button>
        {loading && <p role="status">Scores laden…</p>}
        {loadError && <p role="alert">Uitslag kon niet worden geladen: {loadError}</p>}
        {!selectedWedstrijdId && (
          <div className="eu-empty">
            Selecteer een wedstrijd om de einduitslag te bekijken
          </div>
        )}

        {selectedWedstrijdId && !loading && !loadError && klasses.length === 0 && (
          <div className="eu-empty">
            Geen proeven of scores gevonden voor deze wedstrijd
          </div>
        )}

        {selectedWedstrijdId && klasses.map(klasse => {
          const { onderdelen, eindstand, error, preliminary } = berekenEindstand(klasse);
          if (error) return <p key={klasse} role="alert">{klasse}: {error}</p>;
          if (eindstand.length === 0) return null;
          return (
            <div key={klasse} className="eu-klasse-block">
              <div className="eu-klasse-badge">{`Klasse ${klasse}`}</div>
              <div ref={el => (refs.current[klasse] = el)}>
                {preliminary && <p role="status">Voorlopige uitslag: nog niet alle scores of resultaatstatussen zijn ingevoerd.</p>}
                <div className="eu-table-wrap">
                <table className="eu-table">
                  <thead>
                    <tr>
                      <th>Plaats</th>
                      <th>Startnr.</th>
                      <th>Ruiter</th>
                      <th>Paard</th>
                      {onderdelen.map(o =>
                        <th key={o}>{o}</th>
                      )}
                      <th>Totaal punten</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eindstand.map((item, idx) => (
                      <tr key={item.uuid || item.id}>
                        <td className="eu-strong">{item.plaats}</td>
                        <td>{item.startnummer}</td>
                        <td>{item.naam}</td>
                        <td>{item.paard}</td>
                        {onderdelen.map(o => (
                          <td key={o}>
                            {item.onderdelen[o]?.scoreLabel}
                            {item.onderdelen[o]?.plaats &&
                              ` (${item.onderdelen[o].plaats})`}
                          </td>
                        ))}
                        <td className="eu-strong">{item.totaalpunten}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
              <div className="eu-actions">
                <button onClick={() => handleExportPDF(klasse, onderdelen, eindstand)}
                  className="eu-button">
                  Export PDF
                </button>
                <button onClick={() => handleExportExcel(klasse, onderdelen, eindstand)}
                  className="eu-button">
                  Export Excel
                </button>
                <button onClick={() => handleExportAfbeelding(klasse)}
                  className="eu-button">
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

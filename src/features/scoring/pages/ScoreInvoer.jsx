import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useWedstrijdContext } from "@/features/wedstrijden/context/WedstrijdContext";
import "./ScoreInvoer.css";

// Helper: 'mm:ss:hh' (of 'mm:ss') => seconden (float)
function parseTimeString(str) {
  if (!str) return 0;
  const parts = str.trim().split(":").map(s => s.replace(/[^0-9]/g,"")).filter(Boolean);
  if (parts.length === 2) {
    const [min, sec] = parts;
    return parseInt(min) * 60 + parseInt(sec);
  }
  if (parts.length === 3) {
    const [min, sec, hun] = parts;
    return parseInt(min) * 60 + parseInt(sec) + parseInt(hun) / 100;
  }
  return Number(str); // fallback
}

// Helper: seconden (float) => 'mm:ss:hh'
function formatTime(secs) {
  if (secs == null) return "";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  const h = Math.round((secs - Math.floor(secs)) * 100);
  return [m, s, h].map((v, i) => v.toString().padStart(2, "0")).join(":");
}

const onderdelen = ["Dressuur", "Stijltrail", "Speedtrail"];

export default function ScoreInvoer() {
  const { selectedWedstrijdId: activeWedstrijdId, selectedWedstrijd } = useWedstrijdContext();
  const [ruiters, setRuiters] = useState([]);
  const [proeven, setProeven] = useState([]);
  const [scores, setScores] = useState([]);
  const [selectedKlasse, setSelectedKlasse] = useState("");
  const [selectedOnderdeel, setSelectedOnderdeel] = useState("");
  const [selectedProef, setSelectedProef] = useState(null);
  const [selectedRuiter, setSelectedRuiter] = useState("");
  const [scoreInput, setScoreInput] = useState("");
  const [dq, setDQ] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchRuiters();
    fetchProeven();
    resetForm();
    setSelectedKlasse("");
    setSelectedOnderdeel("");
    setSelectedProef(null);
  }, [activeWedstrijdId]);
  useEffect(() => { if (selectedProef) { fetchScores(); } else { setScores([]); } }, [selectedProef]);

  async function fetchRuiters() {
    // Haal ruiters uit inschrijvingen tabel (nieuw systeem)
    let query = supabase.from("inschrijvingen").select("id, startnummer, ruiter, paard, klasse, wedstrijd_id, rubriek").order("startnummer");
    if (activeWedstrijdId) {
      query = query.eq("wedstrijd_id", activeWedstrijdId);
    }
    let { data } = await query;
    
    // Normaliseer klasse codes naar proeven formaat
    const klasseMap = {
      'we0': 'Introductieklasse (WE0)',
      'we0 - jeugd': 'Introductieklasse (WE0) - Jeugd',
      'we1': 'WE1',
      'we1 - jeugd': 'WE1 - Jeugd',
      'we2': 'WE2',
      'we2 - jeugd': 'WE2 - Jeugd',
      'we2p': 'WE2+',
      'we2+ - jeugd': 'WE2+ - Jeugd',
      'we2+': 'WE2+',
      'we3': 'WE3',
      'we3 - jeugd': 'WE3 - Jeugd',
      'we4': 'WE4',
      'we4 - jeugd': 'WE4 - Jeugd',
      'yr': 'Young Riders',
      'junior': 'Junioren',
      'junioren': 'Junioren'
    };
    
    // Map naar oude structuur voor backwards compatibility
    const mapped = (data || []).map(inschrijving => {
      const klasseLower = (inschrijving.klasse || '').toLowerCase();
      const normalizedKlasse = klasseMap[klasseLower] || inschrijving.klasse;
      const rubriek = inschrijving.rubriek || 'Algemeen';
      
      // Bepaal base klasse (zonder jeugd suffix)
      const baseKlasse = normalizedKlasse.replace(/ - Jeugd$/i, '');
      
      // klasseMetRubriek is hetzelfde als normalizedKlasse (klasse heeft al jeugd suffix indien van toepassing)
      const klasseMetRubriek = normalizedKlasse;
      
      // Gebruik startnummer als numeriek ID voor scores tabel
      const numericId = inschrijving.startnummer ? parseInt(inschrijving.startnummer) : null;
      
      return {
        id: numericId,  // Gebruik startnummer als numeriek ID
        uuid: inschrijving.id,  // Bewaar originele UUID voor referentie
        naam: inschrijving.ruiter,
        paard: inschrijving.paard,
        klasse: baseKlasse,  // Base klasse zonder jeugd
        klasseMetRubriek: klasseMetRubriek,  // Volledige klasse inclusief jeugd suffix
        rubriek: rubriek,
        wedstrijd_id: inschrijving.wedstrijd_id,
        startnummer: inschrijving.startnummer
      };
    }).filter(r => r.id !== null);  // Filter out entries zonder startnummer
    
    setRuiters(mapped);
  }
  async function fetchProeven() {
    let query = supabase.from("proeven").select("*").order("id");
    if (activeWedstrijdId) {
      query = query.eq("wedstrijd_id", activeWedstrijdId);
    }
    let { data } = await query;
    setProeven(data || []);
  }
  async function fetchScores() {
    if (!selectedProef) return;
    let { data } = await supabase
      .from("scores")
      .select("*")
      .eq("proef_id", selectedProef.id)
      .order("id");
    setScores(data || []);
  }
  function resetForm() {
    setSelectedRuiter("");
    setScoreInput("");
    setDQ(false);
    setEditingId(null);
    setError("");
  }
  function getProefOpties() {
    return proeven.filter(
      (p) =>
        p.klasse === selectedKlasse &&
        p.onderdeel === selectedOnderdeel
    );
  }
  function getMaxScore() {
    if (selectedProef && selectedProef.max_score) {
      return selectedProef.max_score;
    }
    return "";
  }
  function getRuitersVoorKlasse() {
    // Filter ruiters op basis van geselecteerde proef
    // Als proef " - Jeugd" suffix heeft, toon alleen jeugd ruiters
    // Anders toon algemeen + senior ruiters
    if (!selectedProef) return [];
    
    const isJeugdProef = selectedProef.klasse?.includes(' - Jeugd');
    
    return ruiters.filter((r) => {
      // Match op klasseMetRubriek voor jeugd proeven
      if (isJeugdProef) {
        return r.klasseMetRubriek === selectedProef.klasse;
      }
      // Voor niet-jeugd proeven: toon algemeen en senior ruiters
      return r.klasse === selectedKlasse && (r.rubriek === 'Algemeen' || r.rubriek === 'Senior');
    });
  }
  async function handleOpslaan() {
    if (!selectedProef || !selectedRuiter) {
      setError("Kies proef en ruiter!");
      return;
    }
    if (!dq && !scoreInput) {
      setError("Vul score/tijd in of vink DQ aan.");
      return;
    }
    setError("");
    
    try {
      let insertObj = {
        proef_id: selectedProef.id,
        ruiter_id: selectedRuiter,
        dq: dq,
      };
      if (selectedOnderdeel === "Speedtrail") {
        insertObj.score = dq ? 0 : parseTimeString(scoreInput);
      } else {
        insertObj.score = dq ? 0 : Number(scoreInput);
      }
      
      let result;
      if (editingId) {
        result = await supabase.from("scores").update(insertObj).eq("id", editingId);
      } else {
        result = await supabase.from("scores").insert([insertObj]);
      }
      
      if (result.error) {
        console.error('Database error:', result.error);
        setError("Database fout: " + result.error.message);
        return;
      }
      
      console.log('Score saved successfully:', result);
      resetForm();
      fetchScores();
    } catch (err) {
      console.error('Save error:', err);
      setError("Fout bij opslaan: " + (err.message || String(err)));
    }
  }
  function handleEdit(score) {
    setEditingId(score.id);
    setSelectedRuiter(score.ruiter_id);
    // Tijd als string tonen bij Speedtrail
    setScoreInput(
      selectedOnderdeel === "Speedtrail"
        ? formatTime(score.score)
        : (score.score || "")
    );
    setDQ(!!score.dq);
    setError("");
  }
  async function handleDelete(id) {
    await supabase.from("scores").delete().eq("id", id);
    fetchScores();
  }
  function berekenKlassement() {
    if (!scores.length) return [];
    // Vul namen/paarden aan uit ruiters
    const scoresWithName = scores.map((s) => ({
      ...s,
      naam: ruiters.find((r) => r.id === s.ruiter_id)?.naam || "Onbekend",
      paard: ruiters.find((r) => r.id === s.ruiter_id)?.paard || "Onbekend",
    }));
    const totaalGestart = scoresWithName.length; // incl DQ

    let deelnemersZonderDQ = scoresWithName.filter((s) => !s.dq);
    let deelnemersMetDQ = scoresWithName.filter((s) => s.dq);

    // Sortering: Speedtrail op tijd, anders op score
    if (selectedOnderdeel === "Speedtrail") {
      deelnemersZonderDQ = deelnemersZonderDQ
        .sort((a, b) => a.score - b.score);
    } else {
      deelnemersZonderDQ = deelnemersZonderDQ
        .map((s) => ({
          ...s,
          percentage:
            selectedProef && selectedProef.max_score && s.score
              ? Math.round((s.score / selectedProef.max_score) * 1000) / 10
              : 0,
        }))
        .sort((a, b) => b.score - a.score);
    }

    // Ex aequo per score/tijd
    let resultaat = [];
    let plek = 1, i = 0;
    while (i < deelnemersZonderDQ.length) {
      let groep = [deelnemersZonderDQ[i]];
      while (
        i + groep.length < deelnemersZonderDQ.length &&
        deelnemersZonderDQ[i].score === deelnemersZonderDQ[i + groep.length].score
      ) {
        groep.push(deelnemersZonderDQ[i + groep.length]);
      }
      let plekLabel = groep.length > 1 ? plek + "*" : plek + "";
      let punten = plek === 1
        ? totaalGestart + 1
        : totaalGestart - (plek - 1);
      for (let j = 0; j < groep.length; j++) {
        resultaat.push({
          ...groep[j],
          plaats: plekLabel,
          punten,
          scoreLabel: selectedOnderdeel === "Speedtrail"
            ? (groep[j].score ? formatTime(groep[j].score) : "0")
            : `${groep[j].score} (${groep[j].percentage}%)`
        });
      }
      plek += groep.length;
      i += groep.length;
    }

    // DQ’s onderaan, altijd plek DQ en 0 punten
    deelnemersMetDQ.forEach((s) => {
      resultaat.push({
        ...s,
        plaats: "DQ",
        punten: 0,
        scoreLabel: "DQ",
      });
    });

    return [
      ...resultaat.filter((k) => k.plaats !== "DQ"),
      ...resultaat.filter((k) => k.plaats === "DQ"),
    ];
  }

  const klassement = berekenKlassement();

  return (
    <div className="si-page">
      <div className="si-shell">
        <div className="si-hero">
          <h2>Score-invoer</h2>
          <div className="si-note">
          {selectedWedstrijd ? `Actieve wedstrijd: ${selectedWedstrijd.naam}` : "Geen actieve wedstrijd geselecteerd"}
          </div>
        </div>

        <section className="si-card">
        <div className="si-form-grid">
          <label className="si-field">
            <span>Klasse</span>
            <select className="si-input" value={selectedKlasse} onChange={e => {
              setSelectedKlasse(e.target.value);
              setSelectedOnderdeel("");
              setSelectedProef(null);
              resetForm();
            }}>
              <option value="">--</option>
              {[...new Set(proeven.map(p => p.klasse))].map(k => <option key={k}>{k}</option>)}
            </select>
          </label>
          <label className="si-field">
            <span>Onderdeel</span>
            <select className="si-input" value={selectedOnderdeel} onChange={e => {
              setSelectedOnderdeel(e.target.value);
              setSelectedProef(null);
              resetForm();
            }}>
              <option value="">--</option>
              {onderdelen.map(o => <option key={o}>{o}</option>)}
            </select>
          </label>
          <label className="si-field si-span-2">
            <span>Proef</span>
            <select className="si-input" value={selectedProef?.id || ""} onChange={e => {
              const proef = proeven.find(p => p.id === Number(e.target.value));
              setSelectedProef(proef || null);
              resetForm();
            }}>
              <option value="">---</option>
              {getProefOpties().map(p =>
                <option key={p.id} value={p.id}>
                  {p.naam} ({p.datum})
                </option>
              )}
            </select>
          </label>
        </div>
        </section>

        <section className="si-card">
        <div className="si-form-grid si-form-grid-actions">
          <label className="si-field si-span-2">
            <span>Ruiter</span>
            <select className="si-input" value={selectedRuiter} onChange={e => setSelectedRuiter(e.target.value)}>
              <option value="">---</option>
              {getRuitersVoorKlasse().map(r =>
                <option key={r.id} value={r.id}>{r.naam} met {r.paard}</option>
              )}
            </select>
          </label>
          <label className="si-field">
            <span>{selectedOnderdeel === "Speedtrail" ? "Tijd (mm:ss:hh)" : "Score"}</span>
            {selectedOnderdeel === "Speedtrail" ? (
              <input
                className="si-input"
                type="text"
                pattern="[0-9]{2}:[0-9]{2}(:[0-9]{2})?"
                value={scoreInput}
                onChange={e => setScoreInput(e.target.value)}
                placeholder="02:35:09"
                disabled={dq}
              />
            ) : (
              <input
                className="si-input"
                type="number"
                value={scoreInput}
                onChange={e => setScoreInput(e.target.value)}
                disabled={dq}
              />
            )}
            {selectedOnderdeel !== "Speedtrail" && selectedProef && selectedProef.max_score ? (
              <span className="si-max-score">
                / {selectedProef.max_score}
              </span>
            ) : null}
          </label>
          <label className="si-check">
            <input
              type="checkbox"
              checked={dq}
              onChange={e => setDQ(e.target.checked)}
            />
            <span>DQ</span>
          </label>
          <button className="si-button" onClick={handleOpslaan}>
            {editingId ? "Bijwerken" : "Opslaan"}
          </button>
        </div>
        {error && <div className="si-error">{error}</div>}
        </section>

        <section className="si-card si-overview">
        <div className="si-card-head">
          <h3>
          Tussenstand {selectedKlasse && `${selectedKlasse}`} {selectedOnderdeel && `– ${selectedOnderdeel}`}
          </h3>
        </div>
        <div className="si-table-wrap">
        <table className="si-table">
          <thead>
            <tr>
              <th>Plaats</th>
              <th>Ruiter</th>
              <th>Paard</th>
              <th>{selectedOnderdeel === "Speedtrail" ? "Tijd" : "Score"}</th>
              <th>Punten</th>
              <th>Acties</th>
            </tr>
          </thead>
          <tbody>
            {klassement.length === 0 ? (
              <tr>
                <td colSpan={6} className="si-empty">
                  Nog geen scores ingevoerd voor deze proef/klasse.
                </td>
              </tr>
            ) : (
              klassement.map(item => (
                <tr key={item.id || item.ruiter_id}>
                  <td>{item.plaats}</td>
                  <td>{item.naam}</td>
                  <td>{item.paard}</td>
                  <td>{item.scoreLabel}</td>
                  <td className="si-strong">{item.punten}</td>
                  <td>
                    <div className="si-actions">
                      <button type="button" className="si-link-button" onClick={() => handleEdit(item)}>Bewerken</button>
                      <button type="button" className="si-link-button si-link-danger" onClick={() => handleDelete(item.id)}>Verwijderen</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
        <div className="si-mobile-list">
          {klassement.length === 0 ? (
            <div className="si-empty si-mobile-empty">Nog geen scores ingevoerd voor deze proef/klasse.</div>
          ) : klassement.map((item) => (
            <article key={item.id || item.ruiter_id} className="si-mobile-card">
              <div className="si-mobile-head">
                <div>
                  <strong>{item.naam}</strong>
                  <div className="si-muted">{item.paard}</div>
                </div>
                <div className="si-pill">{item.plaats}</div>
              </div>
              <div className="si-mobile-grid">
                <div><span>Score</span>{item.scoreLabel}</div>
                <div><span>Punten</span>{item.punten}</div>
              </div>
              <div className="si-actions">
                <button type="button" className="si-link-button" onClick={() => handleEdit(item)}>Bewerken</button>
                <button type="button" className="si-link-button si-link-danger" onClick={() => handleDelete(item.id)}>Verwijderen</button>
              </div>
            </article>
          ))}
        </div>
        </section>
      </div>
    </div>
  );
}

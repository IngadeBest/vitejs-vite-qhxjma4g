import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";

const onderdelen = ["Dressuur", "Stijltrail", "Speedtrail"];

export default function ScoreInvoer() {
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

  // Ophalen ruiters & proeven
  useEffect(() => {
    fetchRuiters();
    fetchProeven();
  }, []);

  // Ophalen scores voor geselecteerde proef
  useEffect(() => {
    if (selectedProef) {
      fetchScores();
    } else {
      setScores([]);
    }
  }, [selectedProef]);

  async function fetchRuiters() {
    let { data } = await supabase.from("ruiters").select("*").order("id");
    setRuiters(data || []);
  }

  async function fetchProeven() {
    let { data } = await supabase.from("proeven").select("*").order("id");
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

  // Proef selecteren op basis van klasse en onderdeel
  function getProefOpties() {
    return proeven.filter(
      (p) =>
        p.klasse === selectedKlasse &&
        p.onderdeel === selectedOnderdeel
    );
  }

  // Max score uit de geselecteerde proef
  function getMaxScore() {
    if (selectedProef) {
      return selectedProef.max_score || "";
    }
    return "";
  }

  // Ruiters in de geselecteerde klasse
  function getRuitersVoorKlasse() {
    return ruiters.filter((r) => r.klasse === selectedKlasse);
  }

  // Toevoegen of bewerken score
  async function handleOpslaan() {
    if (!selectedProef || !selectedRuiter) {
      setError("Kies proef en ruiter!");
      return;
    }
    if (!dq && !scoreInput) {
      setError("Vul score in of vink DQ aan.");
      return;
    }
    setError("");
    let insertObj = {
      proef_id: selectedProef.id,
      ruiter_id: selectedRuiter,
      score: dq ? 0 : Number(scoreInput),
      dq: dq,
      // evt. tijd/extra velden toevoegen
    };
    if (editingId) {
      await supabase.from("scores").update(insertObj).eq("id", editingId);
    } else {
      await supabase.from("scores").insert([insertObj]);
    }
    resetForm();
    fetchScores();
  }

  // Bewerken score
  function handleEdit(score) {
    setEditingId(score.id);
    setSelectedRuiter(score.ruiter_id);
    setScoreInput(score.score || "");
    setDQ(!!score.dq);
    setError("");
  }

  // Verwijderen score
  async function handleDelete(id) {
    await supabase.from("scores").delete().eq("id", id);
    fetchScores();
  }

  // Klassement berekenen
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

    deelnemersZonderDQ = deelnemersZonderDQ.map((s) => ({
      ...s,
      percentage:
        selectedProef && selectedProef.max_score && s.score
          ? Math.round((s.score / selectedProef.max_score) * 1000) / 10
          : 0,
    }))
    .sort((a, b) => b.score - a.score);

    // Plaats- en puntentelling (ex-aequo, correct volgens WE)
    let resultaat = [];
    let plek = 1;
    let exaequoCount = 1;
    let vorigeWaarde = null;

    for (let i = 0; i < deelnemersZonderDQ.length; i++) {
      const s = deelnemersZonderDQ[i];
      let waarde = s.score; // vergelijk op ruwe score

      if (i === 0) {
        plek = 1;
        exaequoCount = 1;
      } else if (waarde === vorigeWaarde) {
        exaequoCount++;
      } else {
        plek = plek + exaequoCount;
        exaequoCount = 1;
      }
      vorigeWaarde = waarde;

      let punten = totaalGestart + 1 - plek;

      resultaat.push({
        ...s,
        plaats: plek,
        punten,
        scoreLabel: `${s.score} (${s.percentage}%)`,
      });
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

    // Eerst niet-DQ, dan DQ’s
    return [
      ...resultaat.filter((k) => k.plaats !== "DQ"),
      ...resultaat.filter((k) => k.plaats === "DQ"),
    ];
  }

  // Rendering
  return (
    <div style={{ background: "#f5f7fb", minHeight: "100vh", padding: "24px 0" }}>
      <div style={{
        maxWidth: 750,
        background: "#fff",
        borderRadius: 16,
        boxShadow: "0 6px 24px #20457422",
        margin: "0 auto",
        padding: "40px 32px 28px 32px",
        fontFamily: "system-ui, sans-serif"
      }}>
        <h2 style={{ fontSize: 33, fontWeight: 900, color: "#204574", letterSpacing: 1.2, marginBottom: 22 }}>
          Score-invoer
        </h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 18, marginBottom: 20 }}>
          <label>
            Klasse:
            <select value={selectedKlasse} onChange={e => {
              setSelectedKlasse(e.target.value);
              setSelectedOnderdeel("");
              setSelectedProef(null);
              resetForm();
            }}>
              <option value="">--</option>
              {["WE Intro", "WE1", "WE2", "WE3", "WE4"].map(k => <option key={k}>{k}</option>)}
            </select>
          </label>
          <label>
            Onderdeel:
            <select value={selectedOnderdeel} onChange={e => {
              setSelectedOnderdeel(e.target.value);
              setSelectedProef(null);
              resetForm();
            }}>
              <option value="">--</option>
              {onderdelen.map(o => <option key={o}>{o}</option>)}
            </select>
          </label>
          <label>
            Proef:
            <select value={selectedProef?.id || ""} onChange={e => {
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
        <div style={{ display: "flex", gap: 20, alignItems: "center", marginBottom: 16 }}>
          <label>
            Ruiter:
            <select value={selectedRuiter} onChange={e => setSelectedRuiter(e.target.value)}>
              <option value="">---</option>
              {getRuitersVoorKlasse().map(r =>
                <option key={r.id} value={r.id}>{r.naam} met {r.paard}</option>
              )}
            </select>
          </label>
          <label>
            Score:
            <input
              type="number"
              value={scoreInput}
              onChange={e => setScoreInput(e.target.value)}
              disabled={dq}
              style={{ width: 70 }}
            />
            {selectedProef && selectedProef.max_score ? (
              <span style={{ color: "#999", marginLeft: 4 }}>
                / {selectedProef.max_score}
              </span>
            ) : null}
          </label>
          <label>
            DQ:
            <input
              type="checkbox"
              checked={dq}
              onChange={e => setDQ(e.target.checked)}
            />
          </label>
          <button onClick={handleOpslaan} style={{
            background: "#3a8bfd",
            color: "#fff",
            fontWeight: 700,
            padding: "10px 22px",
            border: "none",
            borderRadius: 8,
            fontSize: 18,
            cursor: "pointer"
          }}>
            {editingId ? "Bijwerken" : "Opslaan"}
          </button>
        </div>
        {error && <div style={{ color: "red", marginBottom: 12 }}>{error}</div>}

        <h3 style={{
          marginTop: 32, marginBottom: 8,
          color: "#3a8bfd", textTransform: "uppercase",
          fontWeight: 700, fontSize: 22
        }}>
          Tussenstand {selectedKlasse && `${selectedKlasse}`} {selectedOnderdeel && `– ${selectedOnderdeel}`}
        </h3>
        <table style={{ width: "100%", borderCollapse: "collapse", background: "#fafdff", borderRadius: 8 }}>
          <thead>
            <tr style={{ background: "#d3e6fd", color: "#174174" }}>
              <th style={{ padding: 8 }}>Plaats</th>
              <th style={{ padding: 8 }}>Ruiter</th>
              <th style={{ padding: 8 }}>Paard</th>
              <th style={{ padding: 8 }}>Score</th>
              <th style={{ padding: 8 }}>Punten</th>
              <th style={{ padding: 8 }}>Acties</th>
            </tr>
          </thead>
          <tbody>
            {berekenKlassement().length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: 16, color: "#777" }}>
                  Nog geen scores ingevoerd voor deze proef/klasse.
                </td>
              </tr>
            ) : (
              berekenKlassement().map(item => (
                <tr key={item.id || item.ruiter_id}>
                  <td style={{ padding: 8 }}>{item.plaats}</td>
                  <td style={{ padding: 8 }}>{item.naam}</td>
                  <td style={{ padding: 8 }}>{item.paard}</td>
                  <td style={{ padding: 8 }}>{item.scoreLabel}</td>
                  <td style={{ padding: 8, fontWeight: 700 }}>{item.punten}</td>
                  <td style={{ padding: 8 }}>
                    <button onClick={() => handleEdit(item)} style={{ color: "#296fe6", border: "none", background: "none", fontWeight: 700, marginRight: 6, cursor: "pointer" }}>Bewerken</button>
                    <button onClick={() => handleDelete(item.id)} style={{ color: "#b23e3e", border: "none", background: "none", fontWeight: 700, cursor: "pointer" }}>Verwijderen</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

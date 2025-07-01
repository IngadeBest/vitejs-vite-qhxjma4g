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

  useEffect(() => {
    fetchRuiters();
    fetchProeven();
  }, []);

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

  function getProefOpties() {
    return proeven.filter(
      (p) =>
        p.klasse === selectedKlasse &&
        p.onderdeel === selectedOnderdeel
    );
  }

  function getMaxScore() {
    if (selectedProef) {
      return selectedProef.max_score || "";
    }
    return "";
  }

  function getRuitersVoorKlasse() {
    return ruiters.filter((r) => r.klasse === selectedKlasse);
  }

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
    };
    if (editingId) {
      await supabase.from("scores").update(insertObj).eq("id", editingId);
    } else {
      await supabase.from("scores").insert([insertObj]);
    }
    resetForm();
    fetchScores();
  }

  function handleEdit(score) {
    setEditingId(score.id);
    setSelectedRuiter(score.ruiter_id);
    setScoreInput(score.score || "");
    setDQ(!!score.dq);
    setError("");
  }

  async function handleDelete(id) {
    await supabase.from("scores").delete().eq("id", id);
    fetchScores();
  }

  // === Correcte WEH-puntentelling voor tussenstand ===
  function berekenTussenstand() {
    if (!scores.length) return [];

    // Maak een copy van de score-objecten + naam/paard
    let scoreList = scores.map(s => ({
      ...s,
      naam: ruiters.find(r => r.id === s.ruiter_id)?.naam || "Onbekend",
      paard: ruiters.find(r => r.id === s.ruiter_id)?.paard || "Onbekend",
    }));

    let zonderDQ = scoreList.filter(s => !s.dq);
    let metDQ = scoreList.filter(s => s.dq);

    zonderDQ.sort((a, b) => b.score - a.score);

    const aantalDeelnemers = zonderDQ.length + metDQ.length;

    let tussenstand = [];
    let i = 0;
    while (i < zonderDQ.length) {
      // Ex aequo groep
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
          ? aantalDeelnemers + 1
          : aantalDeelnemers - (index - 2);
        puntenVoorPlaats.push(punten);
      }
      const punten = Math.min(...puntenVoorPlaats);

      exaequoGroep.forEach(s => {
        tussenstand.push({
          ...s,
          plaats,
          punten,
          scoreLabel: selectedProef && selectedProef.max_score
            ? `${s.score} (${Math.round((s.score / selectedProef.max_score) * 1000) / 10}%)`
            : s.score,
        });
      });
      i += exaequoGroep.length;
    }
    // DQ's onderaan
    metDQ.forEach((s, idx) => {
      tussenstand.push({
        ...s,
        plaats: zonderDQ.length + idx + 1,
        punten: 0,
        scoreLabel: "DQ",
      });
    });

    // Eerst niet-DQ, dan DQ's
    return [
      ...tussenstand.filter(k => !k.dq),
      ...tussenstand.filter(k => k.dq),
    ];
  }

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
            {berekenTussenstand().length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: 16, color: "#777" }}>
                  Nog geen scores ingevoerd voor deze proef/klasse.
                </td>
              </tr>
            ) : (
              berekenTussenstand().map(item => (
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

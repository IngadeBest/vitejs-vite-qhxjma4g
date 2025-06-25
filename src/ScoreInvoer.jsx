import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";

const kleuren = {
  hoofd: "#204574",
  accent: "#3a8bfd",
  achtergrond: "#f5f7fb",
  wit: "#fff",
};

export default function ScoreInvoer() {
  const [proeven, setProeven] = useState([]);
  const [ruiters, setRuiters] = useState([]);
  const [scores, setScores] = useState({});
  const [selectedProef, setSelectedProef] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Haal proeven op uit Supabase
  useEffect(() => {
    async function fetchProeven() {
      setLoading(true);
      const { data } = await supabase.from("proeven").select("*").order("datum", { ascending: true });
      setProeven(data || []);
      setLoading(false);
    }
    fetchProeven();
  }, []);

  // Haal ruiters op zodra proef is gekozen
  useEffect(() => {
    if (!selectedProef) return;
    async function fetchRuiters() {
      setLoading(true);
      const { data } = await supabase
        .from("ruiters")
        .select("*")
        .eq("klasse", selectedProef.klasse)
        .order("id", { ascending: true });
      setRuiters(data || []);
      // Haal bestaande scores voor deze proef op
      const { data: bestaandeScores } = await supabase
        .from("scores")
        .select("*")
        .eq("proef_id", selectedProef.id);
      // Zet bestaande scores in state
      const scoresObj = {};
      bestaandeScores?.forEach((sc) => {
        scoresObj[sc.ruiter_id] = sc;
      });
      setScores(scoresObj);
      setLoading(false);
    }
    fetchRuiters();
  }, [selectedProef]);

  // Handle invoer per ruiter
  function handleScoreChange(ruiter_id, field, value) {
    setScores((prev) => ({
      ...prev,
      [ruiter_id]: {
        ...prev[ruiter_id],
        [field]: value,
        dq: field === "dq" ? value : prev[ruiter_id]?.dq || false,
      },
    }));
  }

  // Opslaan alle scores in Supabase
  async function handleSave() {
    if (!selectedProef) return;
    setSaving(true);
    let ok = true;
    for (const ruiter of ruiters) {
      const sc = scores[ruiter.id];
      // Bestaande score updaten OF nieuwe toevoegen
      if (sc?.id) {
        // Update
        const { error } = await supabase
          .from("scores")
          .update({
            score: sc.score !== undefined ? sc.score : null,
            tijd: sc.tijd !== undefined ? sc.tijd : null,
            dq: sc.dq || false,
          })
          .eq("id", sc.id);
        if (error) ok = false;
      } else if (sc && (sc.score || sc.tijd || sc.dq)) {
        // Insert
        const { error } = await supabase.from("scores").insert([
          {
            proef_id: selectedProef.id,
            ruiter_id: ruiter.id,
            score: sc.score !== undefined ? sc.score : null,
            tijd: sc.tijd !== undefined ? sc.tijd : null,
            dq: sc.dq || false,
          },
        ]);
        if (error) ok = false;
      }
    }
    setSaving(false);
    if (ok) setError(""); else setError("Niet alles kon opgeslagen worden.");
  }

  // Helper om te checken of het speedtrail is
  function isSpeedtrail() {
    if (!selectedProef) return false;
    return selectedProef.naam?.toLowerCase().includes("speed");
  }

  return (
    <div style={{
      background: kleuren.achtergrond,
      minHeight: "100vh",
      fontFamily: "system-ui, sans-serif",
      paddingTop: 24,
    }}>
      <div style={{
        maxWidth: 650,
        background: "#fff",
        borderRadius: 15,
        boxShadow: "0 4px 24px #2c466622",
        margin: "0 auto",
        padding: "36px 28px 28px 28px",
      }}>
        <h2 style={{ fontSize: 29, color: kleuren.hoofd, fontWeight: 900, marginBottom: 25, letterSpacing: 1.3, textTransform: "uppercase" }}>
          Score-invoer
        </h2>
        <div style={{ marginBottom: 18, display: "flex", gap: 24, flexWrap: "wrap" }}>
          <label style={{ fontWeight: 600, color: kleuren.hoofd }}>
            Kies proef:{" "}
            <select
              value={selectedProef?.id || ""}
              onChange={e => {
                const proef = proeven.find((p) => p.id === Number(e.target.value));
                setSelectedProef(proef || null);
                setScores({});
              }}
              style={{
                fontSize: 17,
                padding: "5px 16px",
                borderRadius: 8,
                border: "1px solid #b3c1d1",
                background: "#fafdff",
              }}
            >
              <option value="">-- Kies een proef --</option>
              {proeven.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.naam} ({p.klasse}) {p.datum ? `- ${p.datum}` : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
        {/* Score invoer tabel */}
        {selectedProef && (
          <table style={{
            width: "100%",
            borderCollapse: "separate",
            borderSpacing: "0 7px",
            background: "#fafdff",
            borderRadius: 9,
            overflow: "hidden",
            marginBottom: 30,
          }}>
            <thead>
              <tr style={{ background: kleuren.accent, color: "#fff" }}>
                <th style={{ borderRadius: "9px 0 0 0", padding: 9, fontSize: 16 }}>Ruiter</th>
                <th style={{ padding: 9, fontSize: 16 }}>Paard</th>
                {isSpeedtrail() ? (
                  <th style={{ padding: 9, fontSize: 16 }}>Tijd (seconden)</th>
                ) : (
                  <th style={{ padding: 9, fontSize: 16 }}>Score</th>
                )}
                <th style={{ borderRadius: "0 9px 0 0", padding: 9, fontSize: 16 }}>DQ</th>
              </tr>
            </thead>
            <tbody>
              {ruiters.map((e) => {
                const sc = scores[e.id] || {};
                return (
                  <tr key={e.id} style={sc.dq ? { background: "#ffe2e2" } : {}}>
                    <td style={{ padding: 8, fontWeight: 500 }}>{e.naam}</td>
                    <td style={{ padding: 8 }}>{e.paard}</td>
                    <td style={{ padding: 8 }}>
                      {isSpeedtrail() ? (
                        <input
                          type="number"
                          value={sc.tijd || ""}
                          min="0"
                          onChange={ev =>
                            handleScoreChange(e.id, "tijd", ev.target.value)
                          }
                          disabled={!!sc.dq}
                          style={{
                            fontSize: 16,
                            width: 80,
                            padding: "6px 10px",
                            borderRadius: 8,
                            border: "1px solid #b3c1d1",
                            background: sc.dq ? "#eee" : "#fff",
                          }}
                        />
                      ) : (
                        <input
                          type="number"
                          value={sc.score || ""}
                          min="0"
                          max={selectedProef.max_score}
                          onChange={ev =>
                            handleScoreChange(e.id, "score", ev.target.value)
                          }
                          disabled={!!sc.dq}
                          style={{
                            fontSize: 16,
                            width: 80,
                            padding: "6px 10px",
                            borderRadius: 8,
                            border: "1px solid #b3c1d1",
                            background: sc.dq ? "#eee" : "#fff",
                          }}
                        />
                      )}
                    </td>
                    <td style={{ padding: 8, textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={!!sc.dq}
                        onChange={ev =>
                          handleScoreChange(e.id, "dq", ev.target.checked)
                        }
                        style={{ width: 22, height: 22 }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {selectedProef && (
          <div style={{ marginTop: 18 }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                background: kleuren.accent,
                color: "#fff",
                border: "none",
                padding: "13px 32px",
                fontSize: 17,
                borderRadius: 8,
                cursor: saving ? "not-allowed" : "pointer",
                fontWeight: "bold",
                boxShadow: "0 1px 7px #3a8bfd33",
                marginRight: 10,
                letterSpacing: 1,
              }}
            >
              💾 Opslaan scores
            </button>
            {error && <span style={{ color: "red", marginLeft: 18 }}>{error}</span>}
            {saving && <span style={{ color: "gray", marginLeft: 18 }}>Bezig met opslaan...</span>}
          </div>
        )}
        {loading && (
          <div style={{ textAlign: "center", marginTop: 20, color: "#666" }}>
            Even geduld...
          </div>
        )}
      </div>
    </div>
  );
}

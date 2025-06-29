import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";

export default function ScoreInvoer() {
  const [ruiters, setRuiters] = useState([]);
  const [proeven, setProeven] = useState([]);
  const [scores, setScores] = useState([]);
  const [form, setForm] = useState({
    ruiter_id: "",
    klasse: "",
    onderdeel: "",
    proef_id: "",
    score: "",
    dq: false,
    tijd: "",
  });
  const [editingScoreId, setEditingScoreId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const { data: ruiterData } = await supabase.from("ruiters").select("*");
    setRuiters(ruiterData || []);
    const { data: scoreData } = await supabase.from("scores").select("*");
    setScores(scoreData || []);
    const { data: proevenData } = await supabase.from("proeven").select("*");
    setProeven(proevenData || []);
  }

  const klassenBeschikbaar = [...new Set(proeven.map((p) => p.klasse))];
  const onderdelenBeschikbaar =
    form.klasse && form.klasse.length > 0
      ? [
          ...new Set(
            proeven.filter((p) => p.klasse === form.klasse).map((p) => p.onderdeel)
          ),
        ]
      : [];
  const proevenOpties =
    form.klasse && form.onderdeel
      ? proeven.filter(
          (p) => p.klasse === form.klasse && p.onderdeel === form.onderdeel
        )
      : [];

  const deelnemers = ruiters.filter((r) => r.klasse === form.klasse);
  const gekozenProef = proeven.find((p) => p.id === Number(form.proef_id));
  const max_score =
    gekozenProef && gekozenProef.onderdeel !== "speedtrail"
      ? gekozenProef.max_score
      : "";

  const scoresPerProef = scores.filter(
    (s) => s.proef_id === Number(form.proef_id)
  );

  async function handleAddOrUpdateScore() {
    setError("");
    if (
      !form.ruiter_id ||
      !form.klasse ||
      !form.onderdeel ||
      !form.proef_id
    ) {
      setError("Selecteer eerst klasse, onderdeel, proef en ruiter.");
      return;
    }
    if (
      gekozenProef.onderdeel !== "speedtrail" &&
      !max_score
    ) {
      setError("Maximaal score ontbreekt.");
      return;
    }
    if (
      gekozenProef.onderdeel === "speedtrail"
        ? !form.tijd && !form.dq
        : !form.score && !form.dq
    ) {
      setError(
        gekozenProef.onderdeel === "speedtrail"
          ? "Vul een tijd in of vink DQ aan."
          : "Vul een score in of vink DQ aan."
      );
      return;
    }

    if (editingScoreId) {
      // UPDATE
      await supabase.from("scores")
        .update({
          ruiter_id: form.ruiter_id,
          klasse: form.klasse,
          onderdeel: form.onderdeel,
          proef_id: Number(form.proef_id),
          score: gekozenProef.onderdeel === "speedtrail" ? null : Number(form.score),
          tijd: gekozenProef.onderdeel === "speedtrail" ? Number(form.tijd) : null,
          max_score: gekozenProef.onderdeel === "speedtrail" ? null : Number(max_score),
          dq: form.dq,
        })
        .eq("id", editingScoreId);
      setEditingScoreId(null);
    } else {
      // INSERT
      await supabase.from("scores").insert([
        {
          ruiter_id: form.ruiter_id,
          klasse: form.klasse,
          onderdeel: form.onderdeel,
          proef_id: Number(form.proef_id),
          score: gekozenProef.onderdeel === "speedtrail" ? null : Number(form.score),
          tijd: gekozenProef.onderdeel === "speedtrail" ? Number(form.tijd) : null,
          max_score: gekozenProef.onderdeel === "speedtrail" ? null : Number(max_score),
          dq: form.dq,
        },
      ]);
    }

    // Reset alleen score/tijd/dq, NIET klasse/onderdeel/proef!
    setForm((prev) => ({
      ...prev,
      ruiter_id: "",
      score: "",
      tijd: "",
      dq: false,
    }));
    fetchData();
  }

  function handleEditScore(score) {
    setEditingScoreId(score.id);
    setForm((prev) => ({
      ...prev,
      ruiter_id: score.ruiter_id,
      score: score.score || "",
      tijd: score.tijd || "",
      dq: !!score.dq,
    }));
  }

  async function handleDeleteScore(id) {
    await supabase.from("scores").delete().eq("id", id);
    fetchData();
    if (editingScoreId === id) setEditingScoreId(null);
  }

  function berekenKlassement() {
    if (scoresPerProef.length === 0) return [];
    const scoresWithName = scoresPerProef.map((s) => ({
      ...s,
      naam: ruiters.find((r) => r.id === s.ruiter_id)?.naam || "Onbekend",
      paard: ruiters.find((r) => r.id === s.ruiter_id)?.paard || "Onbekend",
    }));

    // Bereken totaal aantal gestart (incl DQ voor punten!)
    const totaalGestart = scoresWithName.length;

    let deelnemersZonderDQ = scoresWithName.filter((s) => !s.dq);
    let deelnemersMetDQ = scoresWithName.filter((s) => s.dq);

    // Sorteren voor score/tijd
    if (gekozenProef && gekozenProef.onderdeel === "speedtrail") {
      deelnemersZonderDQ = deelnemersZonderDQ.sort((a, b) => a.tijd - b.tijd);
    } else {
      deelnemersZonderDQ = deelnemersZonderDQ
        .map((s) => ({
          ...s,
          percentage:
            s.max_score && s.score
              ? Math.round((s.score / s.max_score) * 1000) / 10
              : 0,
        }))
        .sort((a, b) => b.percentage - a.percentage);
    }

    // Correcte ex-aequo/plaatsen & punten
    let plek = 1;
    let exaequoCount = 0;
    let vorigeWaarde = null;
    let resultaat = [];

    for (let i = 0; i < deelnemersZonderDQ.length; i++) {
      const s = deelnemersZonderDQ[i];
      let waarde =
        gekozenProef && gekozenProef.onderdeel === "speedtrail"
          ? s.tijd
          : s.percentage;

      if (i > 0 && waarde === vorigeWaarde) {
        exaequoCount++;
      } else {
        plek = plek + exaequoCount;
        exaequoCount = 0;
      }
      vorigeWaarde = waarde;

      let punten = totaalGestart + 1 - plek;

      resultaat.push({
        ...s,
        plaats: plek,
        punten,
        scoreLabel:
          gekozenProef && gekozenProef.onderdeel === "speedtrail"
            ? `${s.tijd}s`
            : `${s.score} (${s.percentage}%)`,
      });
    }

    deelnemersMetDQ.forEach((s) => {
      resultaat.push({
        ...s,
        plaats: "DQ",
        punten: 0,
        scoreLabel:
          gekozenProef && gekozenProef.onderdeel === "speedtrail"
            ? s.dq
              ? "DQ"
              : `${s.tijd}s`
            : s.dq
              ? "DQ"
              : `${s.score} (${s.percentage}%)`,
      });
    });

    return [
      ...resultaat.filter((k) => k.plaats !== "DQ"),
      ...resultaat.filter((k) => k.plaats === "DQ"),
    ];
  }

  const klassement = berekenKlassement();

  return (
    <div
      style={{
        background: "#f5f7fb",
        minHeight: "100vh",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 800,
          background: "#fff",
          borderRadius: 15,
          boxShadow: "0 4px 24px #2c466622",
          margin: "0 auto",
          padding: "36px 28px 28px 28px",
        }}
      >
        <h2
          style={{
            fontSize: 29,
            color: "#204574",
            fontWeight: 900,
            marginBottom: 20,
            letterSpacing: 1.3,
            textTransform: "uppercase",
          }}
        >
          Score-invoer
        </h2>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 16,
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <label>
            Klasse:
            <select
              value={form.klasse}
              onChange={(e) => setForm({
                ...form,
                klasse: e.target.value,
                onderdeel: "",
                proef_id: "",
                ruiter_id: "",
              })}
              style={{ marginLeft: 8, padding: 8, fontSize: 16 }}
            >
              <option value="">---</option>
              {klassenBeschikbaar.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </label>
          <label>
            Onderdeel:
            <select
              value={form.onderdeel}
              onChange={(e) => setForm({
                ...form,
                onderdeel: e.target.value,
                proef_id: "",
                ruiter_id: "",
              })}
              style={{ marginLeft: 8, padding: 8, fontSize: 16 }}
              disabled={!form.klasse}
            >
              <option value="">---</option>
              {onderdelenBeschikbaar.map((o) => (
                <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>
              ))}
            </select>
          </label>
          <label>
            Proef:
            <select
              value={form.proef_id}
              onChange={(e) => setForm({
                ...form,
                proef_id: e.target.value,
                ruiter_id: "",
              })}
              style={{ marginLeft: 8, padding: 8, fontSize: 16 }}
              disabled={!form.klasse || !form.onderdeel}
            >
              <option value="">---</option>
              {proevenOpties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.naam} ({p.datum})
                </option>
              ))}
            </select>
          </label>
          <label>
            Ruiter:
            <select
              value={form.ruiter_id}
              onChange={(e) => setForm({ ...form, ruiter_id: e.target.value })}
              style={{ marginLeft: 8, padding: 8, fontSize: 16 }}
              disabled={!form.proef_id}
            >
              <option value="">---</option>
              {deelnemers.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.naam} met {r.paard}
                </option>
              ))}
            </select>
          </label>
          {/* Score/tijd */}
          {gekozenProef && gekozenProef.onderdeel === "speedtrail" ? (
            <label>
              Tijd (seconden):
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.tijd}
                onChange={(e) => setForm({ ...form, tijd: e.target.value })}
                style={{ marginLeft: 8, padding: 8, fontSize: 16, width: 90 }}
                disabled={form.dq}
              />
            </label>
          ) : (
            <label>
              Score:
              <input
                type="number"
                min={0}
                value={form.score}
                onChange={(e) => setForm({ ...form, score: e.target.value })}
                style={{ marginLeft: 8, padding: 8, fontSize: 16, width: 90 }}
                disabled={form.dq}
              />
              <span style={{ marginLeft: 6, color: "#888", fontWeight: 500 }}>
                {max_score ? `/ ${max_score}` : ""}
              </span>
            </label>
          )}
          <label>
            DQ:
            <input
              type="checkbox"
              checked={form.dq}
              onChange={(e) => setForm({
                ...form,
                dq: e.target.checked,
                score: "",
                tijd: "",
              })}
              style={{ marginLeft: 8, width: 20, height: 20 }}
            />
          </label>
          <button
            onClick={handleAddOrUpdateScore}
            style={{
              background: "#3a8bfd",
              color: "#fff",
              border: "none",
              padding: "13px 32px",
              fontSize: 17,
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: "bold",
              boxShadow: "0 1px 7px #3a8bfd33",
              marginLeft: 8,
              letterSpacing: 1,
              minWidth: 110,
            }}
          >
            {editingScoreId ? "Bijwerken" : "Opslaan"}
          </button>
          {editingScoreId && (
            <button
              onClick={() => {
                setEditingScoreId(null);
                setForm((prev) => ({
                  ...prev,
                  ruiter_id: "",
                  score: "",
                  tijd: "",
                  dq: false,
                }));
              }}
              style={{
                marginLeft: 8,
                padding: "13px 24px",
                background: "#eee",
                color: "#1a2b44",
                border: "none",
                fontSize: 16,
                borderRadius: 8,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Annuleren
            </button>
          )}
        </div>
        {error && <div style={{ color: "red", marginBottom: 12 }}>{error}</div>}
        <h3
          style={{
            marginTop: 28,
            marginBottom: 10,
            color: "#3a8bfd",
            textTransform: "uppercase",
            fontWeight: 700,
            fontSize: 20,
            letterSpacing: 1,
          }}
        >
          Tussenstand
          {form.klasse && form.onderdeel && (
            <> {form.klasse} – {form.onderdeel.charAt(0).toUpperCase() + form.onderdeel.slice(1)}</>
          )}
        </h3>
        <table
          style={{
            width: "100%",
            borderCollapse: "separate",
            borderSpacing: "0 5px",
            background: "#fafdff",
            borderRadius: 8,
            overflow: "hidden",
            marginBottom: 10,
          }}
        >
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
            {klassement.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: 15, color: "#666" }}>
                  Nog geen scores ingevoerd voor deze proef/klasse.
                </td>
              </tr>
            )}
            {klassement.map((item) => (
              <tr
                key={item.id}
                style={
                  item.plaats === "DQ"
                    ? { color: "#a87c7c", background: "#fff2f2" }
                    : {}
                }
              >
                <td style={{ padding: 8, fontWeight: 700 }}>
                  {item.plaats}
                </td>
                <td style={{ padding: 8 }}>{item.naam}</td>
                <td style={{ padding: 8 }}>{item.paard}</td>
                <td style={{ padding: 8 }}>{item.scoreLabel}</td>
                <td style={{ padding: 8, fontWeight: 700 }}>{item.punten}</td>
                <td style={{ padding: 8 }}>
                  <button
                    onClick={() => handleEditScore(item)}
                    style={{ color: "#3a8bfd", background: "none", border: "none", fontWeight: 600, cursor: "pointer" }}
                  >
                    Bewerken
                  </button>
                  <button
                    onClick={() => handleDeleteScore(item.id)}
                    style={{ color: "#b23e3e", background: "none", border: "none", fontWeight: 600, cursor: "pointer", marginLeft: 8 }}
                  >
                    Verwijderen
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

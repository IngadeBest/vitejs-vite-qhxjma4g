import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";

const KLASSEN = ["WE Intro", "WE1", "WE2", "WE3", "WE4"];
const ONDERDELEN = ["dressuur", "stijltrail", "speedtrail"];

export default function ScoreInvoer() {
  const [ruiters, setRuiters] = useState([]);
  const [scores, setScores] = useState([]);
  const [form, setForm] = useState({
    ruiter_id: "",
    onderdeel: ONDERDELEN[0],
    klasse: KLASSEN[0],
    score: "",
    max_punten: "",
    dq: false,
    tijd: "",
  });
  const [error, setError] = useState("");

  // Ophalen van ruiters en scores uit Supabase
  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const { data: ruiterData } = await supabase.from("ruiters").select("*");
    setRuiters(ruiterData || []);
    const { data: scoreData } = await supabase.from("scores").select("*");
    setScores(scoreData || []);
  }

  // Score toevoegen
  async function handleAddScore() {
    if (!form.ruiter_id || !form.onderdeel || !form.klasse) {
      setError("Selecteer een ruiter, onderdeel en klasse.");
      return;
    }
    if (form.onderdeel !== "speedtrail" && !form.max_punten) {
      setError("Vul het maximaal aantal punten in.");
      return;
    }
    if (
      form.onderdeel === "speedtrail"
        ? !form.tijd && !form.dq
        : !form.score && !form.dq
    ) {
      setError(
        form.onderdeel === "speedtrail"
          ? "Vul een tijd in of vink DQ aan."
          : "Vul een score in of vink DQ aan."
      );
      return;
    }
    setError("");
    // Data opslaan in Supabase
    await supabase.from("scores").insert([
      {
        ruiter_id: form.ruiter_id,
        onderdeel: form.onderdeel,
        klasse: form.klasse,
        score: form.onderdeel === "speedtrail" ? null : Number(form.score),
        tijd: form.onderdeel === "speedtrail" ? Number(form.tijd) : null,
        max_punten: form.onderdeel === "speedtrail" ? null : Number(form.max_punten),
        dq: form.dq,
      },
    ]);
    setForm({
      ruiter_id: "",
      onderdeel: ONDERDELEN[0],
      klasse: KLASSEN[0],
      score: "",
      max_punten: "",
      dq: false,
      tijd: "",
    });
    fetchData();
  }

  // Bepaal deelnemers voor geselecteerde klasse
  const deelnemers = ruiters.filter((r) => r.klasse === form.klasse);

  // Bepaal scores voor geselecteerde onderdeel + klasse
  const scoresPerProef = scores.filter(
    (s) => s.onderdeel === form.onderdeel && s.klasse === form.klasse
  );

  // Logica: bereken klassement, met ex aequo en DQ
  function berekenKlassement() {
    if (scoresPerProef.length === 0) return [];

    // Voeg ruiter-naam toe aan elke score
    const scoresWithName = scoresPerProef.map((s) => ({
      ...s,
      naam:
        ruiters.find((r) => r.id === s.ruiter_id)?.naam || "Onbekend",
      paard:
        ruiters.find((r) => r.id === s.ruiter_id)?.paard || "Onbekend",
    }));

    // Filter DQ en niet-DQ
    let deelnemersZonderDQ = scoresWithName.filter((s) => !s.dq);
    let deelnemersMetDQ = scoresWithName.filter((s) => s.dq);

    // Score voor ranking: percentage of tijd
    if (form.onderdeel === "speedtrail") {
      // Snelste tijd wint!
      deelnemersZonderDQ = deelnemersZonderDQ.sort(
        (a, b) => a.tijd - b.tijd
      );
    } else {
      // Hoogste % wint!
      deelnemersZonderDQ = deelnemersZonderDQ
        .map((s) => ({
          ...s,
          percentage:
            s.max_punten && s.score
              ? Math.round((s.score / s.max_punten) * 1000) / 10
              : 0,
        }))
        .sort((a, b) => b.percentage - a.percentage);
    }

    // Ex aequo: Bereken plaatsen
    let klassement = [];
    let plek = 1;
    let vorigeWaarde = null;
    let exaequoCount = 0;
    deelnemersZonderDQ.forEach((s, idx) => {
      // Ex-aequo bij gelijke score (tijd of percentage)
      let isEqual = false;
      if (form.onderdeel === "speedtrail") {
        isEqual = s.tijd === vorigeWaarde;
        vorigeWaarde = s.tijd;
      } else {
        isEqual = s.percentage === vorigeWaarde;
        vorigeWaarde = s.percentage;
      }
      if (isEqual) {
        exaequoCount++;
      } else {
        plek = plek + exaequoCount;
        exaequoCount = 0;
      }
      // Punten: aantal deelnemers zonder DQ + 1 - plek
      let punten = deelnemersZonderDQ.length + 1 - plek;
      klassement.push({
        ...s,
        plaats: plek,
        punten,
        scoreLabel:
          form.onderdeel === "speedtrail"
            ? `${s.tijd}s`
            : `${s.score} (${s.percentage}%)`,
      });
    });

    // Voeg DQ-deelnemers toe: onderaan, 0 punten, plaats geen nummer
    deelnemersMetDQ.forEach((s) => {
      klassement.push({
        ...s,
        plaats: "DQ",
        punten: 0,
        scoreLabel:
          form.onderdeel === "speedtrail"
            ? s.dq
              ? "DQ"
              : `${s.tijd}s`
            : s.dq
              ? "DQ"
              : `${s.score} (${s.percentage}%)`,
      });
    });

    // Sorteer nogmaals: eerst alle niet-DQ op plek, daarna DQ
    return [
      ...klassement.filter((k) => k.plaats !== "DQ"),
      ...klassement.filter((k) => k.plaats === "DQ"),
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
          maxWidth: 750,
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
        {/* Formulier */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 18,
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <label>
            Onderdeel:{" "}
            <select
              value={form.onderdeel}
              onChange={(e) =>
                setForm({
                  ...form,
                  onderdeel: e.target.value,
                  // reset relevante velden
                  score: "",
                  tijd: "",
                  dq: false,
                })
              }
              style={{
                fontSize: 17,
                padding: "5px 16px",
                borderRadius: 8,
                border: "1px solid #b3c1d1",
                background: "#fafdff",
                textTransform: "capitalize",
              }}
            >
              {ONDERDELEN.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
          <label>
            Klasse:{" "}
            <select
              value={form.klasse}
              onChange={(e) =>
                setForm({ ...form, klasse: e.target.value, ruiter_id: "" })
              }
              style={{
                fontSize: 17,
                padding: "5px 16px",
                borderRadius: 8,
                border: "1px solid #b3c1d1",
                background: "#fafdff",
              }}
            >
              {KLASSEN.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </label>
          <label>
            Ruiter:{" "}
            <select
              value={form.ruiter_id}
              onChange={(e) => setForm({ ...form, ruiter_id: e.target.value })}
              style={{
                fontSize: 17,
                padding: "5px 16px",
                borderRadius: 8,
                border: "1px solid #b3c1d1",
                background: "#fafdff",
              }}
            >
              <option value="">Selecteer ruiter</option>
              {deelnemers.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.naam} met {r.paard}
                </option>
              ))}
            </select>
          </label>
          {/* Alleen tonen indien GEEN speedtrail */}
          {form.onderdeel !== "speedtrail" && (
            <label>
              Max. punten:{" "}
              <input
                type="number"
                value={form.max_punten}
                min={1}
                onChange={(e) =>
                  setForm({ ...form, max_punten: e.target.value })
                }
                style={{
                  fontSize: 17,
                  padding: "5px 10px",
                  borderRadius: 8,
                  border: "1px solid #b3c1d1",
                  width: 80,
                }}
                required={form.onderdeel !== "speedtrail"}
              />
            </label>
          )}
          {/* Score/tijd invoer */}
          {form.onderdeel === "speedtrail" ? (
            <label>
              Tijd (seconden):{" "}
              <input
                type="number"
                value={form.tijd}
                min={0}
                step={0.01}
                onChange={(e) =>
                  setForm({ ...form, tijd: e.target.value, dq: false })
                }
                disabled={form.dq}
                style={{
                  fontSize: 17,
                  padding: "5px 10px",
                  borderRadius: 8,
                  border: "1px solid #b3c1d1",
                  width: 90,
                  background: form.dq ? "#eee" : "#fff",
                }}
              />
            </label>
          ) : (
            <label>
              Score:{" "}
              <input
                type="number"
                value={form.score}
                min={0}
                onChange={(e) =>
                  setForm({ ...form, score: e.target.value, dq: false })
                }
                disabled={form.dq}
                style={{
                  fontSize: 17,
                  padding: "5px 10px",
                  borderRadius: 8,
                  border: "1px solid #b3c1d1",
                  width: 80,
                  background: form.dq ? "#eee" : "#fff",
                }}
              />
            </label>
          )}
          <label>
            DQ:{" "}
            <input
              type="checkbox"
              checked={form.dq}
              onChange={(e) =>
                setForm({
                  ...form,
                  dq: e.target.checked,
                  score: "",
                  tijd: "",
                })
              }
              style={{ width: 22, height: 22 }}
            />
          </label>
          <button
            onClick={handleAddScore}
            style={{
              background: "#3a8bfd",
              color: "#fff",
              border: "none",
              padding: "12px 26px",
              fontSize: 17,
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: "bold",
              boxShadow: "0 1px 7px #3a8bfd33",
              marginLeft: 12,
              letterSpacing: 1,
            }}
          >
            Opslaan
          </button>
        </div>
        {error && <div style={{ color: "red", marginBottom: 16 }}>{error}</div>}

        {/* Klassement-tabel */}
        <h3
          style={{
            marginTop: 12,
            marginBottom: 8,
            color: "#3a8bfd",
            textTransform: "uppercase",
            fontWeight: 700,
            fontSize: 20,
            letterSpacing: 1,
          }}
        >
          Tussenstand {form.klasse} – {form.onderdeel}
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
              <th style={{ padding: 8 }}>
                {form.onderdeel === "speedtrail" ? "Tijd (s)" : "Score"}
              </th>
              <th style={{ padding: 8 }}>Punten</th>
            </tr>
          </thead>
          <tbody>
            {klassement.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: 14 }}>
                  Nog geen scores ingevoerd voor deze proef/klasse.
                </td>
              </tr>
            ) : (
              klassement.map((item, i) => (
                <tr
                  key={item.ruiter_id}
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
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

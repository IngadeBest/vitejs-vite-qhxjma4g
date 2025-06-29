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
  const [error, setError] = useState("");

  // Ophalen van ruiters, proeven en scores uit Supabase
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

  // Filter unieke klassen uit proeven
  const klassenBeschikbaar = [...new Set(proeven.map((p) => p.klasse))];
  // Filter onderdelen per klasse
  const onderdelenBeschikbaar =
    form.klasse && form.klasse.length > 0
      ? [
          ...new Set(
            proeven.filter((p) => p.klasse === form.klasse).map((p) => p.onderdeel)
          ),
        ]
      : [];
  // Filter proeven per klasse & onderdeel
  const proevenOpties =
    form.klasse && form.onderdeel
      ? proeven.filter(
          (p) => p.klasse === form.klasse && p.onderdeel === form.onderdeel
        )
      : [];

  // Bepaal deelnemers voor geselecteerde klasse
  const deelnemers = ruiters.filter((r) => r.klasse === form.klasse);

  // Bepaal de gekozen proef (volledige proef-object)
  const gekozenProef = proeven.find((p) => p.id === Number(form.proef_id));
  // Bepaal max_punten (speedtrail = leeg)
  const max_punten =
    gekozenProef && gekozenProef.onderdeel !== "speedtrail"
      ? gekozenProef.max_punten
      : "";

  // Bepaal scores voor geselecteerde proef
  const scoresPerProef = scores.filter(
    (s) => s.proef_id === Number(form.proef_id)
  );

  // Score toevoegen
  async function handleAddScore() {
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
      !max_punten
    ) {
      setError("Maximaal punten ontbreekt.");
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
    setError("");
    // Data opslaan in Supabase
    await supabase.from("scores").insert([
      {
        ruiter_id: form.ruiter_id,
        klasse: form.klasse,
        onderdeel: form.onderdeel,
        proef_id: Number(form.proef_id),
        score: gekozenProef.onderdeel === "speedtrail" ? null : Number(form.score),
        tijd: gekozenProef.onderdeel === "speedtrail" ? Number(form.tijd) : null,
        max_punten: gekozenProef.onderdeel === "speedtrail" ? null : Number(max_punten),
        dq: form.dq,
      },
    ]);
    setForm({
      ruiter_id: "",
      klasse: "",
      onderdeel: "",
      proef_id: "",
      score: "",
      dq: false,
      tijd: "",
    });
    fetchData();
  }

  // Logica: bereken klassement, met ex aequo en DQ
  function berekenKlassement() {
    if (scoresPerProef.length === 0) return [];

    // Voeg ruiter-naam toe aan elke score
    const scoresWithName = scoresPerProef.map((s) => ({
      ...s,
      naam: ruiters.find((r) => r.id === s.ruiter_id)?.naam || "Onbekend",
      paard: ruiters.find((r) => r.id === s.ruiter_id)?.paard || "Onbekend",
    }));

    let deelnemersZonderDQ = scoresWithName.filter((s) => !s.dq);
    let deelnemersMetDQ = scoresWithName.filter((s) => s.dq);

    // Score voor ranking: percentage of tijd
    if (gekozenProef && gekozenProef.onderdeel === "speedtrail") {
      // Snelste tijd wint!
      deelnemersZonderDQ = deelnemersZonderDQ.sort((a, b) => a.tijd - b.tijd);
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
      let isEqual = false;
      if (gekozenProef && gekozenProef.onderdeel === "speedtrail") {
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
          gekozenProef && gekozenProef.onderdeel === "speedtrail"
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
          {/* 1. Klasse */}
          <label>
            Klasse:{" "}
            <select
              value={form.klasse}
              onChange={(e) =>
                setForm({
                  ...form,
                  klasse: e.target.value,
                  onderdeel: "",
                  proef_id: "",
                  ruiter_id: "",
                  score: "",
                  dq: false,
                  tijd: "",
                })
              }
              style={{
                fontSize: 17,
                padding: "5px 16px",
                borderRadius: 8,
                border: "1px solid #b3c1d1",
                background: "#fafdff",
              }}
            >
              <option value="">Selecteer klasse</option>
              {klassenBeschikbaar.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </label>
          {/* 2. Onderdeel */}
          <label>
            Onderdeel:{" "}
            <select
              value={form.onderdeel}
              onChange={(e) =>
                setForm({
                  ...form,
                  onderdeel: e.target.value,
                  proef_id: "",
                  ruiter_id: "",
                  score: "",
                  dq: false,
                  tijd: "",
                })
              }
              disabled={!form.klasse}
              style={{
                fontSize: 17,
                padding: "5px 16px",
                borderRadius: 8,
                border: "1px solid #b3c1d1",
                background: "#fafdff",
                textTransform: "capitalize",
              }}
            >
              <option value="">Selecteer onderdeel</option>
              {onderdelenBeschikbaar.map((o) => (
                <option key={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>
              ))}
            </select>
          </label>
          {/* 3. Proef */}
          <label>
            Proef:{" "}
            <select
              value={form.proef_id}
              onChange={(e) => setForm({ ...form, proef_id: e.target.value, ruiter_id: "", score: "", dq: false, tijd: "" })}
              disabled={!form.klasse || !form.onderdeel}
              style={{
                fontSize: 17,
                padding: "5px 16px",
                borderRadius: 8,
                border: "1px solid #b3c1d1",
                background: "#fafdff",
                minWidth: 180,
              }}
            >
              <option value="">Selecteer proef</option>
              {proevenOpties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.naam} ({p.datum})
                </option>
              ))}
            </select>
          </label>
          {/* 4. Ruiter */}
          <label>
            Ruiter:{" "}
            <select
              value={form.ruiter_id}
              onChange={(e) => setForm({ ...form, ruiter_id: e.target.value })}
              disabled={!form.proef_id}
              style={{
                fontSize: 17,
                padding: "5px 16px",
                borderRadius: 8,
                border: "1px solid #b3c1d1",
                background: "#fafdff",
                minWidth: 150,
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
          {/* 5. Score/tijd of DQ */}
          {gekozenProef && gekozenProef.onderdeel === "speedtrail" ? (
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
            gekozenProef && (
              <label>
                Score:{" "}
                <input
                  type="number"
                  value={form.score}
                  min={0}
                  max={max_punten || undefined}
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
            )
          )}
          {/* 6. Max punten: alleen tonen als relevant */}
          {gekozenProef &&
            gekozenProef.onderdeel !== "speedtrail" &&
            max_punten !== undefined && (
              <span style={{ color: "#888", fontSize: 15 }}>
                Max. punten: <b>{max_punten}</b>
              </span>
            )}
          {/* DQ */}
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
              disabled={!form.ruiter_id}
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
            disabled={!form.ruiter_id || !form.proef_id}
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
          Tussenstand{" "}
          {form.klasse && form.onderdeel && (
            <>
              {form.klasse} – {form.onderdeel.charAt(0).toUpperCase() +
                form.onderdeel.slice(1)}
            </>
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
              <th style={{ padding: 8 }}>
                {gekozenProef && gekozenProef.onderdeel === "speedtrail"
                  ? "Tijd (s)"
                  : "Score"}
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

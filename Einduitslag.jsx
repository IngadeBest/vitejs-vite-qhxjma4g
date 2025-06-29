// src/Einduitslag.jsx
import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";

const kleuren = {
  hoofd: "#204574",
  accent: "#3a8bfd",
  achtergrond: "#f5f7fb",
  wit: "#fff",
  tabel: "#e2f0ff",
  dq: "#ffe2e2",
};

export default function Einduitslag() {
  const [ruiters, setRuiters] = useState([]);
  const [scores, setScores] = useState([]);
  const [proeven, setProeven] = useState([]);
  const [selectedKlasse, setSelectedKlasse] = useState("WE Intro");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const { data: ruiterData } = await supabase.from("ruiters").select("*");
    const { data: scoreData } = await supabase.from("scores").select("*");
    const { data: proevenData } = await supabase.from("proeven").select("*");
    setRuiters(ruiterData || []);
    setScores(scoreData || []);
    setProeven(proevenData || []);
    setLoading(false);
  }

  // Haal proeven op voor deze klasse
  const proevenVoorKlasse = proeven
    .filter((p) => p.klasse === selectedKlasse)
    .map((p) => ({
      id: p.id,
      onderdeel: p.onderdeel,
      naam: p.naam,
      datum: p.datum,
    }));

  // Maak lijst van ruiters in deze klasse
  const ruitersInKlasse = ruiters.filter((r) => r.klasse === selectedKlasse);

  // Maak tussenstand: ruiter -> { ...proefScores, totaal, DQ }
  let eindstand = ruitersInKlasse.map((ruiter) => {
    let totaal = 0;
    let dq = false;
    let proefScores = {};

    proevenVoorKlasse.forEach((proef) => {
      const score = scores.find(
        (s) =>
          s.ruiter_id === ruiter.id &&
          s.proef_id === proef.id
      );
      if (!score) {
        proefScores[proef.id] = { punten: "", dq: false };
        dq = true; // als score mist, telt als DQ (mag je aanpassen)
      } else {
        proefScores[proef.id] = { punten: score.plaatsingspunten, dq: score.dq };
        if (score.dq) dq = true;
        totaal += score.dq ? 0 : (score.plaatsingspunten || 0);
      }
    });

    return {
      ...ruiter,
      proefScores,
      totaal,
      dq,
    };
  });

  // Sorteer op: niet-DQ eerst, dan op totaal punten aflopend (hoogste wint)
  eindstand = eindstand
    .sort((a, b) =>
      a.dq - b.dq || b.totaal - a.totaal
    )
    .map((item, i, arr) => ({
      ...item,
      plaats: item.dq
        ? "DQ"
        : 1 +
          arr
            .filter(
              (x, idx) =>
                idx < i &&
                !x.dq &&
                x.totaal > item.totaal
            ).length,
    }));

  // Zet ex aequo (gelijke punten) op dezelfde plaats
  eindstand.forEach((item, i, arr) => {
    if (item.dq) return;
    for (let j = 0; j < i; j++) {
      if (!arr[j].dq && arr[j].totaal === item.totaal) {
        item.plaats = arr[j].plaats;
      }
    }
  });

  return (
    <div
      style={{
        background: kleuren.achtergrond,
        minHeight: "100vh",
        paddingTop: 32,
        fontFamily: "system-ui,sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 940,
          margin: "0 auto",
          background: kleuren.wit,
          borderRadius: 16,
          boxShadow: "0 3px 24px #2c466633",
          padding: 36,
        }}
      >
        <h2 style={{ color: kleuren.hoofd, fontWeight: 900, fontSize: 28, letterSpacing: 1 }}>
          Einduitslag
        </h2>
        <div style={{ marginBottom: 18 }}>
          <label style={{ fontWeight: 600, color: kleuren.hoofd, marginRight: 8 }}>
            Klasse:{" "}
            <select
              value={selectedKlasse}
              onChange={(e) => setSelectedKlasse(e.target.value)}
              style={{
                fontSize: 18,
                padding: "7px 16px",
                borderRadius: 8,
                border: "1px solid #b3c1d1",
                background: "#fafdff",
              }}
            >
              {["WE Intro", "WE1", "WE2", "WE3", "WE4"].map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </label>
        </div>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginTop: 14,
            background: "#fafdff",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          <thead>
            <tr style={{ background: kleuren.tabel, color: "#184185" }}>
              <th style={{ padding: 8 }}>Plaats</th>
              <th style={{ padding: 8 }}>Ruiter</th>
              <th style={{ padding: 8 }}>Paard</th>
              {proevenVoorKlasse.map((proef) => (
                <th key={proef.id} style={{ padding: 8 }}>
                  {proef.onderdeel.charAt(0).toUpperCase() + proef.onderdeel.slice(1)}
                  <div style={{ fontWeight: 400, fontSize: 12 }}>
                    {proef.naam}
                  </div>
                </th>
              ))}
              <th style={{ padding: 8 }}>Totaal</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4 + proevenVoorKlasse.length} style={{ textAlign: "center", padding: 24 }}>
                  Laden...
                </td>
              </tr>
            ) : eindstand.length === 0 ? (
              <tr>
                <td colSpan={4 + proevenVoorKlasse.length} style={{ textAlign: "center", padding: 24 }}>
                  Nog geen scores ingevoerd voor deze klasse.
                </td>
              </tr>
            ) : (
              eindstand.map((r) => (
                <tr key={r.id} style={r.dq ? { background: kleuren.dq, color: "#bc3939" } : {}}>
                  <td style={{ fontWeight: 900, textAlign: "center" }}>{r.plaats}</td>
                  <td>{r.naam}</td>
                  <td>{r.paard}</td>
                  {proevenVoorKlasse.map((proef) => (
                    <td key={proef.id} style={{ textAlign: "center" }}>
                      {r.proefScores[proef.id]?.dq
                        ? "DQ"
                        : r.proefScores[proef.id]?.punten || ""}
                    </td>
                  ))}
                  <td style={{ fontWeight: 700, textAlign: "center" }}>
                    {r.dq ? "DQ" : r.totaal}
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

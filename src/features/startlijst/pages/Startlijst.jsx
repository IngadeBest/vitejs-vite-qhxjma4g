import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { useWedstrijden } from "@/features/inschrijven/pages/hooks/useWedstrijden";

const KLASSEN = [
  { code: "", label: "Alle klassen" },
  { code: "we0", label: "Introductieklasse (WE0)" },
  { code: "we1", label: "WE1" },
  { code: "we2", label: "WE2" },
  { code: "we3", label: "WE3" },
  { code: "we4", label: "WE4" },
];

export default function Startlijst() {
  const { items: wedstrijden, loading: loadingWed } = useWedstrijden(false);
  const [sp] = useSearchParams();
  const qId = sp.get("wedstrijdId") || "";

  const [selectedWedstrijdId, setSelectedWedstrijdId] = useState(qId);
  const [klasse, setKlasse] = useState("");
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const gekozen = useMemo(
    () => wedstrijden.find((w) => w.id === selectedWedstrijdId) || null,
    [wedstrijden, selectedWedstrijdId]
  );

  const fetchRows = useCallback(async () => {
    setBusy(true);
    setErr("");
    setRows([]);
    try {
      if (!selectedWedstrijdId) {
        setBusy(false);
        return;
      }
      let q = supabase
        .from("inschrijvingen")
        .select("id, created_at, wedstrijd_id, klasse, ruiter, paard, email, startnummer, omroeper, opmerkingen")
        .eq("wedstrijd_id", selectedWedstrijdId)
        .order("startnummer", { ascending: true, nullsFirst: true })
        .order("created_at", { ascending: true });

      if (klasse) q = q.eq("klasse", klasse);

      const { data, error } = await q;
      if (error) throw error;
      setRows(data || []);
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }, [selectedWedstrijdId, klasse]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  // Realtime (als Realtime aanstaat in Supabase)
  useEffect(() => {
    if (!selectedWedstrijdId) return;
    const channel = supabase
      .channel("rt_startlijst")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "inschrijvingen",
          filter: `wedstrijd_id=eq.${selectedWedstrijdId}`,
        },
        () => fetchRows()
      )
      .subscribe();
    return () => {
      try { supabase.removeChannel(channel); } catch {}
    };
  }, [selectedWedstrijdId, fetchRows]);

  return (
    <div style={{ maxWidth: 1100, margin: "24px auto" }}>
      <h2>Startlijst</h2>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8, alignItems: "center" }}>
        <div>
          <label style={{ display: "block", fontSize: 12, color: "#666" }}>Wedstrijd</label>
          <select
            value={selectedWedstrijdId}
            onChange={(e) => setSelectedWedstrijdId(e.target.value)}
            disabled={loadingWed}
            style={{ width: "100%" }}
          >
            <option value="">{loadingWed ? "Laden..." : "— kies wedstrijd —"}</option>
            {wedstrijden.map((w) => (
              <option key={w.id} value={w.id}>
                {w.naam} {w.datum ? `(${w.datum})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: "block", fontSize: 12, color: "#666" }}>Klasse</label>
          <select value={klasse} onChange={(e) => setKlasse(e.target.value)} style={{ width: "100%" }}>
            {KLASSEN.map((k) => (
              <option key={k.code || "all"} value={k.code}>
                {k.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: "block", fontSize: 12, color: "#666" }}>Inschrijvingen</label>
          <div style={{ fontWeight: 700, padding: "8px 0" }}>{rows.length}</div>
        </div>

        <div style={{ alignSelf: "end" }}>
          <button onClick={fetchRows} disabled={busy || !selectedWedstrijdId}>
            {busy ? "Vernieuwen..." : "Vernieuw"}
          </button>
        </div>
      </div>

      {err && <div style={{ marginTop: 12, color: "crimson" }}>{String(err)}</div>}

      {!selectedWedstrijdId && (
        <div style={{ marginTop: 16, color: "#555" }}>
          Kies hierboven een wedstrijd om de startlijst te tonen. Tip: je kunt ook direct naar{" "}
          <code>#/startlijst?wedstrijdId=&lt;uuid&gt;</code> linken.
        </div>
      )}

      {selectedWedstrijdId && (
        <div style={{ marginTop: 16 }}>
          <table width="100%" cellPadding={8} style={{ borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "#f7f7f7" }}>
                <th align="left" style={{ borderBottom: "1px solid #eee" }}>#</th>
                <th align="left" style={{ borderBottom: "1px solid #eee" }}>Ruiter</th>
                <th align="left" style={{ borderBottom: "1px solid #eee" }}>Paard</th>
                <th align="left" style={{ borderBottom: "1px solid #eee" }}>Klasse</th>
                <th align="left" style={{ borderBottom: "1px solid #eee" }}>Email</th>
                <th align="left" style={{ borderBottom: "1px solid #eee" }}>Opmerkingen</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={r.id} style={{ borderTop: "1px solid #f0f0f0" }}>
                  <td>{r.startnummer ?? idx + 1}</td>
                  <td>{r.ruiter}</td>
                  <td>{r.paard}</td>
                  <td>{r.klasse || "—"}</td>
                  <td>{r.email || "—"}</td>
                  <td>{r.opmerkingen || "—"}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ color: "#777", padding: "18px 8px" }}>
                    Nog geen inschrijvingen voor deze selectie.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!!gekozen && (
        <div style={{ marginTop: 12, fontSize: 12, color: "#666" }}>
          Formulier-link voor ruiters:{" "}
          <code>
            {location.origin}/#/formulier?wedstrijdId={gekozen.id}
          </code>
        </div>
      )}
    </div>
  );
}

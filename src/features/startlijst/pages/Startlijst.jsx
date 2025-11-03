import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { useWedstrijden } from "@/features/inschrijven/pages/hooks/useWedstrijden";
import { padStartnummer, lookupOffset } from "@/lib/startnummer";
import Container from "@/ui/Container";
import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";

/**
 * VEILIGE, EENDUIDIGE STARTLIJSTPAGINA
 * - Geen top-level logica die andere const/let aanroept (voorkomt TDZ/hoisting issues die in productie als
 *   "Cannot access 'k' before initialization" verschijnen).
 * - Geen cirkelimports.
 * - Alle helpers staan BÍNnen de component of vóór gebruik.
 */

const KLASSEN = [
  { code: "", label: "Alle klassen" },
  { code: "we0", label: "Introductieklasse (WE0)" },
  { code: "we1", label: "WE1" },
  { code: "we2", label: "WE2" },
  { code: "we2p", label: "WE2+" },
  { code: "we3", label: "WE3" },
  { code: "we4", label: "WE4" },
  { code: "yr", label: "Young Riders" },
  { code: "junior", label: "Junioren" },
];

export default function Startlijst() {
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState({
    wedstrijd_id: params.get("wedstrijd_id") || "",
    klasse: params.get("klasse") || "",
    rubriek: params.get("rubriek") || "senior",
  });

  const { items: wedstrijden, loading: wLoading, error: wError } = useWedstrijden(false);
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // helpers (definieer vóór gebruik, geen afhankelijkheid naar later gedefinieerde const/let)
  const asInt = (v, d = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  };
  const fmt = (v) => (v == null ? "" : String(v));

  // lees startlijstdataset
  useEffect(() => {
    let alive = true;
    async function run() {
      setBusy(true);
      setError("");
      try {
        if (!filter.wedstrijd_id) {
          setRows([]);
          return;
        }
        const q = supabase
          .from("inschrijvingen")
          .select("*")
          .eq("wedstrijd_id", filter.wedstrijd_id)
          .order("klasse", { ascending: true })
          .order("startnummer", { ascending: true });

        const { data, error } = await q;
        if (error) throw error;

        const wedstrijd = wedstrijden.find((w) => String(w.id) === String(filter.wedstrijd_id));
        const mapped = (data || []).map((r) => {
          // bereken offset en eind-startnummer
          const offset = lookupOffset(r.klasse, r.rubriek || "senior", wedstrijd);
          const eindNr = padStartnummer(asInt(r.startnummer, 0) + asInt(offset, 0));
          return {
            id: r.id,
            ruiter: r.ruiter || r.naam || "",
            paard: r.paard || "",
            klasse: r.klasse || "",
            rubriek: r.rubriek || "senior",
            rawStart: r.startnummer,
            offset,
            startnummer: eindNr,
          };
        });
        if (alive) setRows(mapped);
      } catch (e) {
        if (alive) setError(e?.message || "Onbekende fout bij laden.");
      } finally {
        if (alive) setBusy(false);
      }
    }
    run();
    return () => {
      alive = false;
    };
  }, [filter.wedstrijd_id, wedstrijden]);

  // update querystring als filter wijzigt
  useEffect(() => {
    const next = new URLSearchParams();
    if (filter.wedstrijd_id) next.set("wedstrijd_id", filter.wedstrijd_id);
    if (filter.klasse) next.set("klasse", filter.klasse);
    if (filter.rubriek) next.set("rubriek", filter.rubriek);
    setParams(next, { replace: true });
  }, [filter, setParams]);

  // gefilterde rijen
  const viewRows = useMemo(() => {
    return rows.filter((r) => {
      if (filter.klasse && r.klasse !== filter.klasse) return false;
      if (filter.rubriek && r.rubriek !== filter.rubriek) return false;
      return true;
    });
  }, [rows, filter]);

  return (
    <Container>
      <h1 className="text-xl font-bold mb-4">Startlijsten</h1>

      {wError && <Alert variant="error">{wError}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
        <div>
          <label className="block text-sm mb-1">Wedstrijd</label>
          <select
            value={filter.wedstrijd_id}
            onChange={(e) => setFilter((s) => ({ ...s, wedstrijd_id: e.target.value }))}
            className="w-full border rounded p-2"
          >
            <option value="">— kies —</option>
            {wedstrijden.map((w) => (
              <option key={w.id} value={w.id}>
                {w.naam} — {w.datum}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm mb-1">Klasse</label>
          <select
            value={filter.klasse}
            onChange={(e) => setFilter((s) => ({ ...s, klasse: e.target.value }))}
            className="w-full border rounded p-2"
          >
            {KLASSEN.map((k) => (
              <option key={k.code} value={k.code}>
                {k.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm mb-1">Rubriek</label>
          <select
            value={filter.rubriek}
            onChange={(e) => setFilter((s) => ({ ...s, rubriek: e.target.value }))}
            className="w-full border rounded p-2"
          >
            <option value="senior">Senior</option>
            <option value="jeugd">Jeugd</option>
          </select>
        </div>

        <div className="flex items-end">
          <Button onClick={() => setFilter((s) => ({ ...s }))} disabled={busy || !filter.wedstrijd_id}>
            Vernieuwen
          </Button>
        </div>
      </div>

      {busy && <div>Laden…</div>}

      <div className="overflow-auto border rounded">
        <table className="min-w-[700px] w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left p-2 border">Startnr</th>
              <th className="text-left p-2 border">Ruiter</th>
              <th className="text-left p-2 border">Paard</th>
              <th className="text-left p-2 border">Klasse</th>
              <th className="text-left p-2 border">Rubriek</th>
              <th className="text-left p-2 border">Ruw</th>
              <th className="text-left p-2 border">Offset</th>
            </tr>
          </thead>
          <tbody>
            {viewRows.map((r) => (
              <tr key={r.id}>
                <td className="p-2 border">{fmt(r.startnummer)}</td>
                <td className="p-2 border">{fmt(r.ruiter)}</td>
                <td className="p-2 border">{fmt(r.paard)}</td>
                <td className="p-2 border">{fmt(r.klasse)}</td>
                <td className="p-2 border">{fmt(r.rubriek)}</td>
                <td className="p-2 border">{fmt(r.rawStart)}</td>
                <td className="p-2 border">{fmt(r.offset)}</td>
              </tr>
            ))}
            {!busy && viewRows.length === 0 && (
              <tr>
                <td colSpan={7} className="p-4 text-center text-gray-500">
                  Geen rijen
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Container>
  );
}

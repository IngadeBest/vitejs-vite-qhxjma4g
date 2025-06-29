import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";

const KLASSEN = ["WE Intro", "WE1", "WE2", "WE3", "WE4"];
const ONDERDELEN = ["dressuur", "stijltrail", "speedtrail"];

export default function ProefInstellingen() {
  const [proeven, setProeven] = useState([]);
  const [form, setForm] = useState({
    naam: "",
    datum: "",
    max_punten: "",
    jury: "",
    klasse: KLASSEN[0],
    onderdeel: ONDERDELEN[0],
  });
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProeven();
  }, []);

  async function fetchProeven() {
    const { data } = await supabase.from("proeven").select("*").order("id", { ascending: true });
    setProeven(data || []);
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({
      ...f,
      [name]: value,
      // Reset max_punten als onderdeel verandert naar speedtrail
      ...(name === "onderdeel" && value === "speedtrail" ? { max_punten: "" } : {}),
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    // Validatie
    if (!form.naam || !form.datum || !form.jury || !form.klasse || !form.onderdeel) {
      setError("Vul alle velden in.");
      return;
    }
    if (form.onderdeel !== "speedtrail" && !form.max_punten) {
      setError("Vul het maximaal punten in.");
      return;
    }
    setError("");
    setLoading(true);

    if (editingId) {
      // Bewerken
      const { error } = await supabase
        .from("proeven")
        .update({
          ...form,
          max_punten: form.onderdeel === "speedtrail" ? null : Number(form.max_punten),
        })
        .eq("id", editingId);
      if (error) setError("Bewerken mislukt!");
    } else {
      // Toevoegen
      const { error } = await supabase.from("proeven").insert([
        {
          ...form,
          max_punten: form.onderdeel === "speedtrail" ? null : Number(form.max_punten),
        },
      ]);
      if (error) setError("Opslaan mislukt!");
    }
    setForm({
      naam: "",
      datum: "",
      max_punten: "",
      jury: "",
      klasse: KLASSEN[0],
      onderdeel: ONDERDELEN[0],
    });
    setEditingId(null);
    setLoading(false);
    fetchProeven();
  }

  function handleEdit(proef) {
    setForm({
      naam: proef.naam,
      datum: proef.datum,
      max_punten: proef.max_punten || "",
      jury: proef.jury,
      klasse: proef.klasse,
      onderdeel: proef.onderdeel,
    });
    setEditingId(proef.id);
    setError("");
  }

  async function handleDelete(id) {
    setLoading(true);
    await supabase.from("proeven").delete().eq("id", id);
    setLoading(false);
    fetchProeven();
  }

  return (
    <div style={{ background: "#f5f7fb", minHeight: "100vh", fontFamily: "system-ui, sans-serif" }}>
      <div style={{
        maxWidth: 900,
        background: "#fff",
        borderRadius: 15,
        boxShadow: "0 4px 24px #2c466622",
        margin: "0 auto",
        padding: "36px 28px 28px 28px",
      }}>
        <h2 style={{
          fontSize: 29,
          color: "#204574",
          fontWeight: 900,
          marginBottom: 22,
          letterSpacing: 1.3,
          textTransform: "uppercase",
        }}>
          Proefinstellingen
        </h2>
        <form onSubmit={handleSubmit} style={{
          display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 24,
          alignItems: "center",
        }}>
          <input
            type="text"
            name="naam"
            value={form.naam}
            onChange={handleChange}
            placeholder="Naam proef (bv. Dressuur WE1)"
            style={{ fontSize: 17, padding: "7px 11px", borderRadius: 8, border: "1px solid #b3c1d1", width: 180 }}
            disabled={loading}
          />
          <input
            type="date"
            name="datum"
            value={form.datum}
            onChange={handleChange}
            style={{ fontSize: 17, padding: "7px 11px", borderRadius: 8, border: "1px solid #b3c1d1", width: 140 }}
            disabled={loading}
          />
          <select
            name="klasse"
            value={form.klasse}
            onChange={handleChange}
            style={{ fontSize: 17, padding: "7px 11px", borderRadius: 8, border: "1px solid #b3c1d1", width: 110 }}
            disabled={loading}
          >
            {KLASSEN.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
          <select
            name="onderdeel"
            value={form.onderdeel}
            onChange={handleChange}
            style={{ fontSize: 17, padding: "7px 11px", borderRadius: 8, border: "1px solid #b3c1d1", width: 110 }}
            disabled={loading}
          >
            {ONDERDELEN.map((o) => (
              <option key={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>
            ))}
          </select>
          {/* Alleen tonen als geen speedtrail */}
          {form.onderdeel !== "speedtrail" && (
            <input
              type="number"
              name="max_punten"
              value={form.max_punten}
              onChange={handleChange}
              placeholder="Max punten"
              min={1}
              style={{ fontSize: 17, padding: "7px 11px", borderRadius: 8, border: "1px solid #b3c1d1", width: 120 }}
              disabled={loading}
              required={form.onderdeel !== "speedtrail"}
            />
          )}
          <input
            type="text"
            name="jury"
            value={form.jury}
            onChange={handleChange}
            placeholder="Jury"
            style={{ fontSize: 17, padding: "7px 11px", borderRadius: 8, border: "1px solid #b3c1d1", width: 140 }}
            disabled={loading}
          />
          <button
            type="submit"
            style={{
              background: "#3a8bfd",
              color: "#fff",
              border: "none",
              padding: "10px 30px",
              fontSize: 17,
              borderRadius: 8,
              cursor: loading ? "not-allowed" : "pointer",
              fontWeight: "bold",
              boxShadow: "0 1px 7px #3a8bfd33",
            }}
            disabled={loading}
          >
            {editingId ? "Bijwerken" : "Toevoegen"}
          </button>
        </form>
        {error && <div style={{ color: "red", marginBottom: 12 }}>{error}</div>}
        {/* Overzicht proeven */}
        <table style={{ width: "100%", background: "#e5f0ff", borderRadius: 10, marginTop: 14, overflow: "hidden" }}>
          <thead>
            <tr style={{ background: "#3a8bfd", color: "#fff" }}>
              <th style={{ padding: 10 }}>Naam</th>
              <th>Datum</th>
              <th>Max punten</th>
              <th>Jury</th>
              <th>Klasse</th>
              <th>Onderdeel</th>
              <th>Acties</th>
            </tr>
          </thead>
          <tbody>
            {proeven.map((p) => (
              <tr key={p.id} style={{ background: "#fff", textAlign: "center" }}>
                <td style={{ padding: 9 }}>{p.naam}</td>
                <td>{p.datum}</td>
                <td>{p.onderdeel === "speedtrail" ? "-" : p.max_punten}</td>
                <td>{p.jury}</td>
                <td>{p.klasse}</td>
                <td style={{ textTransform: "capitalize" }}>{p.onderdeel}</td>
                <td>
                  <button
                    style={{ color: "#2270e0", background: "none", border: "none", fontWeight: 600, cursor: "pointer" }}
                    onClick={() => handleEdit(p)}
                  >
                    Bewerken
                  </button>
                  <button
                    style={{ color: "#b23e3e", background: "none", border: "none", fontWeight: 600, cursor: "pointer", marginLeft: 8 }}
                    onClick={() => handleDelete(p.id)}
                  >
                    Verwijderen
                  </button>
                </td>
              </tr>
            ))}
            {proeven.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: 18 }}>
                  Geen proeven gevonden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {loading && <div style={{ textAlign: "center", marginTop: 16, color: "#666" }}>Even geduld...</div>}
      </div>
    </div>
  );
}

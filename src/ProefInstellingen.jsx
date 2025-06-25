import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

export default function ProefInstellingen() {
  const [proeven, setProeven] = useState([]);
  const [form, setForm] = useState({
    naam: "",
    datum: "",
    max_score: "",
    jury: "",
    klasse: "WE Intro",
  });
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchProeven();
  }, []);

  async function fetchProeven() {
    setLoading(true);
    const { data, error } = await supabase
      .from("proeven")
      .select("*")
      .order("datum", { ascending: true });
    if (!error) setProeven(data);
    setLoading(false);
  }

  async function handleAddOrUpdate() {
    if (!form.naam || !form.max_score || !form.klasse) {
      setError("Vul alle verplichte velden in!");
      return;
    }
    setLoading(true);
    if (editingId) {
      const { error } = await supabase
        .from("proeven")
        .update(form)
        .eq("id", editingId);
      if (error) setError("Bewerken mislukt!");
    } else {
      const { error } = await supabase.from("proeven").insert([form]);
      if (error) setError("Opslaan mislukt!");
    }
    setForm({ naam: "", datum: "", max_score: "", jury: "", klasse: "WE Intro" });
    setEditingId(null);
    setError("");
    await fetchProeven();
    setLoading(false);
  }

  function handleEdit(proef) {
    setForm({
      naam: proef.naam,
      datum: proef.datum || "",
      max_score: proef.max_score || "",
      jury: proef.jury || "",
      klasse: proef.klasse || "WE Intro",
    });
    setEditingId(proef.id);
  }

  async function handleDelete(id) {
    setLoading(true);
    await supabase.from("proeven").delete().eq("id", id);
    await fetchProeven();
    setLoading(false);
  }

  return (
    <div style={{ background: "#fff", borderRadius: 15, boxShadow: "0 2px 12px #2c466622", padding: 32, maxWidth: 650, margin: "40px auto", fontFamily: "system-ui, sans-serif" }}>
      <h2 style={{ marginBottom: 18, fontSize: 26, color: "#204574", fontWeight: 900 }}>Proefinstellingen</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <input
          name="naam"
          value={form.naam}
          onChange={e => setForm({ ...form, naam: e.target.value })}
          placeholder="Naam proef (bijv. Dressuur, Stijltrail)"
          style={{ padding: 11, fontSize: 16, borderRadius: 8, border: "1px solid #b3c1d1" }}
          disabled={loading}
        />
        <input
          name="datum"
          type="date"
          value={form.datum}
          onChange={e => setForm({ ...form, datum: e.target.value })}
          style={{ padding: 11, fontSize: 16, borderRadius: 8, border: "1px solid #b3c1d1" }}
          disabled={loading}
        />
        <input
          name="max_score"
          type="number"
          value={form.max_score}
          onChange={e => setForm({ ...form, max_score: e.target.value })}
          placeholder="Maximaal aantal punten"
          style={{ padding: 11, fontSize: 16, borderRadius: 8, border: "1px solid #b3c1d1" }}
          disabled={loading}
        />
        <input
          name="jury"
          value={form.jury}
          onChange={e => setForm({ ...form, jury: e.target.value })}
          placeholder="Naam jury"
          style={{ padding: 11, fontSize: 16, borderRadius: 8, border: "1px solid #b3c1d1" }}
          disabled={loading}
        />
        <select
          name="klasse"
          value={form.klasse}
          onChange={e => setForm({ ...form, klasse: e.target.value })}
          style={{ padding: 11, fontSize: 16, borderRadius: 8, border: "1px solid #b3c1d1" }}
          disabled={loading}
        >
          {["WE Intro", "WE1", "WE2", "WE3", "WE4"].map(k => (
            <option key={k}>{k}</option>
          ))}
        </select>
        <button
          onClick={handleAddOrUpdate}
          style={{ marginTop: 8, background: "#3a8bfd", color: "#fff", border: "none", padding: "13px 0", fontSize: 18, borderRadius: 8, cursor: loading ? "not-allowed" : "pointer", fontWeight: "bold", boxShadow: "0 1px 7px #3a8bfd33" }}
          disabled={loading}
        >
          {editingId ? "Bijwerken" : "Toevoegen"}
        </button>
      </div>
      {error && (
        <div style={{ color: "red", marginTop: 12 }}>{error}</div>
      )}

      {/* Lijst met proeven */}
      <div style={{ marginTop: 36 }}>
        {proeven.length === 0 ? (
          <div style={{ color: "#555" }}>Nog geen proeven toegevoegd.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", background: "#fafdff", borderRadius: 8, marginBottom: 10 }}>
            <thead>
              <tr style={{ background: "#3a8bfd", color: "#fff" }}>
                <th style={{ padding: 9 }}>Naam</th>
                <th>Datum</th>
                <th>Max punten</th>
                <th>Jury</th>
                <th>Klasse</th>
                <th>Acties</th>
              </tr>
            </thead>
            <tbody>
              {proeven.map(proef => (
                <tr key={proef.id} style={{ textAlign: "center" }}>
                  <td>{proef.naam}</td>
                  <td>{proef.datum}</td>
                  <td>{proef.max_score}</td>
                  <td>{proef.jury}</td>
                  <td>{proef.klasse}</td>
                  <td>
                    <button style={{ color: "#3a8bfd", background: "none", border: "none", fontWeight: 600, cursor: "pointer", fontSize: 15 }} onClick={() => handleEdit(proef)} disabled={loading}>Bewerken</button>
                    <button style={{ marginLeft: 8, color: "#b23e3e", background: "none", border: "none", fontWeight: 600, cursor: "pointer", fontSize: 15 }} onClick={() => handleDelete(proef.id)} disabled={loading}>Verwijderen</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {loading && (
        <div style={{ textAlign: "center", marginTop: 20, color: "#666" }}>
          Even geduld...
        </div>
      )}
    </div>
  );
}

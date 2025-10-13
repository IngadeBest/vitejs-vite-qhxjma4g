import { useState, useEffect } from "react";
import { supabase } from '../../lib/supabaseClient';

const klasses = ["WE Intro", "WE1", "WE2", "WE3", "WE4"];
const onderdelen = ["Dressuur", "Stijltrail", "Speedtrail"];

export default function ProefInstellingen() {
  const [proeven, setProeven] = useState([]);
  const [form, setForm] = useState({
    naam: "",
    klasse: "WE1",
    onderdeel: "Dressuur",
    max_score: "",
    datum: "",
    jeugd: false
  });
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchProeven(); }, []);

  async function fetchProeven() {
    const { data } = await supabase.from("proeven").select("*").order("id", { ascending: true });
    setProeven(data || []);
  }

  async function handleAddOrUpdate() {
    if (!form.naam || !form.klasse || !form.onderdeel || (!form.max_score && form.onderdeel !== "Speedtrail")) {
      alert("Vul alle verplichte velden in!");
      return;
    }
    setLoading(true);
    const proefData = {
      ...form,
      max_score: form.onderdeel === "Speedtrail" ? null : Number(form.max_score),
      klasse: form.klasse + (form.jeugd ? " - Jeugd" : "")
    };
    if (editingId) {
      await supabase.from("proeven").update(proefData).eq("id", editingId);
    } else {
      await supabase.from("proeven").insert([proefData]);
    }
    setForm({ naam: "", klasse: "WE1", onderdeel: "Dressuur", max_score: "", datum: "", jeugd: false });
    setEditingId(null);
    await fetchProeven();
    setLoading(false);
  }

  function handleEdit(proef) {
    setForm({
      naam: proef.naam,
      klasse: proef.klasse.replace(" - Jeugd", ""),
      onderdeel: proef.onderdeel,
      max_score: proef.max_score || "",
      datum: proef.datum,
      jeugd: proef.klasse.includes("Jeugd")
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
    <div style={{ maxWidth: 700, margin: "30px auto", background: "#fff", padding: 30, borderRadius: 14, boxShadow: "0 3px 15px #1a2a4131", fontFamily: "system-ui, sans-serif" }}>
      <h2 style={{ fontWeight: 900, color: "#204574", marginBottom: 22 }}>Proefinstellingen</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input
          name="naam"
          value={form.naam}
          onChange={e => setForm({ ...form, naam: e.target.value })}
          placeholder="Naam proef"
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
          {klasses.map(k => <option key={k}>{k}</option>)}
        </select>
        <select
          name="onderdeel"
          value={form.onderdeel}
          onChange={e => setForm({ ...form, onderdeel: e.target.value })}
          style={{ padding: 11, fontSize: 16, borderRadius: 8, border: "1px solid #b3c1d1" }}
          disabled={loading}
        >
          {onderdelen.map(o => <option key={o}>{o}</option>)}
        </select>
        {/* Alleen voor niet-Speedtrail */}
        {form.onderdeel !== "Speedtrail" && (
          <input
            name="max_score"
            type="number"
            value={form.max_score}
            onChange={e => setForm({ ...form, max_score: e.target.value })}
            placeholder="Max punten"
            style={{ padding: 11, fontSize: 16, borderRadius: 8, border: "1px solid #b3c1d1" }}
            disabled={loading}
          />
        )}
        <input
          name="datum"
          type="date"
          value={form.datum}
          onChange={e => setForm({ ...form, datum: e.target.value })}
          style={{ padding: 11, fontSize: 16, borderRadius: 8, border: "1px solid #b3c1d1" }}
          disabled={loading}
        />
        <label style={{ fontSize: 16, fontWeight: 700 }}>
          <input
            type="checkbox"
            checked={form.jeugd}
            onChange={e => setForm({ ...form, jeugd: e.target.checked })}
            style={{ marginRight: 7 }}
            disabled={loading}
          />
          Jeugd rubriek
        </label>
        <button
          onClick={handleAddOrUpdate}
          style={{ marginTop: 8, background: "#3a8bfd", color: "#fff", border: "none", padding: "13px 0", fontSize: 18, borderRadius: 8, cursor: loading ? "not-allowed" : "pointer", fontWeight: "bold", boxShadow: "0 1px 7px #3a8bfd33" }}
          disabled={loading}
        >
          {editingId ? "Bijwerken" : "Toevoegen"}
        </button>
      </div>
      {/* Overzicht */}
      <div style={{ marginTop: 38 }}>
        <h3 style={{ color: "#3a8bfd", fontWeight: 900 }}>Overzicht</h3>
        <table style={{ width: "100%", background: "#fafdff", marginTop: 6, borderRadius: 8 }}>
          <thead>
            <tr style={{ background: "#e6eefb" }}>
              <th>Naam</th>
              <th>Klasse</th>
              <th>Onderdeel</th>
              <th>Max punten</th>
              <th>Datum</th>
              <th>Jeugd</th>
              <th>Acties</th>
            </tr>
          </thead>
          <tbody>
            {proeven.map(p => (
              <tr key={p.id}>
                <td>{p.naam}</td>
                <td>{p.klasse}</td>
                <td>{p.onderdeel}</td>
                <td>{p.max_score ?? "-"}</td>
                <td>{p.datum}</td>
                <td>{p.klasse.includes("Jeugd") ? "✓" : ""}</td>
                <td>
                  <button style={{ marginRight: 7 }} onClick={() => handleEdit(p)} disabled={loading}>Bewerken</button>
                  <button onClick={() => handleDelete(p.id)} disabled={loading}>Verwijderen</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {loading && (
        <div style={{ textAlign: "center", marginTop: 20, color: "#666" }}>
          Even geduld...
        </div>
      )}
    </div>
  );
}

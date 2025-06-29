import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";

const klassen = ["WE Intro", "WE1", "WE2", "WE3", "WE4"];
const onderdelen = ["dressuur", "stijltrail", "speedtrail"];

export default function ProefInstellingen() {
  const [proeven, setProeven] = useState([]);
  const [form, setForm] = useState({
    naam: "",
    datum: "",
    klasse: klassen[0],
    onderdeel: onderdelen[0],
    max_score: "",
    jury: "",
  });
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProeven();
  }, []);

  async function fetchProeven() {
    const { data } = await supabase.from("proeven").select("*").order("datum", { ascending: true });
    setProeven(data || []);
  }

  function resetForm() {
    setForm({
      naam: "",
      datum: "",
      klasse: klassen[0],
      onderdeel: onderdelen[0],
      max_score: "",
      jury: "",
    });
    setEditingId(null);
    setError("");
  }

  async function handleAddOrUpdate() {
    setError("");
    if (!form.naam || !form.datum || !form.klasse || !form.onderdeel) {
      setError("Vul alle verplichte velden in!");
      return;
    }
    if (form.onderdeel !== "speedtrail" && !form.max_score) {
      setError("Vul een maximaal score in voor dit onderdeel!");
      return;
    }

    setLoading(true);

    // Maak object voor insert/update
    const upsertObj = {
      naam: form.naam,
      datum: form.datum,
      klasse: form.klasse,
      onderdeel: form.onderdeel,
      max_score: form.onderdeel === "speedtrail" ? null : Number(form.max_score),
      jury: form.jury,
    };

    if (editingId) {
      // UPDATE
      const { error } = await supabase
        .from("proeven")
        .update(upsertObj)
        .eq("id", editingId);
      if (error) setError("Bewerken mislukt!");
    } else {
      // INSERT
      const { error } = await supabase.from("proeven").insert([upsertObj]);
      if (error) setError("Toevoegen mislukt!");
    }
    setLoading(false);
    resetForm();
    fetchProeven();
  }

  function handleEdit(proef) {
    setForm({
      naam: proef.naam,
      datum: proef.datum,
      klasse: proef.klasse,
      onderdeel: proef.onderdeel,
      max_score: proef.max_score || "",
      jury: proef.jury || "",
    });
    setEditingId(proef.id);
    setError("");
  }

  async function handleDelete(id) {
    setLoading(true);
    await supabase.from("proeven").delete().eq("id", id);
    setLoading(false);
    fetchProeven();
    resetForm();
  }

  return (
    <div style={{ background: "#f5f7fb", minHeight: "100vh", fontFamily: "system-ui, sans-serif" }}>
      <div style={{
        maxWidth: 1000, background: "#fff", borderRadius: 15, boxShadow: "0 4px 24px #2c466622",
        margin: "0 auto", padding: "36px 28px 28px 28px"
      }}>
        <h2 style={{
          fontSize: 29, color: "#204574", fontWeight: 900, marginBottom: 18,
          letterSpacing: 1.3, textTransform: "uppercase"
        }}>Proefinstellingen</h2>
        <div style={{
          display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap",
          alignItems: "center"
        }}>
          <input
            placeholder="Naam proef (bv. Dressuur WE1)"
            value={form.naam}
            onChange={e => setForm({ ...form, naam: e.target.value })}
            style={{ padding: 9, fontSize: 16, borderRadius: 8, border: "1px solid #b3c1d1", width: 200 }}
            disabled={loading}
          />
          <input
            type="date"
            value={form.datum}
            onChange={e => setForm({ ...form, datum: e.target.value })}
            style={{ padding: 9, fontSize: 16, borderRadius: 8, border: "1px solid #b3c1d1" }}
            disabled={loading}
          />
          <select
            value={form.klasse}
            onChange={e => setForm({ ...form, klasse: e.target.value })}
            style={{ padding: 9, fontSize: 16, borderRadius: 8, border: "1px solid #b3c1d1" }}
            disabled={loading}
          >
            {klassen.map(k => <option key={k}>{k}</option>)}
          </select>
          <select
            value={form.onderdeel}
            onChange={e => setForm({ ...form, onderdeel: e.target.value, max_score: "" })}
            style={{ padding: 9, fontSize: 16, borderRadius: 8, border: "1px solid #b3c1d1" }}
            disabled={loading}
          >
            {onderdelen.map(o => <option key={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
          </select>
          {/* Alleen tonen als niet speedtrail */}
          {form.onderdeel !== "speedtrail" && (
            <input
              placeholder="Max punten"
              type="number"
              min={1}
              value={form.max_score}
              onChange={e => setForm({ ...form, max_score: e.target.value })}
              style={{ padding: 9, fontSize: 16, borderRadius: 8, border: "1px solid #b3c1d1", width: 120 }}
              disabled={loading}
            />
          )}
          <input
            placeholder="Jury"
            value={form.jury}
            onChange={e => setForm({ ...form, jury: e.target.value })}
            style={{ padding: 9, fontSize: 16, borderRadius: 8, border: "1px solid #b3c1d1", width: 160 }}
            disabled={loading}
          />
          <button
            onClick={handleAddOrUpdate}
            style={{
              background: "#3a8bfd",
              color: "#fff",
              border: "none",
              padding: "13px 24px",
              fontSize: 17,
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: "bold",
              boxShadow: "0 1px 7px #3a8bfd33",
              marginLeft: 8,
              letterSpacing: 1,
              minWidth: 110,
            }}
            disabled={loading}
          >
            {editingId ? "Bijwerken" : "Toevoegen"}
          </button>
          {editingId && (
            <button
              style={{
                marginLeft: 6,
                padding: "13px 24px",
                background: "#eee",
                color: "#1a2b44",
                border: "none",
                fontSize: 16,
                borderRadius: 8,
                fontWeight: 500,
                cursor: "pointer",
              }}
              onClick={resetForm}
              disabled={loading}
            >
              Annuleren
            </button>
          )}
        </div>
        {error && <div style={{ color: "red", marginBottom: 10 }}>{error}</div>}

        <table style={{
          width: "100%", borderCollapse: "separate", borderSpacing: "0 5px",
          background: "#fafdff", borderRadius: 8, overflow: "hidden", marginTop: 16
        }}>
          <thead>
            <tr style={{ background: "#3a8bfd", color: "#fff" }}>
              <th style={{ padding: 10 }}>Naam</th>
              <th style={{ padding: 10 }}>Datum</th>
              <th style={{ padding: 10 }}>Max punten</th>
              <th style={{ padding: 10 }}>Jury</th>
              <th style={{ padding: 10 }}>Klasse</th>
              <th style={{ padding: 10 }}>Onderdeel</th>
              <th style={{ padding: 10 }}>Acties</th>
            </tr>
          </thead>
          <tbody>
            {proeven.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: 14 }}>
                  Nog geen proeven aangemaakt.
                </td>
              </tr>
            )}
            {proeven.map(p => (
              <tr key={p.id}>
                <td style={{ padding: 8 }}>{p.naam}</td>
                <td style={{ padding: 8 }}>{p.datum}</td>
                <td style={{ padding: 8 }}>{p.max_score ?? ""}</td>
                <td style={{ padding: 8 }}>{p.jury ?? ""}</td>
                <td style={{ padding: 8 }}>{p.klasse}</td>
                <td style={{ padding: 8 }}>{p.onderdeel.charAt(0).toUpperCase() + p.onderdeel.slice(1)}</td>
                <td style={{ padding: 8 }}>
                  <button
                    onClick={() => handleEdit(p)}
                    style={{ color: "#3a8bfd", background: "none", border: "none", fontWeight: 600, cursor: "pointer" }}
                  >Bewerken</button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    style={{ color: "#b23e3e", background: "none", border: "none", fontWeight: 600, cursor: "pointer", marginLeft: 8 }}
                  >Verwijderen</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && (
          <div style={{ textAlign: "center", marginTop: 18, color: "#666" }}>Even geduld...</div>
        )}
      </div>
    </div>
  );
}

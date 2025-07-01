import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";

export default function RuiterInvoer() {
  const [ruiters, setRuiters] = useState([]);
  const [form, setForm] = useState({
    naam: "",
    paard: "",
    klasse: "",
    land: "",
  });
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [klasses, setKlasses] = useState([]);

  useEffect(() => {
    fetchRuiters();
    fetchKlasses();
  }, []);

  async function fetchRuiters() {
    setLoading(true);
    const { data } = await supabase
      .from("ruiters")
      .select("*")
      .order("id", { ascending: true });
    setRuiters(data || []);
    setLoading(false);
  }

  async function fetchKlasses() {
    // Haal unieke klasses uit proeven (dus ook Jeugd!)
    const { data } = await supabase.from("proeven").select("klasse");
    const unieke = Array.from(new Set((data || []).map(p => p.klasse))).sort();
    setKlasses(unieke);
    // Standaard eerste klasse selecteren indien leeg
    setForm(f => ({ ...f, klasse: unieke[0] || "" }));
  }

  async function handleAddOrUpdate() {
    if (!form.naam || !form.paard || !form.klasse) {
      setError("Vul alle verplichte velden in!");
      return;
    }
    setLoading(true);
    if (editingId) {
      await supabase.from("ruiters").update(form).eq("id", editingId);
    } else {
      await supabase.from("ruiters").insert([form]);
    }
    setForm({ naam: "", paard: "", klasse: klasses[0] || "", land: "" });
    setEditingId(null);
    setError("");
    await fetchRuiters();
    setLoading(false);
  }

  function handleEdit(ruiter) {
    setForm({
      naam: ruiter.naam,
      paard: ruiter.paard,
      klasse: ruiter.klasse,
      land: ruiter.land || "",
    });
    setEditingId(ruiter.id);
  }

  async function handleDelete(id) {
    setLoading(true);
    await supabase.from("ruiters").delete().eq("id", id);
    await fetchRuiters();
    setLoading(false);
  }

  return (
    <div style={{ background: "#f5f7fb", minHeight: "100vh" }}>
      <div
        style={{
          background: "#fff",
          borderRadius: 15,
          boxShadow: "0 2px 12px #2c466622",
          padding: 32,
          maxWidth: 540,
          margin: "40px auto",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <h2
          style={{
            marginBottom: 18,
            fontSize: 26,
            color: "#204574",
            fontWeight: 900,
          }}
        >
          Ruiter invoer
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <input
            name="naam"
            value={form.naam}
            onChange={e => setForm({ ...form, naam: e.target.value })}
            placeholder="Naam ruiter"
            style={{
              padding: 11,
              fontSize: 16,
              borderRadius: 8,
              border: "1px solid #b3c1d1",
            }}
            disabled={loading}
          />
          <input
            name="paard"
            value={form.paard}
            onChange={e => setForm({ ...form, paard: e.target.value })}
            placeholder="Naam paard"
            style={{
              padding: 11,
              fontSize: 16,
              borderRadius: 8,
              border: "1px solid #b3c1d1",
            }}
            disabled={loading}
          />
          <select
            name="klasse"
            value={form.klasse}
            onChange={e => setForm({ ...form, klasse: e.target.value })}
            style={{
              padding: 11,
              fontSize: 16,
              borderRadius: 8,
              border: "1px solid #b3c1d1",
            }}
            disabled={loading}
          >
            {klasses.map(k => (
              <option key={k}>{k}</option>
            ))}
          </select>
          <input
            name="land"
            value={form.land}
            onChange={e => setForm({ ...form, land: e.target.value })}
            placeholder="Land"
            style={{
              padding: 11,
              fontSize: 16,
              borderRadius: 8,
              border: "1px solid #b3c1d1",
            }}
            disabled={loading}
          />
          <button
            onClick={handleAddOrUpdate}
            style={{
              marginTop: 8,
              background: "#3a8bfd",
              color: "#fff",
              border: "none",
              padding: "13px 0",
              fontSize: 18,
              borderRadius: 8,
              cursor: loading ? "not-allowed" : "pointer",
              fontWeight: "bold",
              boxShadow: "0 1px 7px #3a8bfd33",
            }}
            disabled={loading}
          >
            {editingId ? "Bijwerken" : "Toevoegen"}
          </button>
        </div>
        {error && (
          <div style={{ color: "red", marginTop: 12 }}>{error}</div>
        )}

        {/* Per klasse overzicht */}
        <div style={{ marginTop: 36 }}>
          {klasses.map(klasse => {
            const deelnemers = ruiters.filter(e => e.klasse === klasse);
            if (deelnemers.length === 0) return null;
            return (
              <div key={klasse} style={{ marginBottom: 12 }}>
                <div
                  style={{
                    fontWeight: 700,
                    color: "#3a8bfd",
                    margin: "14px 0 6px 0",
                    fontSize: 18,
                  }}
                >
                  {klasse}
                </div>
                <ul style={{ paddingLeft: 18 }}>
                  {deelnemers.map(e => (
                    <li key={e.id} style={{ fontSize: 16, marginBottom: 6 }}>
                      {e.naam} met {e.paard} {e.land && `(${e.land})`}
                      <button
                        style={{
                          marginLeft: 18,
                          color: "#3a8bfd",
                          background: "none",
                          border: "none",
                          fontWeight: 600,
                          cursor: "pointer",
                          fontSize: 15,
                        }}
                        onClick={() => handleEdit(e)}
                        disabled={loading}
                      >
                        Bewerken
                      </button>
                      <button
                        style={{
                          marginLeft: 8,
                          color: "#b23e3e",
                          background: "none",
                          border: "none",
                          fontWeight: 600,
                          cursor: "pointer",
                          fontSize: 15,
                        }}
                        onClick={() => handleDelete(e.id)}
                        disabled={loading}
                      >
                        Verwijderen
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
        {loading && (
          <div style={{ textAlign: "center", marginTop: 20, color: "#666" }}>
            Even geduld...
          </div>
        )}
      </div>
    </div>
  );
}

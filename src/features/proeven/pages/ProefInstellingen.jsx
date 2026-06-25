import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useWedstrijdContext } from "@/features/wedstrijden/context/WedstrijdContext";

const klasses = ["Introductieklasse (WE0)", "WE1", "WE2", "WE2+", "WE3", "WE4", "Young Riders", "Junioren"];
const onderdelen = ["Dressuur", "Stijltrail", "Speedtrail"];

export default function ProefInstellingen() {
  const { wedstrijden, selectedWedstrijdId, selectedWedstrijd, setSelectedWedstrijdId } = useWedstrijdContext();
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
  const [filterWedstrijdId, setFilterWedstrijdId] = useState("");

  const actieveWedstrijdId = selectedWedstrijdId || filterWedstrijdId;
  const actieveWedstrijd = useMemo(
    () => wedstrijden.find((wedstrijd) => wedstrijd.id === actieveWedstrijdId) || null,
    [actieveWedstrijdId, wedstrijden]
  );

  useEffect(() => {
    if (selectedWedstrijdId && !filterWedstrijdId) {
      setFilterWedstrijdId(selectedWedstrijdId);
    }
  }, [selectedWedstrijdId, filterWedstrijdId]);

  useEffect(() => { fetchProeven(); }, [actieveWedstrijdId]);

  async function fetchProeven() {
    let query = supabase.from("proeven").select("*").order("id", { ascending: true });
    if (actieveWedstrijdId) {
      query = query.eq("wedstrijd_id", actieveWedstrijdId);
    }
    const { data } = await query;
    setProeven(data || []);
  }

  async function handleAddOrUpdate() {
    if (!form.naam || !form.klasse || !form.onderdeel || (!form.max_score && form.onderdeel !== "Speedtrail")) {
      alert("Vul alle verplichte velden in!");
      return;
    }
    setLoading(true);
    const proefData = {
      naam: form.naam,
      klasse: form.klasse + (form.jeugd ? " - Jeugd" : ""),
      onderdeel: form.onderdeel,
      max_score: form.onderdeel === "Speedtrail" ? null : Number(form.max_score),
      datum: form.datum || null, // Lege string wordt null
      wedstrijd_id: actieveWedstrijdId || null,
    };
    try {
      let result;
      if (editingId) {
        result = await supabase.from("proeven").update(proefData).eq("id", editingId);
      } else {
        result = await supabase.from("proeven").insert([proefData]);
      }
      if (result.error) {
        console.error('Database error:', result.error);
        alert('Database fout: ' + result.error.message);
        setLoading(false);
        return;
      }
      setForm({ naam: "", klasse: "WE1", onderdeel: "Dressuur", max_score: "", datum: "", jeugd: false });
      setEditingId(null);
      await fetchProeven();
      alert(editingId ? 'Proef bijgewerkt!' : 'Proef toegevoegd!');
    } catch (err) {
      console.error('Error:', err);
      alert('Fout: ' + err.message);
    }
    setLoading(false);
  }

  function handleEdit(proef) {
    if (proef.wedstrijd_id && proef.wedstrijd_id !== selectedWedstrijdId) {
      setSelectedWedstrijdId(proef.wedstrijd_id);
      setFilterWedstrijdId(proef.wedstrijd_id);
    }
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
    <div style={{ maxWidth: 900, margin: "30px auto", background: "#fff", padding: 30, borderRadius: 14, boxShadow: "0 3px 15px #1a2a4131", fontFamily: "system-ui, sans-serif" }}>
      <h2 style={{ fontWeight: 900, color: "#204574", marginBottom: 10 }}>Proefinstellingen</h2>
      <p style={{ marginTop: 0, color: "#667085" }}>
        {actieveWedstrijd ? `Actieve wedstrijd: ${actieveWedstrijd.naam}` : "Kies of selecteer eerst een wedstrijd om proeven gekoppeld te beheren."}
      </p>
      <div style={{ marginBottom: 18 }}>
        <label style={{ fontWeight: 700, display: "block", marginBottom: 8 }}>Wedstrijd</label>
        <select
          value={actieveWedstrijdId}
          onChange={(e) => {
            setFilterWedstrijdId(e.target.value);
            setSelectedWedstrijdId(e.target.value);
          }}
          style={{ padding: 11, fontSize: 16, borderRadius: 8, border: "1px solid #b3c1d1", width: "100%" }}
        >
          <option value="">Alle wedstrijden</option>
          {wedstrijden.map((wedstrijd) => (
            <option key={wedstrijd.id} value={wedstrijd.id}>
              {wedstrijd.naam} {wedstrijd.datum ? `(${wedstrijd.datum})` : ""}
            </option>
          ))}
        </select>
      </div>
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

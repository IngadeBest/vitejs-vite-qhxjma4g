import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useWedstrijdContext } from "@/features/wedstrijden/context/WedstrijdContext";
import "./ProefInstellingen.css";

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
    <div className="pi-page">
      <div className="pi-shell">
      <div className="pi-hero">
        <div>
          <h2>Proefinstellingen</h2>
          <p>
        {actieveWedstrijd ? `Actieve wedstrijd: ${actieveWedstrijd.naam}` : "Kies of selecteer eerst een wedstrijd om proeven gekoppeld te beheren."}
          </p>
        </div>
      </div>

      <section className="pi-card">
      <div className="pi-field">
        <label>Wedstrijd</label>
        <select
          className="pi-input"
          value={actieveWedstrijdId}
          onChange={(e) => {
            setFilterWedstrijdId(e.target.value);
            setSelectedWedstrijdId(e.target.value);
          }}
        >
          <option value="">Alle wedstrijden</option>
          {wedstrijden.map((wedstrijd) => (
            <option key={wedstrijd.id} value={wedstrijd.id}>
              {wedstrijd.naam} {wedstrijd.datum ? `(${wedstrijd.datum})` : ""}
            </option>
          ))}
        </select>
      </div>
      </section>

      <section className="pi-card">
      <div className="pi-form-grid">
        <input
          className="pi-input"
          name="naam"
          value={form.naam}
          onChange={e => setForm({ ...form, naam: e.target.value })}
          placeholder="Naam proef"
          disabled={loading}
        />
        <select
          className="pi-input"
          name="klasse"
          value={form.klasse}
          onChange={e => setForm({ ...form, klasse: e.target.value })}
          disabled={loading}
        >
          {klasses.map(k => <option key={k}>{k}</option>)}
        </select>
        <select
          className="pi-input"
          name="onderdeel"
          value={form.onderdeel}
          onChange={e => setForm({ ...form, onderdeel: e.target.value })}
          disabled={loading}
        >
          {onderdelen.map(o => <option key={o}>{o}</option>)}
        </select>
        {/* Alleen voor niet-Speedtrail */}
        {form.onderdeel !== "Speedtrail" && (
          <input
            className="pi-input"
            name="max_score"
            type="number"
            value={form.max_score}
            onChange={e => setForm({ ...form, max_score: e.target.value })}
            placeholder="Max punten"
            disabled={loading}
          />
        )}
        <input
          className="pi-input"
          name="datum"
          type="date"
          value={form.datum}
          onChange={e => setForm({ ...form, datum: e.target.value })}
          disabled={loading}
        />
        <label className="pi-check">
          <input
            type="checkbox"
            checked={form.jeugd}
            onChange={e => setForm({ ...form, jeugd: e.target.checked })}
            disabled={loading}
          />
          Jeugd rubriek
        </label>
        <button
          className="pi-button"
          onClick={handleAddOrUpdate}
          disabled={loading}
        >
          {editingId ? "Bijwerken" : "Toevoegen"}
        </button>
      </div>
      </section>

      <section className="pi-card pi-overview">
        <div className="pi-card-head">
          <h3>Overzicht</h3>
          <p>{proeven.length} proeven gevonden</p>
        </div>
        <div className="pi-table-wrap">
        <table className="pi-table">
          <thead>
            <tr>
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
        <div className="pi-mobile-list">
          {proeven.map((p) => (
            <article key={p.id} className="pi-mobile-card">
              <div className="pi-mobile-head">
                <div>
                  <strong>{p.naam}</strong>
                  <div className="pi-muted">{p.onderdeel}</div>
                </div>
                <div className="pi-badge">{p.max_score ?? "-"}</div>
              </div>
              <div className="pi-mobile-grid">
                <div><span>Klasse</span>{p.klasse}</div>
                <div><span>Datum</span>{p.datum || "-"}</div>
              </div>
              <div className="pi-actions">
                <button type="button" className="pi-link-button" onClick={() => handleEdit(p)} disabled={loading}>Bewerken</button>
                <button type="button" className="pi-link-button pi-link-danger" onClick={() => handleDelete(p.id)} disabled={loading}>Verwijderen</button>
              </div>
            </article>
          ))}
        </div>
      {loading && (
        <div className="pi-loading">
          Even geduld...
        </div>
      )}
      </section>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { HashRouter as Router, Routes, Route, Link } from 'react-router-dom';
import ScoreInvoer from './ScoreInvoer';

// --- RuiterInvoer component ---
function RuiterInvoer({ entries, setEntries }) {
  const [form, setForm] = useState({
    naam: '',
    paard: '',
    klasse: 'WE1',
    land: '',
  });
  const [error, setError] = useState('');

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleAdd = () => {
    if (!form.naam || !form.paard || !form.klasse) {
      setError('Vul alle verplichte velden in!');
      return;
    }
    setEntries([...entries, form]);
    setForm({ naam: '', paard: '', klasse: 'WE1', land: '' });
    setError('');
  };

  return (
    <div
      style={{
        background: '#f8faff',
        borderRadius: 12,
        boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
        padding: 32,
        maxWidth: 500,
        margin: '40px auto',
      }}
    >
      <h2 style={{ marginBottom: 18, fontSize: 26, color: '#1b3556' }}>
        Ruiter invoer
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <input
          name="naam"
          value={form.naam}
          onChange={handleChange}
          placeholder="Naam ruiter"
          style={{
            padding: 10,
            fontSize: 16,
            borderRadius: 7,
            border: '1px solid #b3c1d1',
          }}
        />
        <input
          name="paard"
          value={form.paard}
          onChange={handleChange}
          placeholder="Naam paard"
          style={{
            padding: 10,
            fontSize: 16,
            borderRadius: 7,
            border: '1px solid #b3c1d1',
          }}
        />
        <select
          name="klasse"
          value={form.klasse}
          onChange={handleChange}
          style={{
            padding: 10,
            fontSize: 16,
            borderRadius: 7,
            border: '1px solid #b3c1d1',
          }}
        >
          {['WE Intro', 'WE1', 'WE2', 'WE3', 'WE4'].map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
        <input
          name="land"
          value={form.land}
          onChange={handleChange}
          placeholder="Land"
          style={{
            padding: 10,
            fontSize: 16,
            borderRadius: 7,
            border: '1px solid #b3c1d1',
          }}
        />
        <button
          onClick={handleAdd}
          style={{
            marginTop: 8,
            background: '#246cff',
            color: '#fff',
            border: 'none',
            padding: '12px 0',
            fontSize: 17,
            borderRadius: 7,
            cursor: 'pointer',
            fontWeight: 'bold',
            boxShadow: '0 1px 5px #246cff33',
          }}
        >
          Toevoegen
        </button>
      </div>
      {error && <div style={{ color: 'red', marginTop: 12 }}>{error}</div>}

      {/* Per klasse overzicht */}
      <div style={{ marginTop: 36 }}>
        {['WE Intro', 'WE1', 'WE2', 'WE3', 'WE4'].map((klasse) => {
          const deelnemers = entries.filter((e) => e.klasse === klasse);
          if (deelnemers.length === 0) return null;
          return (
            <div key={klasse} style={{ marginBottom: 12 }}>
              <div
                style={{
                  fontWeight: 700,
                  color: '#205385',
                  margin: '14px 0 6px 0',
                  fontSize: 18,
                }}
              >
                {klasse}
              </div>
              <ul style={{ paddingLeft: 18 }}>
                {deelnemers.map((e, i) => (
                  <li key={i} style={{ fontSize: 16 }}>
                    {e.naam} met {e.paard} {e.land && `(${e.land})`}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Hoofdcomponent ---
export default function App() {
  const [entries, setEntries] = useState([]);

  return (
    <Router>
      <nav
        style={{
          background: '#204574',
          padding: '16px 0 15px 0',
          marginBottom: 0,
          boxShadow: '0 2px 10px #0001',
          textAlign: 'center',
        }}
      >
        <Link
          to="/"
          style={{
            color: '#fff',
            margin: '0 25px',
            fontSize: 19,
            fontWeight: 'bold',
            textDecoration: 'none',
            letterSpacing: 1.5,
          }}
        >
          Ruiters
        </Link>
        <Link
          to="/score"
          style={{
            color: '#fff',
            margin: '0 25px',
            fontSize: 19,
            fontWeight: 'bold',
            textDecoration: 'none',
            letterSpacing: 1.5,
          }}
        >
          Score-invoer
        </Link>
      </nav>
      <Routes>
        <Route
          path="/"
          element={<RuiterInvoer entries={entries} setEntries={setEntries} />}
        />
        <Route path="/score" element={<ScoreInvoer entries={entries} />} />
      </Routes>
    </Router>
  );
}

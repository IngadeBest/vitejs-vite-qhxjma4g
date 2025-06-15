import { useState } from 'react';

const klassen = ['WE Intro', 'WE1', 'WE2', 'WE3', 'WE4'];
const onderdelen = ['Dressuur', 'Stijltrail', 'Speedtrail'];

const kleuren = {
  hoofd: '#204574',
  accent: '#3a8bfd',
  dq: '#ffe2e2',
};

export default function ScoreInvoer({ entries }) {
  const [selectedKlasse, setSelectedKlasse] = useState(klassen[0]);
  const [selectedOnderdeel, setSelectedOnderdeel] = useState(onderdelen[0]);
  const [maxScore, setMaxScore] = useState('');
  const [scores, setScores] = useState({});
  const [saved, setSaved] = useState(false);

  const deelnemers = entries.filter((e) => e.klasse === selectedKlasse);

  const handleScoreChange = (naam, paard, value) => {
    setScores((scores) => {
      const isDQ = value === '0';
      return {
        ...scores,
        [naam + paard]: {
          ...scores[naam + paard],
          score: value,
          dq: isDQ ? true : scores[naam + paard]?.dq || false,
        },
      };
    });
  };

  const handleDQChange = (naam, paard, checked) => {
    setScores((scores) => ({
      ...scores,
      [naam + paard]: {
        ...scores[naam + paard],
        dq: checked,
        score: checked ? '0' : scores[naam + paard]?.score || '',
      },
    }));
  };

  function berekenKlassement() {
    if (!maxScore || !deelnemers.length) return [];

    let lijst = deelnemers.map((e) => {
      const data = scores[e.naam + e.paard] || {};
      let score = Number(data.score) || 0;
      let dq = !!data.dq || score === 0;
      let perc = dq ? 0 : Math.round((score / maxScore) * 1000) / 10;
      return {
        naam: e.naam,
        paard: e.paard,
        dq,
        score,
        percentage: perc,
      };
    });

    lijst = lijst.sort((a, b) => a.dq - b.dq || b.percentage - a.percentage);
    const totaalDeelnemers = lijst.filter((l) => !l.dq).length;
    lijst.forEach((item, i) => {
      if (item.dq) item.punten = 0;
      else item.punten = totaalDeelnemers - i + 1;
    });

    return lijst;
  }

  const klassement = berekenKlassement();

  return (
    <div
      style={{
        padding: '40px 0',
        background: '#f5f7fb',
        minHeight: '100vh',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: 700,
          background: '#fff',
          borderRadius: 15,
          boxShadow: '0 4px 24px #2c466622',
          margin: '0 auto',
          padding: '36px 28px 28px 28px',
        }}
      >
        <h2
          style={{
            fontSize: 29,
            color: kleuren.hoofd,
            fontWeight: 900,
            marginBottom: 25,
            letterSpacing: 1.3,
            textTransform: 'uppercase',
          }}
        >
          Score-invoer
        </h2>
        <div
          style={{
            marginBottom: 18,
            display: 'flex',
            gap: 24,
            flexWrap: 'wrap',
          }}
        >
          <label style={{ fontWeight: 600, color: kleuren.hoofd }}>
            Klasse:{' '}
            <select
              value={selectedKlasse}
              onChange={(e) => {
                setSelectedKlasse(e.target.value);
                setScores({});
                setSaved(false);
              }}
              style={{
                fontSize: 17,
                padding: '5px 16px',
                borderRadius: 8,
                border: '1px solid #b3c1d1',
                background: '#fafdff',
              }}
            >
              {klassen.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </label>
          <label style={{ fontWeight: 600, color: kleuren.hoofd }}>
            Onderdeel:{' '}
            <select
              value={selectedOnderdeel}
              onChange={(e) => {
                setSelectedOnderdeel(e.target.value);
                setScores({});
                setSaved(false);
              }}
              style={{
                fontSize: 17,
                padding: '5px 16px',
                borderRadius: 8,
                border: '1px solid #b3c1d1',
                background: '#fafdff',
                textTransform: 'capitalize',
              }}
            >
              {onderdelen.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
          <label style={{ fontWeight: 600, color: kleuren.hoofd }}>
            Max. punten:{' '}
            <input
              type="number"
              value={maxScore}
              onChange={(e) => setMaxScore(Number(e.target.value))}
              min={1}
              style={{
                fontSize: 17,
                padding: '5px 10px',
                borderRadius: 8,
                border: '1px solid #b3c1d1',
                width: 80,
              }}
            />
          </label>
        </div>
        {/* Invoertabel */}
        <table
          style={{
            width: '100%',
            borderCollapse: 'separate',
            borderSpacing: '0 7px',
            background: '#fafdff',
            borderRadius: 9,
            overflow: 'hidden',
            marginBottom: 30,
          }}
        >
          <thead>
            <tr style={{ background: kleuren.accent, color: '#fff' }}>
              <th
                style={{ borderRadius: '9px 0 0 0', padding: 9, fontSize: 16 }}
              >
                Ruiter
              </th>
              <th style={{ padding: 9, fontSize: 16 }}>Paard</th>
              <th style={{ padding: 9, fontSize: 16 }}>Score</th>
              <th
                style={{ borderRadius: '0 9px 0 0', padding: 9, fontSize: 16 }}
              >
                DQ
              </th>
            </tr>
          </thead>
          <tbody>
            {deelnemers.map((e) => {
              const key = e.naam + e.paard;
              const data = scores[key] || {};
              return (
                <tr key={key} style={data.dq ? { background: kleuren.dq } : {}}>
                  <td style={{ padding: 8, fontWeight: 500 }}>{e.naam}</td>
                  <td style={{ padding: 8 }}>{e.paard}</td>
                  <td style={{ padding: 8 }}>
                    <input
                      type="number"
                      value={data.score || ''}
                      onChange={(ev) =>
                        handleScoreChange(e.naam, e.paard, ev.target.value)
                      }
                      disabled={data.dq}
                      style={{
                        fontSize: 16,
                        width: 64,
                        padding: '6px 10px',
                        borderRadius: 8,
                        border: '1px solid #b3c1d1',
                        background: data.dq ? '#eee' : '#fff',
                      }}
                    />
                  </td>
                  <td style={{ padding: 8, textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={!!data.dq}
                      onChange={(ev) =>
                        handleDQChange(e.naam, e.paard, ev.target.checked)
                      }
                      style={{ width: 22, height: 22 }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {/* Tussenstand */}
        <h3
          style={{
            marginTop: 0,
            marginBottom: 12,
            color: kleuren.accent,
            textTransform: 'uppercase',
            fontWeight: 700,
            fontSize: 20,
            letterSpacing: 1,
          }}
        >
          Tussenstand
        </h3>
        <table
          style={{
            width: '100%',
            borderCollapse: 'separate',
            borderSpacing: '0 5px',
            background: '#fafdff',
            borderRadius: 8,
            overflow: 'hidden',
            marginBottom: 10,
          }}
        >
          <thead>
            <tr style={{ background: '#d3e6fd', color: '#174174' }}>
              <th style={{ borderRadius: '8px 0 0 0', padding: 8 }}>Rang</th>
              <th style={{ padding: 8 }}>Ruiter</th>
              <th style={{ padding: 8 }}>Paard</th>
              <th style={{ padding: 8 }}>% Score</th>
              <th style={{ borderRadius: '0 8px 0 0', padding: 8 }}>Punten</th>
            </tr>
          </thead>
          <tbody>
            {klassement.map((item, i) => (
              <tr
                key={item.naam + item.paard}
                style={
                  item.dq ? { color: '#a87c7c', background: '#fff2f2' } : {}
                }
              >
                <td style={{ padding: 8, fontWeight: 700 }}>
                  {item.dq ? 'DQ' : i + 1}
                </td>
                <td style={{ padding: 8 }}>{item.naam}</td>
                <td style={{ padding: 8 }}>{item.paard}</td>
                <td style={{ padding: 8 }}>{item.percentage}%</td>
                <td style={{ padding: 8, fontWeight: 700 }}>{item.punten}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* Knoppen */}
        <div style={{ marginTop: 20 }}>
          <button
            onClick={() => setSaved(true)}
            disabled={saved}
            style={{
              background: kleuren.accent,
              color: '#fff',
              border: 'none',
              padding: '13px 32px',
              fontSize: 17,
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 'bold',
              boxShadow: '0 1px 7px #3a8bfd33',
              marginRight: 10,
              letterSpacing: 1,
            }}
          >
            💾 Opslaan
          </button>
          <button
            onClick={() => {
              setScores({});
              setSaved(false);
            }}
            disabled={Object.keys(scores).length === 0}
            style={{
              background: '#eee',
              color: '#1a2b44',
              border: 'none',
              padding: '13px 24px',
              fontSize: 16,
              borderRadius: 8,
              cursor:
                Object.keys(scores).length === 0 ? 'not-allowed' : 'pointer',
              fontWeight: 500,
            }}
          >
            Herstel wijzigingen
          </button>
          {saved && (
            <span style={{ marginLeft: 22, color: 'green', fontWeight: 700 }}>
              Opgeslagen!
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

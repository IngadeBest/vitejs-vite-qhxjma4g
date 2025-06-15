import { useState } from 'react';

const proefTypes = ['dressuur', 'stijltrail', 'speedtrail'];
const klassen = ['WE Intro', 'WE1', 'WE2', 'WE3', 'WE4'];

// Het hoofdcomponent
function ProefInstellingen({ proeven, setProeven }) {
  // Initialiseer state per combinatie type+klasse
  const [form, setForm] = useState({});

  // Handlers
  const handleChange = (type, klasse, veld, waarde) => {
    setForm((f) => ({
      ...f,
      [type]: {
        ...(f[type] || {}),
        [klasse]: {
          ...(f[type]?.[klasse] || {}),
          [veld]: waarde,
        },
      },
    }));
  };

  const handleOpslaan = (type, klasse) => {
    const entry = form[type]?.[klasse];
    if (!entry || !entry.maxPunten || !entry.jury || !entry.datum) return;
    // Voeg toe aan proeven-array als uniek type+klasse
    setProeven((p) => [
      ...p.filter((e) => !(e.type === type && e.klasse === klasse)),
      { type, klasse, ...entry },
    ]);
  };

  return (
    <div style={{ padding: '1rem' }}>
      <h2>Proefinstellingen per type en klasse</h2>
      {proefTypes.map((type) => (
        <div key={type} style={{ marginTop: 24, marginBottom: 8 }}>
          <h3 style={{ marginBottom: 8, color: '#246' }}>
            {type[0].toUpperCase() + type.slice(1)}
          </h3>
          <table>
            <thead>
              <tr>
                <th>Klasse</th>
                <th>Max punten</th>
                <th>Jury</th>
                <th>Datum</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {klassen.map((klasse) => {
                // Speedtrail alleen bij WE2, WE3, WE4
                if (
                  type === 'speedtrail' &&
                  !['WE2', 'WE3', 'WE4'].includes(klasse)
                )
                  return null;
                const waarde = form[type]?.[klasse] || {};
                return (
                  <tr key={klasse}>
                    <td>{klasse}</td>
                    <td>
                      <input
                        type="number"
                        value={waarde.maxPunten || ''}
                        placeholder="max"
                        onChange={(e) =>
                          handleChange(
                            type,
                            klasse,
                            'maxPunten',
                            e.target.value
                          )
                        }
                        disabled={type === 'speedtrail'} // Speedtrail heeft geen max punten
                      />
                    </td>
                    <td>
                      <input
                        value={waarde.jury || ''}
                        placeholder="jury"
                        onChange={(e) =>
                          handleChange(type, klasse, 'jury', e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="date"
                        value={waarde.datum || ''}
                        onChange={(e) =>
                          handleChange(type, klasse, 'datum', e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <button onClick={() => handleOpslaan(type, klasse)}>
                        Opslaan
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {/* Overzicht van opgeslagen proeven per type */}
          <ul style={{ marginTop: 12 }}>
            {proeven
              .filter((p) => p.type === type)
              .map((p, i) => (
                <li key={i} style={{ fontSize: '0.95em' }}>
                  {p.klasse}: {p.datum}, jury: {p.jury}
                  {type !== 'speedtrail' && `, max: ${p.maxPunten}`}
                </li>
              ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default ProefInstellingen;

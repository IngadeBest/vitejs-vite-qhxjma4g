import React, { useEffect, useMemo } from 'react';

// Simple, self-contained Proef editor used by WedstrijdenBeheer.
// Props:
// - cfg, setCfg: local config state (onderdeel, klasse, proef_naam, max_score, items_text)
// - saveProef: async save handler
// - gekozen: selected wedstrijd (optional)
// Behaviour:
// - auto-suggest proef_naam based on onderdeel + klasse + item-count (e.g. "Dressuur WE1 7-12")

export default function ProefEditor({ cfg, setCfg, saveProef, gekozen }) {
  const itemRows = useMemo(() => (cfg.items_text || '').split('\n').map(r => r.trim()).filter(Boolean), [cfg.items_text]);

  useEffect(() => {
    // if proef_naam is empty, suggest a name when onderdeel/klasse/items change
    if (!cfg.proef_naam) {
      const onderdeelLabel = cfg.onderdeel === 'dressuur' ? 'Dressuur' : (cfg.onderdeel === 'stijl' ? 'Stijltrail' : 'Speedtrail');
      const klasseLabel = (cfg.klasse || '').toUpperCase();
      const count = itemRows.length || 0;
      // If wedstrijd datum available, format as dd-mm
      let datePart = '';
      try {
        if (gekozen && gekozen.datum) {
          const d = new Date(gekozen.datum);
          if (!isNaN(d)) {
            const dd = String(d.getDate()).padStart(2, '0');
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            datePart = `${dd}-${mm}`;
          }
        }
      } catch (_) { datePart = ''; }

      let suggestion;
      if (datePart) {
        suggestion = `${onderdeelLabel} ${klasseLabel} ${datePart}`.trim();
      } else {
        // fallback to previous range-style suggestion
        const range = count >= 2 && count <= 20 ? `${Math.max(1,count-2)}-${count+2}` : `${Math.max(1,count)}`;
        suggestion = `${onderdeelLabel} ${klasseLabel} ${range}`.trim();
      }
      setCfg(s => ({ ...s, proef_naam: suggestion }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.onderdeel, cfg.klasse, cfg.items_text]);

  return (
    <section style={{border:"1px solid #eee", borderRadius:12, padding:12}}>
      <h3>Proeven & max scores</h3>
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:8, alignItems:"center"}}>
        <label style={{gridColumn:'1'}}>Onderdeel</label>
        <select value={cfg.onderdeel} onChange={(e)=>setCfg(s=>({...s, onderdeel:e.target.value}))}>
          <option value="dressuur">Dressuur</option>
          <option value="stijl">Stijltrail</option>
          <option value="speed">Speedtrail</option>
        </select>
        <label style={{gridColumn:'3'}}>Klasse</label>
        <select value={cfg.klasse} onChange={(e)=>setCfg(s=>({...s, klasse:e.target.value}))}>
          <option value="we1">WE1</option>
          <option value="we2">WE2</option>
          <option value="we3">WE3</option>
          <option value="we4">WE4</option>
        </select>

        <label>Naam/proefcode*</label>
        <input placeholder="Bijv. WE1-A, Stijltrail-1, Speedtrail-1" value={cfg.proef_naam} onChange={(e)=>setCfg(s=>({...s, proef_naam:e.target.value}))}/>

        <label>Max. score (optioneel)</label>
        <input type="number" placeholder="Bijv. 200" value={cfg.max_score} onChange={(e)=>setCfg(s=>({...s, max_score:e.target.value}))}/>

        <div></div><div></div>
      </div>

      <div style={{marginTop:8}}>
        <label style={{display:"block", fontWeight:600}}>Onderdelen van de proef</label>
        <div style={{fontSize:12,color:"#666",margin:"4px 0 8px"}}>
          <b>Dressuur:</b> per regel: <code>omschrijving | max | coeff</code><br/>
          <b>Stijl/Speed:</b> per regel één obstakel of element.
        </div>
        <textarea rows={8} style={{width:"100%"}} value={cfg.items_text} onChange={(e)=>setCfg(s=>({...s, items_text:e.target.value}))}/>
      </div>

      <div style={{marginTop:8}}>
        <button onClick={saveProef} disabled={!gekozen}>Opslaan</button>
      </div>
    </section>
  );
}

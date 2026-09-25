import ProtocolCalculator from '../components/ProtocolCalculator';
import { calculatorRows, calculateProtocol } from '../protocolCalculator';
import { loadScoreData } from '../scoreData';
import { calculateStandings } from '@/rules/weh/rankings';
import { validateScoreEntry } from '@/rules/weh/scoreEntry';
import { WEH_METADATA } from "@/rules/weh/metadata";
import { resultClassKey, classLabel, normalizeComponent } from "@/rules/weh/classes";
import { parseTime as parseTimeString, formatTime, speedTime, resultStatus } from "@/rules/weh/scoring";
import { validateTotal } from "@/rules/weh/validation";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useWedstrijdContext } from "@/features/wedstrijden/context/WedstrijdContext";
import "./ScoreInvoer.css";

const onderdelen = ["Dressuur", "Stijltrail", "Speedtrail"];

export default function ScoreInvoer() {
  const { selectedWedstrijdId: activeWedstrijdId, selectedWedstrijd } = useWedstrijdContext();
  const [ruiters, setRuiters] = useState([]);
  const [proeven, setProeven] = useState([]);
  const [scores, setScores] = useState([]);
  const [selectedKlasse, setSelectedKlasse] = useState("");
  const [selectedOnderdeel, setSelectedOnderdeel] = useState("");
  const [selectedProef, setSelectedProef] = useState(null);
  const [selectedRuiter, setSelectedRuiter] = useState("");
  const [scoreInput, setScoreInput] = useState("");
  const [dq, setDQ] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const saveInFlight = useRef(false);
  const [saving, setSaving] = useState(false);
  const [advancedStorage, setAdvancedStorage] = useState(false);
  const [status, setStatus] = useState('completed');
  const [penaltyInput, setPenaltyInput] = useState('0');
  const [bonusInput, setBonusInput] = useState('0');
  const [correctionReason, setCorrectionReason] = useState('');
  const [speedBreakdown, setSpeedBreakdown] = useState(true);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [marks, setMarks] = useState([]);
  const [deduction, setDeduction] = useState('0');
  const [scoreDetails, setScoreDetails] = useState(null);
  const [editingRevision, setEditingRevision] = useState(null);
  let rows=[], calculatorError='';
  if(selectedProef && selectedOnderdeel !== 'Speedtrail') {
    try { rows=calculatorRows(selectedProef,selectedWedstrijd?.protocol_config || {}); }
    catch(e){calculatorError=e.message;}
  }
  useEffect(()=>{
    const options=proeven.filter(p=>p.klasse===selectedKlasse && p.onderdeel===selectedOnderdeel);
    if(options.length===1) setSelectedProef(options[0]);
  },[proeven,selectedKlasse,selectedOnderdeel]);
  useEffect(()=>{setCalculatorOpen(Boolean(selectedProef && selectedOnderdeel !== 'Speedtrail'));setMarks([]);setDeduction('0');setScoreDetails(null);},[selectedProef?.id]);
  useEffect(() => {
    let alive = true;
    supabase.from('scores').select('result_status, ridden_time, penalty_seconds, bonus_seconds, score_details, score_revision').limit(0)
      .then(({ error }) => { if (alive) setAdvancedStorage(!error); });
    return () => { alive = false; };
  }, []);


  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    loadScoreData(supabase, activeWedstrijdId).then(({participants,tests,scores})=>{
      if(cancelled) return;
      setRuiters(participants); setProeven(tests); setScores(scores);
    }).catch(e=>{if(!cancelled){setError(e.message);setRuiters([]);setProeven([]);setScores([]);}})
      .finally(()=>{if(!cancelled)setLoading(false);});
    return ()=>{cancelled=true;};
  }, [activeWedstrijdId,refresh]);
  const fetchScores = () => setRefresh(n=>n+1);
  let calculatedPreview=null;
  if(calculatorOpen && rows.length) {try {calculatedPreview=calculateProtocol(rows,rows.map((_,i)=>marks[i] ?? ''),deduction);}catch{ /* Incomplete input stays blank. */ }}
  function resetForm() {
    setSelectedRuiter("");
    setScoreInput("");
    setDQ(false);
    setStatus('completed'); setPenaltyInput('0'); setBonusInput('0'); setCorrectionReason(''); setSpeedBreakdown(true);
    setEditingId(null); setEditingRevision(null); setCalculatorOpen(selectedOnderdeel !== 'Speedtrail'); setMarks(rows.map(()=>'')); setDeduction('0'); setScoreDetails(null);
    setError(""); setSuccess('');
  }
  function getProefOpties() {
    return proeven.filter(
      (p) =>
        p.klasse === selectedKlasse &&
        p.onderdeel === selectedOnderdeel
    );
  }
  function getMaxScore() {
    if (selectedProef && selectedProef.max_score) {
      return selectedProef.max_score;
    }
    return "";
  }
  function getRuitersVoorKlasse() {
    if (!selectedProef) return [];
    return ruiters.filter(r => resultClassKey(r.klasse, r.rubriek) === resultClassKey(selectedProef.klasse));
  }

  async function handleOpslaan() {
    if (saveInFlight.current) return;
    if (!selectedProef || !selectedRuiter) {
      setError("Kies proef en ruiter!");
      return;
    }
    if ((!advancedStorage ? !dq : ['completed','hors_concours'].includes(status)) && !calculatorOpen && String(scoreInput).trim() === '') {
      setError("Vul score/tijd in of vink DQ aan.");
      return;
    }
    setError("");
    saveInFlight.current = true; setSaving(true);
    try {
      const calculated = calculatorOpen && ['completed','hors_concours'].includes(status) ? calculateProtocol(rows,rows.map((_,i)=>marks[i] ?? ''),deduction) : null;
      let insertObj = {
        wedstrijd_id: activeWedstrijdId,
        proef_id: selectedProef.id,
        ruiter_id: selectedRuiter,
        dq: dq,
      };
      const completed = advancedStorage ? ['completed','hors_concours'].includes(status) : !dq;
      if (advancedStorage) {
        insertObj.result_status = status;
        insertObj.dq = status === 'disqualified';
        insertObj.rules_version = WEH_METADATA.rulebookVersion;
        insertObj.score_details = calculated?.details || scoreDetails;
      }
      if (selectedOnderdeel === "Speedtrail") {
        insertObj.score = completed ? parseTimeString(scoreInput) : null;
        if (advancedStorage && speedBreakdown && completed) {
          const penalty = parseTimeString(penaltyInput), bonus = parseTimeString(bonusInput);
          if ((penalty || bonus) && !correctionReason.trim()) { setError('Vermeld de reden en jurybeslissing voor straf/bonus.'); return; }
          insertObj.ridden_time = parseTimeString(scoreInput);
          insertObj.penalty_seconds = penalty;
          insertObj.bonus_seconds = bonus;
          insertObj.score = speedTime(insertObj.ridden_time, penalty, bonus);
          insertObj.rule_events = correctionReason ? [{ kind: 'jury_record', reason: correctionReason, penaltySeconds: penalty, bonusSeconds: bonus }] : [];
        } else if (advancedStorage) {
          insertObj.ridden_time = null; insertObj.penalty_seconds = null; insertObj.bonus_seconds = null; insertObj.rule_events = null;
        }
      } else {
        insertObj.score = completed ? (calculated?.score ?? Number(String(scoreInput).replace(',', '.'))) : null;
      }
      
      if (completed) {
        const validation = validateTotal({ klasse: selectedProef.klasse, onderdeel: selectedOnderdeel, score: insertObj.score, max_score: selectedProef.max_score });
        if (!validation.valid) { setError(validation.errors.join(' ')); return; }
      }
      if (advancedStorage && completed) {
        const {data: previous, error: previousError} = await supabase.from('scores')
          .select('id, proef_id, result_status').eq('wedstrijd_id', activeWedstrijdId).eq('ruiter_id', selectedRuiter);
        if (previousError) throw previousError;
        const order = ['Dressuur', 'Stijltrail', 'Speedtrail'];
        const eliminatedBefore = (previous || []).some(s => s.result_status === 'eliminated' && String(s.id) !== String(editingId) &&
          order.indexOf(proeven.find(p => String(p.id) === String(s.proef_id))?.onderdeel) >= 0 &&
          order.indexOf(proeven.find(p => String(p.id) === String(s.proef_id))?.onderdeel) < order.indexOf(selectedOnderdeel));
        if (eliminatedBefore) throw new Error('Deze deelnemer is in een eerder onderdeel geëlimineerd. Corrigeer eerst die jurybeslissing als deze onjuist is.');
      }
      const check = validateScoreEntry({ record: insertObj, test: selectedProef,
        participant: getRuitersVoorKlasse().find(r => String(r.id) === String(selectedRuiter)),
        competitionId: activeWedstrijdId, existingScores: scores, editingId });
      if (!check.valid) throw new Error(check.errors.join(' '));
      let result;
      if (editingId) {
        result = await supabase.from("scores").update({...insertObj,score_revision:editingRevision+1}).eq("id", editingId).eq("proef_id", selectedProef.id).eq('score_revision',editingRevision).select('id').maybeSingle();
        if(!result.error && !result.data) throw new Error('Deze score is intussen gewijzigd. Ververs de scores en open de nieuwste versie voordat je opnieuw opslaat.');
      } else {
        result = await supabase.from("scores").insert([insertObj]).select('id').single();
      }
      
      if (result.error) {
        console.error('Database error:', result.error);
        setError("Database fout: " + result.error.message);
        return;
      }
      
      console.log('Score saved successfully:', result);
      resetForm();
      setSuccess('Score opgeslagen.');
      fetchScores();
    } catch (err) {
      console.error('Save error:', err);
      setError("Fout bij opslaan: " + (err.message || String(err)));
    } finally {
      saveInFlight.current = false; setSaving(false);
    }
  }
  function handleEdit(score) {
    setEditingId(score.id); setEditingRevision(score.score_revision ?? 0);
    setScoreDetails(score.score_details || null);
    setMarks(score.score_details?.items?.map(r=>String(r.mark)) || []);
    setDeduction(String(score.score_details?.deduction ?? 0));
    setCalculatorOpen(Boolean(score.score_details));
    setSelectedRuiter(score.ruiter_id);
    // Tijd als string tonen bij Speedtrail
    setScoreInput(
      selectedOnderdeel === "Speedtrail"
        ? formatTime(score.score)
        : (score.score ?? "")
    );
    setDQ(!['completed','hors_concours'].includes(resultStatus(score)));
    setStatus(resultStatus(score));
    setSpeedBreakdown(score.ridden_time != null);
    setPenaltyInput(String(score.penalty_seconds ?? 0)); setBonusInput(String(score.bonus_seconds ?? 0));
    setCorrectionReason(score.rule_events?.map(e=>e.reason || e.id).join('; ') || '');
    if (selectedOnderdeel === 'Speedtrail' && score.ridden_time != null) setScoreInput(formatTime(Number(score.ridden_time)));
    setError("");
  }
  let klassement = [], rankingError = '';
  if(selectedProef) {
    try {
      const standing = calculateStandings({klasse:selectedProef.klasse,participants:ruiters,tests:proeven,scores});
      klassement = standing.eindstand.map(p=>{
        const result=p.onderdelen[selectedOnderdeel];
        const saved=scores.find(s=>String(s.proef_id)===String(selectedProef.id) && String(s.ruiter_id)===String(p.id));
        return {...saved, ruiter_id:p.id, naam:p.naam, paard:p.paard, startnummer:p.startnummer,
          plaats:result?.plaats || ({disqualified:'DQ',eliminated:'EL',not_started:'NS',hors_concours:'HC',pending:'—'})[result?.status],
          punten: result?.plaatsingspunten ?? 0, scoreLabel:result?.scoreLabel};
      });
    }catch(e){rankingError=e.message;}
  }

  return (
    <div className="si-page">
      <div className="si-shell">
      {loading && <p role="status">Scores laden…</p>}
      <fieldset disabled={saving || loading} style={{border:0,padding:0,margin:0,minWidth:0}}>
        <div className="si-hero">
          <h2>Score-invoer</h2>
          <div className="si-note">
          {selectedWedstrijd ? `Actieve wedstrijd: ${selectedWedstrijd.naam}` : "Geen actieve wedstrijd geselecteerd"}
          </div>
        </div>

        <section className="si-card">
        <div className="si-form-grid">
          <label className="si-field">
            <span>Klasse</span>
            <select className="si-input" value={selectedKlasse} onChange={e => {
              setSelectedKlasse(e.target.value);
              setSelectedOnderdeel("");
              setSelectedProef(null);
              resetForm();
            }}>
              <option value="">--</option>
              {[...new Set(proeven.map(p => p.klasse))].map(k => <option key={k}>{k}</option>)}
            </select>
          </label>
          <label className="si-field">
            <span>Onderdeel</span>
            <select className="si-input" value={selectedOnderdeel} onChange={e => {
              setSelectedOnderdeel(e.target.value);
              setSelectedProef(null);
              resetForm();
            }}>
              <option value="">--</option>
              {onderdelen.filter(o=>proeven.some(p=>p.klasse===selectedKlasse && p.onderdeel===o)).map(o => <option key={o}>{o}</option>)}
            </select>
          </label>
          <label className="si-field si-span-2">
            <span>Proef</span>
            <select className="si-input" value={selectedProef?.id || ""} onChange={e => {
              const proef = proeven.find(p => p.id === Number(e.target.value));
              setSelectedProef(proef || null);
              resetForm();
            }}>
              <option value="">---</option>
              {getProefOpties().map(p =>
                <option key={p.id} value={p.id}>
                  {p.naam} ({p.datum})
                </option>
              )}
            </select>
          </label>
        </div>
        </section>

        <section className="si-card">
        <div className="si-form-grid si-form-grid-actions">
          <label className="si-field si-span-2">
            <span>Ruiter</span>
            <select className="si-input" value={selectedRuiter} disabled={editingId != null} onChange={e => { const id=e.target.value; resetForm(); const previous=scores.find(s=>String(s.proef_id)===String(selectedProef?.id) && String(s.ruiter_id)===id); if(previous) handleEdit(previous); else setSelectedRuiter(id); }}>
              <option value="">---</option>
              {getRuitersVoorKlasse().map(r =>
                <option key={r.id} value={r.id}>{r.startnummer} · {r.naam} met {r.paard}</option>
              )}
            </select>
          </label>
          <label className="si-field">
            <span>{selectedOnderdeel === "Speedtrail" ? (advancedStorage && speedBreakdown ? "Gereden tijd (mm:ss:hh)" : "Eindtijd inclusief straf/bonus") : "Eindscore na puntenaftrek"}</span>
            {selectedOnderdeel === "Speedtrail" ? (
              <input
                className="si-input"
                type="text"
                pattern="[0-9]{2}:[0-9]{2}(:[0-9]{2})?"
                value={scoreInput}
                onChange={e => {setScoreInput(e.target.value);setScoreDetails(null);setCalculatorOpen(false);}}
                placeholder="02:35:09"
                disabled={dq}
              />
            ) : (
              <input
                className="si-input"
                type="text" inputMode="decimal"
                readOnly={calculatorOpen}
                value={calculatorOpen ? (calculatedPreview?.score ?? "") : scoreInput}
                onChange={e => {setScoreInput(e.target.value);setScoreDetails(null);setCalculatorOpen(false);}}
                disabled={dq}
              />
            )}
            {selectedOnderdeel !== "Speedtrail" && selectedProef && selectedProef.max_score ? (
              <span className="si-max-score">
                / {selectedProef.max_score}
              </span>
            ) : null}
          </label>
          {advancedStorage ? <>
            <label className="si-field"><span>Resultaatstatus</span><select className="si-input" value={status} onChange={e=>{setStatus(e.target.value); setDQ(!['completed','hors_concours'].includes(e.target.value));}}>
              <option value="completed">Uitgereden</option><option value="disqualified">Diskwalificatie (dit onderdeel)</option>
              <option value="eliminated">Eliminatie (wedstrijd)</option><option value="not_started">Vrijwillig niet gestart</option><option value="hors_concours">Buiten mededinging</option>
            </select></label>
            {selectedOnderdeel === 'Speedtrail' && ['completed','hors_concours'].includes(status) && <>
              <label className="si-check"><input type="checkbox" checked={speedBreakdown} onChange={e=>setSpeedBreakdown(e.target.checked)}/>Gereden tijd, straf en bonus afzonderlijk vastleggen</label>
              {speedBreakdown && <>
                <label className="si-field"><span>Straftijd (+ seconden)</span><input className="si-input" value={penaltyInput} onChange={e=>setPenaltyInput(e.target.value)}/></label>
                <label className="si-field"><span>Bonustijd (- seconden)</span><input className="si-input" value={bonusInput} onChange={e=>setBonusInput(e.target.value)}/></label>
                <label className="si-field"><span>Reden / beslissing jury</span><input className="si-input" value={correctionReason} onChange={e=>setCorrectionReason(e.target.value)}/></label>
              </>}
            </>}
          </> : <label className="si-check"><input type="checkbox" checked={dq} onChange={e=>setDQ(e.target.checked)}/><span>DQ</span></label>}
          <button className="si-button" onClick={handleOpslaan} disabled={saving}>
            {saving ? "Bezig met opslaan…" : editingId ? "Bijwerken" : "Opslaan"}
          </button>
        </div>
        {!advancedStorage && <p role="status">Uitgebreide scoreopslag is nog niet beschikbaar. Alleen eindscore/eindtijd en DQ kunnen worden opgeslagen; eliminatie, niet gestart en losse correcties nog niet.</p>}
        {success && <p role="status">{success}</p>}
        {editingId != null && <button className="si-link-button" onClick={resetForm}>Bewerken annuleren</button>}
        {error && <div role="alert" className="si-error">{error}</div>}
        {rankingError && <div role="alert" className="si-error">{rankingError}</div>}
        </section>

        {selectedProef && selectedOnderdeel !== 'Speedtrail' && advancedStorage && <>
          <button className="si-button" onClick={()=>{if(calculatorOpen && calculatedPreview){setScoreInput(String(calculatedPreview.score));setScoreDetails(calculatedPreview.details);}setCalculatorOpen(v=>!v);if(!marks.length)setMarks(rows.map(()=>''));}}>{calculatorOpen ? 'Alleen een totaalscore invoeren' : 'Alle protocolcijfers invoeren'}</button>
          {calculatorError && <p role="alert">{calculatorError}</p>}
          {calculatorOpen && rows.length>0 && <ProtocolCalculator rows={rows} values={rows.map((_,i)=>marks[i] ?? '')} deduction={deduction} onSave={handleOpslaan}
            onChange={(index,value)=>{setMarks(old=>rows.map((_,i)=>i===index?value:(old[i] ?? '')));setScoreDetails(null);}}
            onDeduction={value=>{setDeduction(value);setScoreDetails(null);}}
            onApply={result=>{setScoreInput(String(result.score));setScoreDetails(result.details);setSuccess('Totaal overgenomen. Klik op Opslaan om de score en cijfers te bewaren.');}}/>}
        </>}
        <button className="si-link-button" onClick={()=>{resetForm();fetchScores();}}>Scores verversen</button>
        <section className="si-card si-overview">
        <div className="si-card-head">
          <h3>
          Tussenstand {selectedKlasse && `${selectedKlasse}`} {selectedOnderdeel && `– ${selectedOnderdeel}`}
          </h3>
        </div>
        <div className="si-table-wrap">
        <table className="si-table">
          <thead>
            <tr>
              <th>Plaats</th>
              <th>Ruiter</th>
              <th>Paard</th>
              <th>{selectedOnderdeel === "Speedtrail" ? "Tijd" : "Score"}</th>
              <th>Punten</th>
              <th>Acties</th>
            </tr>
          </thead>
          <tbody>
            {klassement.length === 0 ? (
              <tr>
                <td colSpan={6} className="si-empty">
                  Nog geen scores ingevoerd voor deze proef/klasse.
                </td>
              </tr>
            ) : (
              klassement.map(item => (
                <tr key={item.id || item.ruiter_id}>
                  <td>{item.plaats}</td>
                  <td>{item.startnummer} · {item.naam}</td>
                  <td>{item.paard}</td>
                  <td>{item.scoreLabel}</td>
                  <td className="si-strong">{item.punten}</td>
                  <td>
                    <div className="si-actions">
                      <button type="button" className="si-link-button" onClick={() => item.id ? handleEdit(item) : (resetForm(),setSelectedRuiter(String(item.ruiter_id)))}>{item.id ? "Bewerken" : "Invoeren"}</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
        <div className="si-mobile-list">
          {klassement.length === 0 ? (
            <div className="si-empty si-mobile-empty">Nog geen scores ingevoerd voor deze proef/klasse.</div>
          ) : klassement.map((item) => (
            <article key={item.id || item.ruiter_id} className="si-mobile-card">
              <div className="si-mobile-head">
                <div>
                  <strong>{item.startnummer} · {item.naam}</strong>
                  <div className="si-muted">{item.paard}</div>
                </div>
                <div className="si-pill">{item.plaats}</div>
              </div>
              <div className="si-mobile-grid">
                <div><span>Score</span>{item.scoreLabel}</div>
                <div><span>Punten</span>{item.punten}</div>
              </div>
              <div className="si-actions">
                <button type="button" className="si-link-button" onClick={() => item.id ? handleEdit(item) : (resetForm(),setSelectedRuiter(String(item.ruiter_id)))}>{item.id ? "Bewerken" : "Invoeren"}</button>
              </div>
            </article>
          ))}
        </div>
        </section>
      </fieldset>
      </div>
    </div>
  );
}

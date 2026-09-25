import { calculateProtocol } from '../protocolCalculator';
export default function ProtocolCalculator({ rows, values, deduction, onChange, onDeduction, onApply, onSave }) {
 let result, error;
 try { result=calculateProtocol(rows,values,deduction); } catch(e){error=e.message;}
 return <section className="si-card si-calculator" aria-label="Protocolcijfers">
  <h3>Cijfers van het protocol</h3>
  <p>Neem de definitieve jurycijfers over (0–10, ook halve punten). Coëfficiënten worden automatisch toegepast.</p>
  <div className="si-table-wrap"><table className="si-table"><thead><tr><th>Nr.</th><th>Oefening / beoordeling</th><th>Coëfficiënt</th><th>Cijfer</th></tr></thead><tbody>
   {rows.map((r,i)=><tr key={i}><td>{r.number}</td><td>{r.label}</td><td>×{r.coefficient || 1}</td><td><input aria-label={`Cijfer ${i+1}`} className="si-input" style={{width:85}} inputMode="decimal" value={values[i] ?? ''} onChange={e=>onChange(i,e.target.value)}/></td></tr>)}
  </tbody></table></div>
  <label className="si-field"><span>Puntenaftrek volgens jury (totaal)</span><input className="si-input" inputMode="decimal" value={deduction} onChange={e=>onDeduction(e.target.value)}/></label>
  <p role="status">{result ? `Subtotaal ${result.raw} − aftrek ${result.penalties} = ${result.score} / ${result.max} (${result.percentage.toFixed(2)}%)` : error}</p>
  <button className="si-button" disabled={!result} onClick={onSave}>Cijfers en score opslaan</button>
  <p>Met ‘Opslaan’ worden de score en deze cijfers samen opgeslagen.</p>
 </section>;
}

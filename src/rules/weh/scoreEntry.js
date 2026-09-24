import { normalizeComponent, resultClassKey } from './classes.js';
import { resultStatus, speedTime } from './scoring.js';
import { validateTotal } from './validation.js';

// Shared boundary check for a score write; never infer a participant from a class label alone.
export function validateScoreEntry({ record, test, participant, competitionId, existingScores = [], editingId = null }) {
 const errors = [];
 const same = (a,b) => a != null && b != null && String(a) === String(b);
 if (!competitionId || !same(record.wedstrijd_id, competitionId) || !same(test?.wedstrijd_id, competitionId) || !same(participant?.wedstrijd_id, competitionId)) errors.push('Proef en deelnemer moeten bij de geselecteerde wedstrijd horen.');
 if (!same(record.proef_id, test?.id) || !same(record.ruiter_id, participant?.id)) errors.push('Score hoort niet bij de geselecteerde proef en deelnemer.');
 if (!participant || !test || resultClassKey(participant.klasse, participant.rubriek) !== resultClassKey(test.klasse, test.rubriek)) errors.push('Deelnemer en proef hebben een verschillende klasse of rubriek.');
 const duplicates = existingScores.filter(s => same(s.proef_id, record.proef_id) && same(s.ruiter_id, record.ruiter_id) && !same(s.id, editingId));
 if (duplicates.length) errors.push('Deze deelnemer heeft al een score voor deze proef. Bewerk de bestaande score.');
 if (editingId != null && !existingScores.some(s => same(s.id,editingId) && same(s.proef_id,record.proef_id) && same(s.ruiter_id,record.ruiter_id))) errors.push('De te bewerken score hoort niet bij deze selectie.');
 try {
  const status = resultStatus(record);
  if (record.result_status && record.dq !== (status === 'disqualified')) errors.push('DQ en resultaatstatus spreken elkaar tegen.');
  if (status === 'completed' && test) errors.push(...validateTotal({...test,score:record.score}).errors);
  const parts = [record.ridden_time,record.penalty_seconds,record.bonus_seconds];
  if (parts.some(n=>n!=null)) {
   if (normalizeComponent(test?.onderdeel) !== 'Speedtrail') errors.push('Tijdcorrecties horen alleen bij Speedtrail.');
   if (parts.some(n=>n==null)) errors.push('Gereden tijd, straf en bonus moeten samen worden vastgelegd.');
   else {
    const total = speedTime(...parts);
    if (status === 'completed' && total !== record.score) errors.push('Eindtijd klopt niet met gereden tijd, straf en bonus.');
   }
  }
 } catch(e) { errors.push(e.message); }
 return {valid:errors.length===0,errors};
}

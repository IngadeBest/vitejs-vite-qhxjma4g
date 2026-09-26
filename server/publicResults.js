import { createHash } from 'node:crypto';
import { calculateStandings } from '../src/rules/weh/rankings.js';
import { CLASSES, resultClassKey } from '../src/rules/weh/classes.js';
import { mapParticipants, mapTests } from '../src/features/scoring/scoreData.js';
import { resultStatus } from '../src/rules/weh/scoring.js';

// Only these database columns are needed; no contacts, notes or protocol comments.
export const RESULT_COLUMNS = {
  inschrijvingen: 'id,startnummer,ruiter,paard,klasse,rubriek,deelnemer_status',
  proeven: 'id,naam,klasse,onderdeel,max_score',
  scores: 'id,proef_id,ruiter_id,score,dq,result_status,ridden_time,penalty_seconds,bonus_seconds,score_revision,penalty_points:score_details->deduction',
};

export async function readAll(client, table, eventId) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.from(table).select(RESULT_COLUMNS[table])
      .eq('wedstrijd_id', eventId).order('id').range(offset, offset + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

export function buildResults({ entries, tests: rawTests, scores, finalized = {}, preview = false }) {
  const participants = mapParticipants(entries), tests = mapTests(rawTests);
  const keys = [...new Set(tests.map(t => resultClassKey(t.klasse)))];
  const classOrder = CLASSES.flatMap(c => [c.code, `${c.code} - jeugd`]);
  keys.sort((a,b) => classOrder.indexOf(a) - classOrder.indexOf(b) || a.localeCompare(b));
  const sections = [];
  let expectedSections = 0;
  let hasErrors = false;
  for (const klasse of keys) {
    const classTests = tests.filter(t => resultClassKey(t.klasse) === klasse);
    const classParticipants = participants.filter(p => resultClassKey(p.klasse) === klasse);
    const classScores = scores.filter(s => classTests.some(t => String(t.id) === String(s.proef_id)));
    try {
      // Exactly the function used by the dashboard; stored totals are never recalculated.
      const standings = calculateStandings({ klasse, participants, tests, scores });
      if (classParticipants.length) expectedSections += standings.onderdelen.length;
      // Final approval refers to these inputs. Changes reopen the class automatically,
      // including upstream status changes that influence subsequent components.
      const fingerprint = createHash('sha256').update(JSON.stringify({classTests,classParticipants,classScores})).digest('hex');
      for (const component of standings.onderdelen) {
        const test = classTests.find(t => t.onderdeel === component);
        if (!test) continue;
        if (!classScores.some(s => String(s.proef_id) === String(test.id) && resultStatus(s) !== 'pending')) continue;
        const rows = standings.eindstand.map(p => {
          const result = p.onderdelen[component];
          const score = classScores.find(s => String(s.proef_id) === String(test.id) && String(s.ruiter_id) === String(p.id));
          return {
            place: result.plaats || null, rider: p.naam, horse: p.paard,
            score: result.scoreLabel, status: result.status,
            penalty: component === 'Speedtrail' ? score?.penalty_seconds ?? null : score?.penalty_points ?? null,
            penaltyUnit: component === 'Speedtrail' ? 'sec' : 'punten',
            bonus: component === 'Speedtrail' ? score?.bonus_seconds ?? null : null,
          };
        });
        if (!rows.some(r => r.status !== 'pending')) continue;
        rows.sort((a,b) => (Number(a.place) || Infinity) - (Number(b.place) || Infinity));
        const id = String(test.id);
        const complete = rows.length > 0 && rows.every(r => r.status !== 'pending');
        sections.push({ id, name: test.naam, className: test.klasse, component, rows,
          final: complete && finalized[id] === fingerprint,
          ...(preview ? { fingerprint, complete } : {}),
        });
      }
    } catch {
      // Do not invent rankings when the shared rule engine rejects inconsistent data.
      hasErrors = true;
    }
  }
  return { sections, hasErrors, final: sections.length > 0 && sections.length === expectedSections && !hasErrors && sections.every(s => s.final) };
}

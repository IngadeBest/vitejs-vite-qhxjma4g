import { describe, it, expect } from 'vitest';
import { validateScoreEntry } from './scoreEntry';
const input = () => ({competitionId:'wedstrijd-1',test:{id:1,wedstrijd_id:'wedstrijd-1',klasse:'WE2+',onderdeel:'Speedtrail'},participant:{id:201,wedstrijd_id:'wedstrijd-1',klasse:'we2p',rubriek:'Algemeen'},record:{wedstrijd_id:'wedstrijd-1',proef_id:1,ruiter_id:'201',score:65,dq:false,result_status:'completed',ridden_time:60,penalty_seconds:10,bonus_seconds:5}});
describe('score write validation',()=>{
 it('accepts normalized classes and string/numeric identifiers',()=>expect(validateScoreEntry(input()).valid).toBe(true));
 it('rejects a stale competition selection',()=>{const data=input();data.competitionId='andere-wedstrijd';expect(validateScoreEntry(data).valid).toBe(false);});
 it('rejects a different youth rubric',()=>{const data=input();data.participant.rubriek='Jeugd';expect(validateScoreEntry(data).valid).toBe(false);});
 it('requires editing an existing score instead of adding a duplicate',()=>{const data=input();data.existingScores=[{id:10,proef_id:1,ruiter_id:201}];expect(validateScoreEntry(data).valid).toBe(false);data.editingId=10;expect(validateScoreEntry(data).valid).toBe(true);});
 it('cannot move a score to another participant while editing',()=>{const data=input();data.editingId=10;data.existingScores=[{id:10,proef_id:1,ruiter_id:202}];expect(validateScoreEntry(data).valid).toBe(false);});
 it('rejects missing and inconsistent time components',()=>{const data=input();data.record.bonus_seconds=null;expect(validateScoreEntry(data).valid).toBe(false);data.record.bonus_seconds=10;expect(validateScoreEntry(data).valid).toBe(false);});
 it('validates time components even for DQ',()=>{const data=input();Object.assign(data.record,{result_status:'disqualified',dq:true,penalty_seconds:-1});expect(validateScoreEntry(data).valid).toBe(false);});
 it('rejects conflicting status and dq',()=>{const data=input();data.record.dq=true;expect(validateScoreEntry(data).valid).toBe(false);});
 it('still supports legacy final-time-only records',()=>{const data=input();data.record={wedstrijd_id:'wedstrijd-1',proef_id:1,ruiter_id:201,score:65,dq:false};expect(validateScoreEntry(data).valid).toBe(true);});
});

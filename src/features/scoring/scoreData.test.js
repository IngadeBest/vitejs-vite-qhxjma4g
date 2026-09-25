import { it,expect } from 'vitest';
import { mapParticipants,mapTests } from './scoreData';
import { calculateStandings } from '@/rules/weh/rankings';
it('keeps WE0 youth and senior results separate, excludes withdrawals and pads numbers',()=>{
 const participants=mapParticipants([{id:'a',startnummer:1,klasse:'WE0',rubriek:'Jeugd',ruiter:'A'},{id:'b',startnummer:12,klasse:'we0',ruiter:'B'},{id:'c',startnummer:6,klasse:'WE0',deelnemer_status:'afgemeld'}]);
 const tests=mapTests([{id:1,klasse:'Introductieklasse (WE0) - Jeugd',onderdeel:'Dressuur',max_score:270},{id:2,klasse:'WE0',rubriek:'Jeugd',onderdeel:'Stijltrail',max_score:120}]);
 expect(participants).toHaveLength(2);expect(participants[0].startnummer).toBe('001');
 const result=calculateStandings({klasse:'WE0 - Jeugd',participants,tests,scores:[{proef_id:1,ruiter_id:1,score:189},{proef_id:2,ruiter_id:1,score:84}]});
 expect(result.eindstand).toHaveLength(1);expect(result.eindstand[0].totaalpunten).toBe(4);expect(result.preliminary).toBe(false);
});

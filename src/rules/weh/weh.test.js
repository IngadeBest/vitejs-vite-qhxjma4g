import { describe, it, expect } from 'vitest';
import { CLASSES, normalizeClass, entryIdentity, supportsComponent } from './classes.js';
import { eligibility } from './ageCategories.js';
import { dressageTest, dressageMaximum, scoreDressage } from './dressage.js';
import { styleMaximum } from './styleTrail.js';
import { calculateSpeed } from './speedTrail.js';
import { parseTime, formatTime, speedTime, placingPoints, assertMark } from './scoring.js';
import { calculateStandings } from './rankings.js';
import { validateCourse, resolveObstacle } from './obstacles.js';
import { validateTest } from './validation.js';
describe('official structure and protocols',()=>{
 it('has eight classes, without turning Jeugd into Junioren',()=>{
  expect(CLASSES.map(c=>c.code)).toEqual(['we0','we1','we2','we2p','we3','we4','junior','yr']);
  expect(normalizeClass('WE2PLUS')).toBe('we2p'); expect(normalizeClass('unknown')).toBeNull();
  expect(entryIdentity('WE2 - Jeugd').division).toBe('open');
  expect(entryIdentity('Junioren').dressageTestId).not.toBe(entryIdentity('WE3').dressageTestId);
 });
 const cases=[['we0',21,6,270],['we1',24,6,300],['we2',22,6,280],['we2p',24,6,300],['we3',22,5,270],['we4',22,5,270],['junior',19,5,240],['yr',21,5,300]];
 it.each(cases)('%s has official figures, coefficients and penalties',(code,n,g,max)=>{
  const test=dressageTest(code);expect(test.items.filter(i=>i.kind==='exercise')).toHaveLength(n);expect(test.items.filter(i=>i.kind==='general')).toHaveLength(g);
  expect(dressageMaximum(code)).toBe(max);
  const marks=test.items.map(()=>10);
  expect(scoreDressage(code,marks).score).toBe(max);
  expect(scoreDressage(code,marks,{mistakes:1}).score).toBe(max-5);
  expect(scoreDressage(code,marks,{mistakes:2}).score).toBe(max-10);
  expect(scoreDressage(code,marks,{mistakes:3}).status).toBe('disqualified');
  expect(()=>scoreDressage(code,marks.slice(1))).toThrow();
  expect(supportsComponent(code,'Speedtrail')).toBe(!['we0','we1'].includes(code));
  expect(validateTest({klasse:code,onderdeel:'Dressuur',max_score:max+10}).valid).toBe(false);
 });
 it('keeps YR collective coefficients explicit',()=>expect(dressageTest('yr').items.filter(i=>i.kind==='general').map(i=>i.coefficient)).toEqual([2,2,2,2,1]));
 it('applies calendar-year limits separately from January 1 youth age',()=>{
  expect(eligibility({klasse:'junior',birthDate:'2010-12-31',competitionDate:'2026-01-01'}).valid).toBe(true);
  expect(eligibility({klasse:'junior',birthDate:'2009-12-31',competitionDate:'2026-01-01'}).valid).toBe(false);
  expect(eligibility({klasse:'WE1',rubriek:'Jeugd',birthDate:'2008-12-31',competitionDate:'2026-09-26'}).valid).toBe(true);
  expect(eligibility({klasse:'yr',birthDate:'2004-12-31',competitionDate:'2026-01-01'}).valid).toBe(false);
 });
});
describe('style and obstacles',()=>{
 it.each([['we0',6,8,4],['we1',6,10,4],['we2',8,12,5],['we2p',8,12,5],['we3',10,14,5],['we4',12,16,5]])('%s checks course bounds and maximum',(c,min,max,g)=>{
  expect(styleMaximum(c,min)).toBe((min+g)*10);expect(styleMaximum(c,max)).toBe((max+g)*10);
  expect(()=>styleMaximum(c,min-1)).toThrow();expect(()=>styleMaximum(c,max+1)).toThrow();
 });
 it('does not invent JR/YR general coefficients',()=>{expect(()=>styleMaximum('junior',12)).toThrow(/REVIEW REQUIRED/);expect(()=>styleMaximum('yr',12)).toThrow(/REVIEW REQUIRED/);});
 it('normalizes aliases and rejects prohibited variants',()=>{
  expect(resolveObstacle('3 vaten','we1').obstacleId).toBe(resolveObstacle('3 tonnen','we1').obstacleId);
  expect(validateCourse('WE0','Stijltrail',Array(6).fill('Sprong')).valid).toBe(false);
  expect(validateCourse('WE4','Speedtrail',[{obstacleId:'two_barrels',variant:'backward'}]).valid).toBe(false);
  expect(validateCourse('WE2','Speedtrail',['L-gang met bel']).valid).toBe(true);
 });
});
describe('speed and score validation',()=>{
 it.each([0,0.5,5.5,10])('accepts half mark %s',n=>expect(assertMark(n)).toBe(n));
 it.each([-0.5,10.5,7.25,NaN,Infinity])('rejects invalid mark %s',n=>expect(()=>assertMark(n)).toThrow());
 it('adds penalties and subtracts independent bonuses',()=>{
  expect(calculateSpeed('WE2',60,[{id:'barrel_down',count:2},{id:'ring_returned'}])).toMatchObject({penaltySeconds:10,bonusSeconds:5,finalTime:65});
  expect(()=>speedTime(60,-5,0)).toThrow();expect(()=>calculateSpeed('WE1',60)).toThrow();
  expect(calculateSpeed('WE2',60,[{id:'ring_holder_down'}]).finalTime).toBe(65);
  expect(()=>calculateSpeed('WE2',60,[{id:'jug_table_down'}])).toThrow(/REVIEW REQUIRED/);
 });
 it('retains junior and master exceptions',()=>{
  expect(calculateSpeed('junior',60,[{id:'junior_gate_unclosed',obstacleNumber:1}]).finalTime).toBe(75);
  expect(()=>calculateSpeed('WE3',60,[{id:'junior_gate_unclosed',obstacleNumber:1}])).toThrow();
  expect(calculateSpeed('WE4',60,[{id:'masters_second_hand',count:3}]).status).toBe('disqualified');
 });
 it('disqualifies Juniors after three distinct failed obstacles',()=>{
  const events=[{id:'junior_gate_unclosed',obstacleNumber:1},{id:'junior_backward_failed',obstacleNumber:2},{id:'junior_cup_failed',obstacleNumber:3}];
  expect(calculateSpeed('junior',60,events.slice(0,2)).status).toBe('completed');
  expect(calculateSpeed('junior',60,events).status).toBe('disqualified');
  expect(()=>calculateSpeed('junior',60,[{id:'junior_cup_failed'}])).toThrow(/hindernisnummer/);
 });
 it('counts an official ABC garrocha combination as one scored obstacle',()=>{
  expect(validateCourse('we1','Stijltrail',['Garrocha ABC','Brug','Slalom','3 tonnen','Poort','Rechte gang met bel']).valid).toBe(true);
  expect(validateCourse('we0','Stijltrail',['Garrocha ABC',...Array(5).fill('Brug')]).valid).toBe(false);
 });
 it('validates times without stripping invalid characters and carries hundredths',()=>{
  expect(parseTime('01:02:34')).toBe(62.34);expect(parseTime('62,34')).toBe(62.34);
  expect(()=>parseTime('-1:02')).toThrow();expect(()=>parseTime('1:99')).toThrow();
  expect(formatTime(59.999)).toBe('01:00:00');
 });
});
describe('classification regressions',()=>{
 const participants=[1,2,3].map(id=>({id,naam:`R${id}`,klasse:'WE2'}));
 const tests=['Dressuur','Stijltrail','Speedtrail'].map((onderdeel,id)=>({id,onderdeel,klasse:'WE2',max_score:280}));
 const scores=[{proef_id:0,ruiter_id:1,score:200},{proef_id:0,ruiter_id:2,score:190},{proef_id:0,ruiter_id:3,score:180},
 {proef_id:1,ruiter_id:1,score:200},{proef_id:1,ruiter_id:2,score:190},{proef_id:1,ruiter_id:3,score:0,dq:true},
 {proef_id:2,ruiter_id:1,score:60},{proef_id:2,ruiter_id:2,score:65},{proef_id:2,ruiter_id:3,score:0,result_status:'not_started'}];
 it('uses fixed dressage N even when fewer riders finish a later component',()=>{
  const r=calculateStandings({klasse:'WE2',participants,tests,scores});expect(r.dressageStarterCount).toBe(3);
  expect(r.eindstand[0].onderdelen.Speedtrail.plaatsingspunten).toBe(4);expect(r.eindstand[1].onderdelen.Speedtrail.plaatsingspunten).toBe(2);
  expect(placingPoints(2,3)).toBe(2);
 });
 it('leaves missing score pending rather than inventing voluntary non-start',()=>{
  const r=calculateStandings({klasse:'WE2',participants,tests,scores:scores.slice(0,-1)});expect(r.preliminary).toBe(true);expect(r.eindstand.every(r=>r.plaats==='voorlopig')).toBe(true);
 });
 it('ends the competition after elimination instead of treating later components as missing',()=>{
  const eliminatedScores=scores.filter(s=>s.ruiter_id!==3 || s.proef_id===0).map(s=>s.ruiter_id===3?{...s,result_status:'eliminated'}:s);
  const result=calculateStandings({klasse:'WE2',participants,tests,scores:eliminatedScores});
  expect(result.preliminary).toBe(false);
  expect(result.eindstand.at(-1).onderdelen.Speedtrail.status).toBe('eliminated');
  expect(()=>calculateStandings({klasse:'WE2',participants,tests,scores:[...eliminatedScores,{proef_id:1,ruiter_id:3,score:200}]})).toThrow(/eliminatie/);
 });
 it('keeps youth separate and refuses ambiguous duplicate test data',()=>{
  expect(calculateStandings({klasse:'WE2 - Jeugd',participants,tests,scores}).eindstand).toHaveLength(0);
  expect(()=>calculateStandings({klasse:'WE2',participants,tests:[...tests,tests[0]],scores})).toThrow(/Meerdere/);
 });
});

describe('speed penalty table regression (WEH appendix 6)',()=>{
 it.each([
  ['ring_holder_down',5],['barrel_down',5],['bridge_part_down',5],['slalom_pole_down',3],['jump_part_down',5],
  ['pen_part_down',5],['backward_part_down',3],['gate_part_down',10],['gate_all_down',30],
  ['bell_part_down',5],['sideways_pole_down',7],['sideways_wrong_leg',5],
  ['garrocha_pickup_barrel_down',5],['garrocha_return_barrel_down',5],
 ])('%s adds %s seconds',(id,seconds)=>{
  for(const c of ['we2','we2p','we3','we4','junior','yr']) expect(calculateSpeed(c,60,[{id}]).finalTime).toBe(60+seconds);
 });
 it('does not double charge a fallen gate, but allows separate gates',()=>{
  expect(()=>calculateSpeed('we3',60,[{id:'gate_all_down',obstacleNumber:1},{id:'gate_part_down',obstacleNumber:1}])).toThrow(/dubbel/);
  expect(calculateSpeed('we3',60,[{id:'gate_all_down',obstacleNumber:1},{id:'gate_part_down',obstacleNumber:2}]).finalTime).toBe(100);
 });
 it.each(['wrong_course_uncorrected','third_refusal','bridge_not_taken','pen_left','cup_not_replaced','corridor_left','bell_not_rung','garrocha_not_replaced','fall','gate_unclosed'])('%s produces no classified time',id=>{
  expect(calculateSpeed('we3',60,[{id}])).toMatchObject({status:'disqualified',finalTime:null});
 });
});

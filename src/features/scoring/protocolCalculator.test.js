import { describe,it,expect } from 'vitest';
import { calculatorRows,calculateProtocol } from './protocolCalculator';
import { CLASSES } from '@/rules/weh/classes';
import { dressageMaximum } from '@/rules/weh/dressage';
describe('protocol calculation',()=>{
 it.each(CLASSES)('$naam applies every coefficient', c=>{
  const rows=calculatorRows({klasse:c.code,onderdeel:'Dressuur'});
  const result=calculateProtocol(rows,rows.map(()=>'7,5'),'5');
  expect(result.score).toBe(dressageMaximum(c.code)*.75-5);
  expect(result.details.items).toHaveLength(rows.length);
 });
 it('restores a stored protocol without losing coefficients or deduction',()=>{
  const rows=calculatorRows({klasse:'yr',onderdeel:'Dressuur'});
  const result=calculateProtocol(rows,rows.map(()=>'6.5'),'10');
  const restored=calculateProtocol(result.details.items,result.details.items.map(r=>r.mark),result.details.deduction);
  expect(restored.score).toBe(185);
  expect(result.details.items.filter(r=>r.coefficient===2)).toHaveLength(4);
 });
 it('counts eight WE0 obstacles and four general marks, without start/finish',()=>{
  const rows=calculatorRows({klasse:'WE0 - Jeugd',onderdeel:'Stijltrail',max_score:120},{we0:['Slalom',...Array(7).fill('Brug')]});
  expect(rows).toHaveLength(12);expect(rows[0].label).toBe('Slalom');
  expect(calculateProtocol(rows,rows.map(()=>'7')).score).toBe(84);
 });
 it('rejects a blank field, an invalid mark and excess precision',()=>{
  const rows=calculatorRows({klasse:'we0',onderdeel:'Dressuur'}), marks=rows.map(()=>'7');
  for(const invalid of ['', '11','6.25','tekst'])expect(()=>calculateProtocol(rows,[invalid,...marks.slice(1)])).toThrow();
  expect(calculateProtocol(rows,['0',...marks.slice(1)]).score).toBe(182);
 });
});

import { describe,it,expect } from 'vitest';
import { participantClassification,participantClassLabel,classificationUpdate } from './classification';
import { resultClassKey } from '../../rules/weh/classes';
describe('participant class and youth section',()=>{
 it('shows all observed WE0 spellings as one class',()=>{
  const values=['WE0','we0','0','Introductieklasse (WE0)'].map(klasse=>participantClassLabel({klasse,rubriek:'Algemeen'}));
  expect(new Set(values).size).toBe(1);
 });
 it('reads legacy youth suffixes',()=>expect(participantClassification({klasse:'WE0 - Jeugd'})).toEqual({klasse:'we0',rubriek:'Jeugd'}));
 it('can assign and remove Jeugd without leaving a stale class suffix',()=>{
  const form=participantClassification({klasse:'WE0 - Jeugd'});
  const senior=classificationUpdate({...form,rubriek:'Senior'});
  expect(senior).toEqual({klasse:'we0',rubriek:'Senior'});
  expect(resultClassKey(senior.klasse,senior.rubriek)).toBe('we0');
  const youth=classificationUpdate({...senior,rubriek:'Jeugd'});
  expect(resultClassKey(youth.klasse,youth.rubriek)).toBe('we0 - jeugd');
 });
 it('does not confuse Junioren with Jeugd',()=>expect(participantClassification({klasse:'Junioren',rubriek:'Algemeen'})).toEqual({klasse:'junior',rubriek:'Algemeen'}));
 it('rejects free-text unknown classes and sections',()=>{
  expect(()=>classificationUpdate({klasse:'WE99',rubriek:'Algemeen'})).toThrow();
  expect(()=>classificationUpdate({klasse:'WE0',rubriek:'Junior'})).toThrow();
 });
});

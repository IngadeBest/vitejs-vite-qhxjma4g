import { dressageTest } from '@/rules/weh/dressage';
import { styleRules, styleMaximum } from '@/rules/weh/styleTrail';
import { normalizeComponent, normalizeClass } from '@/rules/weh/classes';
import { scoreMarks } from '@/rules/weh/scoring';

export function calculatorRows(test, config = {}) {
 if (normalizeComponent(test.onderdeel) === 'Dressuur') return dressageTest(test.klasse).items.map(r=>({...r,label:`${r.letters || ''} ${r.text}`.replace(/\s+/g,' ').trim()}));
 if (normalizeComponent(test.onderdeel) !== 'Stijltrail') return [];
 const general = styleRules(test.klasse).generalPoints;
 const count = Number(test.max_score)/10-general.length;
 styleMaximum(test.klasse,count);
 const saved = config[normalizeClass(test.klasse)];
 const obstacles = Array.from({length:count},(_,i)=>({number:i+1,label:saved?.length===count ? saved[i] : `Hindernis ${i+1}`,coefficient:1}));
 return [...obstacles,...general.map((label,i)=>({number:count+i+1,label,coefficient:1,kind:'general'}))];
}
export function calculateProtocol(rows, values, deduction = '0') {
 if (values.length !== rows.length || values.some(v=>String(v).trim()==='')) throw new Error('Vul ieder cijfer in; een leeg vak telt niet als nul.');
 const marks=values.map(v=>Number(String(v).replace(',','.')));
 const result=scoreMarks(rows,marks,{deduction:Number(String(deduction).replace(',','.'))});
 return {...result, details:{items:rows.map((r,i)=>({number:r.number,label:r.label,coefficient:r.coefficient || 1,mark:marks[i]})),deduction:result.penalties,raw:result.raw,max:result.max}};
}

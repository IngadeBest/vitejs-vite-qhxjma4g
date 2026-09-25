import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import ScoreInvoer from './ScoreInvoer';
const state=vi.hoisted(()=>({scores:[],writes:[],conflict:false}));
vi.mock('@/features/wedstrijden/context/WedstrijdContext',()=>({useWedstrijdContext:()=>({selectedWedstrijdId:'w',selectedWedstrijd:{naam:'Testwedstrijd'}})}));
vi.mock('../scoreData',()=>({loadScoreData:async()=>({participants:[{id:1,uuid:'a',startnummer:'001',naam:'Ruiter',paard:'Paard',klasse:'Introductieklasse (WE0) - Jeugd',rubriek:'Jeugd',wedstrijd_id:'w'}],tests:[{id:1,klasse:'Introductieklasse (WE0) - Jeugd',onderdeel:'Dressuur',max_score:270,wedstrijd_id:'w',naam:'Jeugd dressuur'}],scores:state.scores})}));
vi.mock('@/lib/supabaseClient',()=>({supabase:{from:()=>{
 const q={select:()=>q,eq:()=>q,limit:async()=>({error:null}),then:resolve=>Promise.resolve({data:state.scores,error:null}).then(resolve),
 insert:value=>{state.writes.push(value[0]);return q;},update:value=>{state.writes.push(value);return q;},
 single:async()=>({data:{id:5},error:null}),maybeSingle:async()=>({data:state.conflict?null:{id:5},error:null})};return q;
}}}));
let host,root;
beforeEach(async()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;state.scores=[];state.writes=[];state.conflict=false;host=document.createElement('div');root=createRoot(host);await act(async()=>root.render(<ScoreInvoer/>));});
afterEach(async()=>{await act(async()=>root.unmount());});
async function change(el,value){await act(async()=>{const setter=Object.getOwnPropertyDescriptor(el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set;setter.call(el,value);el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));});}
async function selectTest(){await change(host.querySelectorAll('select')[0],'Introductieklasse (WE0) - Jeugd');await change(host.querySelectorAll('select')[1],'Dressuur');}
it('automatically selects the only matching test and saves all marks with their calculated total',async()=>{
 await selectTest();expect(host.querySelectorAll('select')[2].value).toBe('1');
 await change(host.querySelectorAll('select')[3],'1');
 const inputs=host.querySelectorAll('input[aria-label^="Cijfer"]');expect(inputs).toHaveLength(27);
 for(const input of inputs)await change(input,'7');
 await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Opslaan').click());
 expect(state.writes).toHaveLength(1);expect(state.writes[0].score).toBe(189);expect(state.writes[0].score_details.items).toHaveLength(27);expect(host.textContent).toContain('Score opgeslagen.');
});
it('keeps incomplete protocol input instead of saving empty marks as zero',async()=>{
 await selectTest();await change(host.querySelectorAll('select')[3],'1');
 await change(host.querySelector('input[aria-label="Cijfer 1"]'),'7');
 await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Opslaan').click());
 expect(state.writes).toHaveLength(0);expect(host.textContent).toContain('Vul ieder cijfer in');expect(host.querySelector('input[aria-label="Cijfer 1"]').value).toBe('7');
});
it('reopens stored marks and preserves them when a concurrent update is rejected',async()=>{
 state.scores=[{id:5,proef_id:1,ruiter_id:1,score:189,dq:false,result_status:'completed',score_revision:2,score_details:{items:Array.from({length:27},(_,i)=>({number:i+1,mark:7,coefficient:1})),deduction:0}}];
 await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Scores verversen').click());
 await selectTest();await change(host.querySelectorAll('select')[3],'1');
 expect(host.querySelector('input[aria-label="Cijfer 1"]').value).toBe('7');
 await change(host.querySelector('input[aria-label="Cijfer 1"]'),'8');state.conflict=true;
 await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Bijwerken').click());
 expect(state.writes[0].score).toBe(190);expect(state.writes[0].score_revision).toBe(3);
 expect(host.textContent).toContain('Deze score is intussen gewijzigd');
 expect(host.querySelector('input[aria-label="Cijfer 1"]').value).toBe('8');
});

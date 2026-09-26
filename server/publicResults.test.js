import { describe, expect, it } from 'vitest';
import { buildResults, readAll } from './publicResults.js';
import { calculateStandings } from '../src/rules/weh/rankings.js';
import { mapParticipants, mapTests } from '../src/features/scoring/scoreData.js';
import { createResultsHandler } from '../api/results.js';

const eventId = '11111111-1111-4111-8111-111111111111';
export function fixture() {
  const entries = [1,2,3].map(n => ({id:`private-id-${n}`,startnummer:n,ruiter:`Ruiter ${n}`,paard:`Paard ${n}`,klasse:'we2',rubriek:'Algemeen',email:'private@example.test',telefoon:'SECRET',opmerkingen:'JURY PRIVATE'}));
  const tests = ['dressuur','stijl','speed'].map((o,i) => ({id:i+1,naam:o,klasse:'WE2',onderdeel:o,max_score:200,jury:'PRIVATE'}));
  const scores = tests.flatMap(t => entries.map((p,i) => ({id:t.id*10+i,proef_id:t.id,ruiter_id:p.startnummer,score:t.id===3 ? [80,75,75][i] : [160,180,180][i],result_status:'completed',dq:false,penalty_seconds:t.id===3 ? 5:null,bonus_seconds:t.id===3 ? 2:null,penalty_points:t.id===1 ? 5:null,rule_events:[{comment:'PRIVATE'}]})));
  return {entries,tests,scores};
}

describe('public result projection', () => {
  it('uses exactly the dashboard places and labels, including ties and speed order', () => {
    const input = fixture();
    const result = buildResults(input);
    const dashboard = calculateStandings({klasse:'we2',participants:mapParticipants(input.entries),tests:mapTests(input.tests),scores:input.scores});
    for (const section of result.sections) {
      for (const row of section.rows) {
        const expected = dashboard.eindstand.find(r => r.naam === row.rider).onderdelen[section.component];
        expect(row.place).toBe(expected.plaats);
        expect(row.score).toBe(expected.scoreLabel);
      }
      expect(section.rows.map(r=>r.place)).toEqual(['1','1','3']);
    }
    expect(result.final).toBe(false);
    expect(JSON.stringify(result)).not.toMatch(/private|SECRET|JURY|email|telefoon|rule_events|fingerprint|ruiter_id|uuid/i);
  });
  it('only marks explicitly approved current inputs as final', () => {
    const input = fixture();
    const preview = buildResults({...input,preview:true});
    const finalized = Object.fromEntries(preview.sections.map(s=>[s.id,s.fingerprint]));
    expect(buildResults({...input,finalized}).final).toBe(true);
    input.scores[0].score = 190;
    expect(buildResults({...input,finalized}).sections.every(s=>!s.final)).toBe(true);
  });
  it('hides untouched trials and keeps the event live when only dressage is finalized', () => {
    const input = fixture(); input.scores = input.scores.filter(s=>s.proef_id===1);
    const preview = buildResults({...input,preview:true});
    expect(preview.sections).toHaveLength(1);
    const result = buildResults({...input,finalized:{1:preview.sections[0].fingerprint}});
    expect(result.sections[0].final).toBe(true);
    expect(result.final).toBe(false);
  });
  it('shows pending/DQ/NS/HC without fabricating places and excludes inactive entries', () => {
    const input = fixture();
    input.scores = input.scores.filter(s=>!(s.ruiter_id===1 && s.proef_id===1));
    input.scores.find(s=>s.ruiter_id===2 && s.proef_id===1).result_status = 'disqualified';
    input.entries[2].deelnemer_status = 'afgemeld';
    const result = buildResults({...input,preview:true});
    const dressage = result.sections.find(s=>s.component==='Dressuur');
    expect(dressage.rows.map(r=>r.status).sort()).toEqual(['disqualified','pending']);
    expect(dressage.rows.every(r=>r.place===null)).toBe(true);
    expect(dressage.complete).toBe(false);
    input.scores.find(s=>s.ruiter_id===2 && s.proef_id===1).result_status = 'not_started';
    expect(buildResults(input).sections[0].rows.some(r=>r.score==='NS')).toBe(true);
    input.scores.find(s=>s.ruiter_id===2 && s.proef_id===1).result_status = 'hors_concours';
    expect(buildResults(input).sections.every(s=>s.rows.find(r=>r.rider==='Ruiter 2').score==='HC')).toBe(true);
  });
  it('keeps youth separate and rejects ambiguous tests without exposing diagnostics', () => {
    const input = fixture();
    input.entries.push({...input.entries[0],id:'youth',startnummer:4,klasse:'we1',rubriek:'Jeugd',ruiter:'Jeugdruiter'});
    input.tests.push({id:4,naam:'Jeugd',klasse:'WE1 - Jeugd',onderdeel:'dressuur',max_score:200});
    input.scores.push({id:44,proef_id:4,ruiter_id:4,score:180});
    const result = buildResults(input);
    expect(result.sections.find(s=>s.className==='WE1 - Jeugd').rows).toHaveLength(1);
    expect(result.sections.find(s=>s.className==='WE2').rows).toHaveLength(3);
    input.tests.push({...input.tests[0],id:5});
    const broken = buildResults(input);
    expect(broken.hasErrors).toBe(true);
    expect(broken.sections.every(s=>s.className!=='WE2')).toBe(true);
  });
  it('paginates beyond the Supabase default row limit', async () => {
    const data = Array.from({length:1001},(_,id)=>({id}));
    const query = { select:()=>query,eq:()=>query,order:()=>query,range:async(a,b)=>({data:data.slice(a,b+1)}) };
    expect(await readAll({from:()=>query},'scores',eventId)).toHaveLength(1001);
  });
});

function mockClient({published=true,admin=false,settingsError=false,withdraw=false}={}) {
  const input = fixture(), calls = []; let reads=0;
  const tables = {inschrijvingen:input.entries,proeven:input.tests,scores:input.scores};
  const client = {
    auth:{getUser:async()=>({data:{user:{id:'account-secret'}}})},
    from(table) {
      calls.push(table);
      const query = { select:()=>query,eq:()=>query,order:()=>query,
        range:async()=>({data:tables[table]}),
        maybeSingle:async()=> {
          if(table==='public_result_settings') return {data:{published:withdraw && reads++>0 ? false:published,finalized:{}},error:settingsError ? new Error('secret SQL details'):null};
          if(table==='admins') return {data:admin ? {user_id:'account-secret'}:null};
          return {data:{naam:'Testwedstrijd',datum:'2026-09-25',locatie:'Manege',organisator_email:'SECRET'}};
        },
      }; return query;
    },
  }; return {client,calls};
}
async function request(options={},query={},method='GET',headers={}) {
  const {client,calls} = mockClient(options);
  const res = {headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(body){this.body=body;return this;}};
  await createResultsHandler(()=>client)({method,query:{eventId,...query},headers},res);
  return {...res,calls};
}
describe('public API boundary', () => {
  it('returns nothing from an unpublished event and never queries entries/scores', async () => {
    const res = await request({published:false});
    expect(res.body).toEqual({published:false}); expect(res.calls).toEqual(['public_result_settings']);
  });
  it('returns a strict public projection without auth and disables caches', async () => {
    const res = await request();
    expect(res.code).toBe(200); expect(res.body.sections).toHaveLength(3);
    expect(JSON.stringify(res.body)).not.toMatch(/SECRET|private|fingerprint|email|account|jury/i);
    expect(res.headers['Cache-Control']).toContain('no-store');
  });
  it('rechecks withdrawn publication after loading', async () => {
    expect((await request({withdraw:true})).body).toEqual({published:false});
  });
  it('requires a real admin for unpublished previews', async () => {
    expect((await request({}, {preview:'1'})).code).toBe(401);
    expect((await request({}, {preview:'1'},'GET',{authorization:'Bearer token'})).code).toBe(403);
    const res = await request({published:false,admin:true},{preview:'1'},'GET',{authorization:'Bearer token'});
    expect(res.code).toBe(200); expect(res.body.sections[0].fingerprint).toBeTruthy();
  });
  it('fails closed on invalid requests and database errors', async () => {
    expect((await request({}, {eventId:'invalid'})).code).toBe(400);
    expect((await request({}, {},'POST')).code).toBe(405);
    const res = await request({settingsError:true});
    expect(res.code).toBe(503); expect(res.body).toEqual({error:'RESULTS_UNAVAILABLE'});
  });
});

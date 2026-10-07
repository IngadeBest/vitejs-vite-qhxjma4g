import { beforeEach, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ rows: [], competition: {id:'w', naam:'Test',status:'open',datum:'2027-10-01',wachtlijst_enabled:true} }));
vi.mock('@supabase/supabase-js', () => ({createClient: () => ({from: table => {
  let inserting;
  const q = {select:()=>q,eq:()=>q,or:()=>q,limit:()=>q,order:()=>q,insert: payload=>{inserting=payload;return q;},
    single: async()=>({data:db.competition}),maybeSingle: async()=>({data:null}),
    then: resolve => {
      if(inserting) db.rows.push({table,...inserting});
      return Promise.resolve({data:table==='wedstrijden'?[db.competition]:[],error:null}).then(resolve);
    }};return q;
}})}));
let register, waitlist;
beforeEach(async()=>{
  vi.stubEnv('SUPABASE_URL','https://example.supabase.co'); vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','test'); vi.stubEnv('SUPABASE_ANON_KEY','test');
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true})); db.rows=[];
  register=(await import('../api/inschrijvingen.js')).default; waitlist=(await import('../api/wachtlijst.js')).default;
});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
const valid={wedstrijd_id:'w',klasse:'we1',ruiter:'Test',paard:'Pony',email:'test@example.invalid',geboortedatum_ruiter:'2010-10-08',stal_nodig:false};
async function call(handler, body){const res={code:0,status(n){this.code=n;return this;},json(body){this.body=body;return this;}}; await handler({method:'POST',body},res);return res;}
it.each(['registration','waitlist'])('%s rejects missing birth date server-side',async kind=>{
 const result=await call(kind==='registration'?register:waitlist,{...valid,geboortedatum_ruiter:null});
 expect(result.code).toBe(400); expect(db.rows).toEqual([]);
});
it.each(['registration','waitlist'])('%s validates stall details before inserting',async kind=>{
 const handler=kind==='registration'?register:waitlist;
 expect((await call(handler,{...valid,stal_nodig:true})).code).toBe(400);
 expect((await call(handler,{...valid,stal_nodig:true,stokmaat_cm:170})).code).toBe(400);
 expect(db.rows).toEqual([]);
 expect((await call(handler,{...valid,stal_nodig:true,stokmaat_cm:170,stalmaat:'groot',leeftijd_ruiter:99})).code).toBe(200);
 expect(db.rows[0]).toMatchObject({geboortedatum_ruiter:'2010-10-08',leeftijd_ruiter:16,stokmaat_cm:170,stalmaat:'groot',stal_nodig:true});
});
it('permits no stall without height or size',async()=>{
 expect((await call(register,valid)).code).toBe(200);
 expect(db.rows[0]).toMatchObject({stal_nodig:false,stalmaat:null,stokmaat_cm:null});
});

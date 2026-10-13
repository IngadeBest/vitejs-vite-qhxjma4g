import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import PublicInschrijven from './PublicInschrijven';
const db = vi.hoisted(() => ({ items: [{ id:'w', naam:'Testwedstrijd', datum:'2027-10-01', status:'open', allowed_klassen:['we1'] }] }));
vi.mock('./hooks/useWedstrijden', () => ({useWedstrijden: () => ({items:db.items, loading:false})}));
vi.mock('@/lib/supabaseClient', () => ({supabase: {from: vi.fn()}}));
vi.mock('@/lib/notifyOrganisator', () => ({notifyOrganisator: vi.fn()}));
let root, container, fetchMock;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  fetchMock = vi.fn().mockResolvedValue({ok:true,text:async () => '{"ok":true}'}); vi.stubGlobal('fetch',fetchMock);
});
afterEach(async () => {await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals();});
async function set(selector,value) {
  await act(async () => {
    const el=container.querySelector(selector);
    const prototype = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype,'value').set.call(el,value);
    el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));
  });
}
async function mount(accept = true) {
 await act(async () => root.render(<MemoryRouter><PublicInschrijven /></MemoryRouter>));
 await set('#ruiter_input','Test Ruiter'); await set('#paard_input','Pony'); await set('#email_input','test@example.invalid'); await set('#klasse_select','we1');
 if (accept) await act(async()=>container.querySelector('.wp-legal-check input').click());
}
async function submit(){ await act(async()=>container.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))); }
it('blocks registration without birth date with visible feedback', async()=> {
 await mount(); await submit(); expect(fetchMock).not.toHaveBeenCalled(); expect(container.textContent).toContain('Vul de geboortedatum');
});
it('submits without height or stall size when no stall is requested',async()=>{
 await mount(); expect(container.textContent).not.toContain('Welke stal'); await set('[name=geboortedatum_ruiter]','2010-10-08'); await submit();
 expect(fetchMock).toHaveBeenCalledTimes(1); expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({geboortedatum_ruiter:'2010-10-08',leeftijd_ruiter:16,stal_nodig:false,stalmaat:null,stokmaat_cm:null});
 expect(container.textContent).toContain('Dank je wel');
});
it('requires both height and size when requesting a stall',async()=>{
 await mount(); await set('[name=geboortedatum_ruiter]','2010-10-08');
 await act(async()=>container.querySelectorAll('input[type=radio]')[1].click());
 await submit(); expect(fetchMock).not.toHaveBeenCalled(); expect(container.textContent).toContain('Vul de stokmaat'); expect(container.textContent).toContain('Kies welke stal');
 await set('[name=stokmaat_cm]','170'); await submit(); expect(fetchMock).not.toHaveBeenCalled();
 await act(async()=>container.querySelectorAll('input[type=radio]')[3].click()); await submit();
 expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({stal_nodig:true,stalmaat:'groot',stokmaat_cm:170});
});

it('requires a deliberate terms acceptance and keeps legal links separate from privacy consent',async()=>{
 await mount(false); await set('[name=geboortedatum_ruiter]','2010-10-08'); await submit();
 expect(fetchMock).not.toHaveBeenCalled(); expect(container.querySelector('#terms-error').textContent).toContain('vink aan');
 expect(container.querySelectorAll('.wp-legal-acceptance input[type=checkbox]')).toHaveLength(1);
 for (const a of container.querySelectorAll('.wp-legal-acceptance a')) { expect(a.target).toBe('_blank'); expect(a.rel).toContain('noopener'); }
 expect(container.querySelector('#ruiter_input').value).toBe('Test Ruiter');
 await act(async()=>container.querySelector('.wp-legal-check input').click()); await submit();
 expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({terms_accepted:true,terms_version:'2026-10-07'});
 expect(JSON.parse(fetchMock.mock.calls[0][1].body)).not.toHaveProperty('terms_accepted_at');
});

it('also requires acceptance for waitlist submission',async()=>{
 await mount(); await set('[name=geboortedatum_ruiter]','2010-10-08');
 fetchMock.mockResolvedValueOnce({ok:false,status:400,text:async()=>JSON.stringify({error:'KLASSE_VOLZET_WACHTLIJST',wachtlijst_enabled:true,message:'Vol'})});
 await submit(); expect(fetchMock).toHaveBeenCalledTimes(1);
 await act(async()=>container.querySelector('.wp-legal-check input').click());
 const waitlistButton=()=>[...container.querySelectorAll('button')].find(b=>b.textContent.includes('Plaatsen op wachtlijst'));
 await act(async()=>waitlistButton().click());
 expect(fetchMock).toHaveBeenCalledTimes(1); expect(container.querySelector('#terms-error')).toBeTruthy();
 await act(async()=>container.querySelector('.wp-legal-check input').click());
 fetchMock.mockResolvedValueOnce({ok:true,json:async()=>({ok:true})});
 await act(async()=>waitlistButton().click());
 expect(fetchMock.mock.calls[1][0]).toBe('/api/wachtlijst');
 expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({terms_accepted:true,terms_version:'2026-10-07'});
 expect(container.textContent).toContain('Je staat op de wachtlijst');
});

it('offers both public documents below the title before filling in the form', async()=>{
 await act(async () => root.render(<MemoryRouter><PublicInschrijven /></MemoryRouter>));
 const nav=container.querySelector('h1').nextElementSibling;
 expect(nav.tagName).toBe('NAV');
 const links=[...nav.querySelectorAll('a')];
 expect(links.map(a=>a.textContent)).toEqual(['Algemene voorwaarden','Privacyverklaring']);
 expect(links.map(a=>a.getAttribute('href'))).toEqual(['/#/algemene-voorwaarden/2026-10-07','/#/privacy']);
 for(const a of links) {expect(a.target).toBe('_blank');expect(a.rel).toContain('noopener');}
 expect(container.querySelector('.wp-legal-acceptance h2').textContent).toBe('05 Voorwaarden & privacy');
 expect(container.querySelector('.wp-legal-check input').checked).toBe(false);
});

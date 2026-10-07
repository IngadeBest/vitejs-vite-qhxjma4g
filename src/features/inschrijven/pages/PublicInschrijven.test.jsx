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
async function mount() {
 await act(async () => root.render(<MemoryRouter><PublicInschrijven /></MemoryRouter>));
 await set('#ruiter_input','Test Ruiter'); await set('#paard_input','Pony'); await set('#email_input','test@example.invalid'); await set('#klasse_select','we1');
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

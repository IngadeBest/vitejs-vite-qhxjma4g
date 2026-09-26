import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PublicResults, { POLL_MS } from './PublicResults';

let root, container, payload;
const live = () => ({published:true,event:{naam:'Herfstwedstrijd',datum:'2026-09-25',locatie:'Manege'},sections:[{id:'1',name:'Dressuur WE2',className:'WE2',component:'Dressuur',final:false,rows:[{place:'1',rider:'Lisa',horse:'Storm',score:'180 (90.0%)',status:'completed'}]}]});
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers(); payload=live();
  vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>payload})));
  container=document.createElement('div'); root=createRoot(container);
});
afterEach(async()=>{await act(async()=>root.unmount());vi.useRealTimers();vi.unstubAllGlobals();});
async function render() { await act(async()=>root.render(<MemoryRouter initialEntries={['/results/event']}><Routes><Route path="/results/:eventId" element={<PublicResults />} /></Routes></MemoryRouter>)); }
it('opens without login, polls updated scores and clears results when unpublished',async()=>{
  await render();
  expect(container.textContent).toContain('Lisa'); expect(container.textContent).not.toContain('Inloggen');
  payload=live();payload.sections[0].rows[0].score='190 (95.0%)';
  await act(async()=>vi.advanceTimersByTimeAsync(POLL_MS));
  expect(container.textContent).toContain('190 (95.0%)');
  payload={published:false};
  await act(async()=>vi.advanceTimersByTimeAsync(POLL_MS));
  expect(container.textContent).toContain('nog niet gepubliceerd'); expect(container.textContent).not.toContain('Lisa');
});
it('removes unverifiable results on failure and recovers on the next poll',async()=>{
  await render();
  fetch.mockRejectedValueOnce(new Error('offline'));
  await act(async()=>vi.advanceTimersByTimeAsync(POLL_MS));
  expect(container.textContent).toContain('tijdelijk niet bereikbaar');expect(container.textContent).not.toContain('Lisa');
  await act(async()=>vi.advanceTimersByTimeAsync(POLL_MS));
  expect(container.textContent).toContain('Lisa');
});
it('recovers from request timeouts without reusing an aborted signal',async()=>{
  fetch.mockImplementationOnce((_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('timeout')))));
  await render();
  await act(async()=>vi.advanceTimersByTimeAsync(15000));
  expect(container.textContent).toContain('tijdelijk niet bereikbaar');
  await act(async()=>vi.advanceTimersByTimeAsync(5000));
  expect(container.textContent).toContain('Lisa');
  expect(fetch.mock.calls[1][1].signal.aborted).toBe(false);
});
it('selects components and uses explicit final status',async()=>{
  payload.sections.push({...payload.sections[0],id:'2',component:'Stijltrail',name:'Stijl WE2',final:true});
  await render();
  await act(async()=>[...container.querySelectorAll('button')].find(b=>b.textContent==='Stijltrail').click());
  expect(container.textContent).toContain('Stijl WE2');expect(container.textContent).toContain('Einduitslag');
  expect(container.textContent).not.toContain('Deze tussenstand kan nog wijzigen');
});

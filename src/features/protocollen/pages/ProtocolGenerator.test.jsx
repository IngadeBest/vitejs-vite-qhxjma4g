import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import ProtocolGenerator from './ProtocolGenerator';

const db = vi.hoisted(() => ({ entries: [], calls: [], error: null, protocols: {}, wedstrijden: [{ id: 'w', naam: 'Onstwedde', datum: '2026-09-26' }] }));
vi.mock('@/features/inschrijven/pages/hooks/useWedstrijden', () => ({ useWedstrijden: () => ({ items: db.wedstrijden }) }));
vi.mock('@/features/wedstrijden/context/WedstrijdContext', () => ({ useWedstrijdContext: () => ({ selectedWedstrijdId: 'w' }) }));
vi.mock('@/lib/supabaseClient', () => ({ supabase: { rpc: async (_name, args) => {
  db.protocols[args.p_klasse] = args.p_items; return {data:args.p_items};
}, from: table => {
  const q = { select: () => q, eq: (key, value) => { db.calls.push([table, key, value]); return q; },
    or: () => q, order: () => q, maybeSingle: async () => ({data:{protocol_config:db.protocols}}),
    then: resolve => Promise.resolve({ error: table === 'inschrijvingen' ? db.error : null,
      data: table === 'inschrijvingen' ? db.entries : table === 'proeven'
        ? [{ id: 55, uuid: 'proef-uuid', klasse: 'WE0', onderdeel: 'stijl' }] : [] }).then(resolve) };
  return q;
} } }));
let root, container;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear(); db.calls = []; db.error = null; db.protocols = {};
  db.entries = [{ ruiter: 'Jeugdruiter', paard: 'Pony', klasse: 'WE0', rubriek: 'Jeugd', startnummer: 7 },
    { ruiter: 'Seniorruiter', paard: 'Paard', klasse: 'we0', rubriek: 'Algemeen', startnummer: 10 }];
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
async function select(index, value) {
  await act(async () => { const el = container.querySelectorAll('select')[index]; el.value = value; el.dispatchEvent(new Event('change', { bubbles: true })); });
}
async function click(text) {
  const el = [...container.querySelectorAll('button')].find(b => b.textContent === text);
  await act(async () => el.click());
}
it('loads youth separately, keeps start numbers and clears participants when changing class', async () => {
  await act(async () => root.render(<ProtocolGenerator />));
  await select(1, 'we0'); await select(2, 'dressuur'); await select(3, 'jeugd');
  await click('Volgende: Items & Deelnemers'); await click('Laad deelnemers uit DB');
  expect(container.textContent).toContain('007 - Jeugdruiter');
  expect(container.textContent).not.toContain('Seniorruiter');
  expect(container.textContent).not.toContain('[object Object]');
  await click('Terug'); await select(1, 'we1'); await click('Volgende: Items & Deelnemers');
  expect(container.textContent).not.toContain('Jeugdruiter');
});
it('uses the UUID for saved style items', async () => {
  await act(async () => root.render(<ProtocolGenerator />));
  await select(1, 'we0'); await select(2, 'stijl');
  expect(db.calls).toContainEqual(['proeven_items', 'proef_id', 'proef-uuid']);
});
it('recovers a local course and reloads the central save without local storage', async () => {
  localStorage.setItem('protocol_items_w_we0_stijl', JSON.stringify(['Slalom','Brug']));
  await act(async () => root.render(<ProtocolGenerator />));
  await select(1, 'we0'); await select(2, 'stijl');
  expect(container.textContent).toContain('teruggevonden');
  await click('Volgende: Items & Deelnemers');
  await click('Opslaan bij wedstrijd');
  expect(db.protocols.we0).toEqual(['Slalom','Brug']);
  expect(container.textContent).toContain('Opgeslagen bij de wedstrijd');
  localStorage.clear();
  await click('Terug'); await select(1, 'we1'); await select(1, 'we0');
  expect(container.textContent).toContain('Opgeslagen parcours geladen: 2 hindernissen');
});
it('recovers all local courses without overwriting a central course', async () => {
  db.protocols.we0 = ['Brug'];
  localStorage.setItem('protocol_items_w_we0_stijl', '["Slalom"]');
  localStorage.setItem('protocol_items_w_we1_stijl', '["Sprong"]');
  localStorage.setItem('protocol_items_w_yr_stijl', '["Poort achterwaarts"]');
  await act(async () => root.render(<ProtocolGenerator />));
  await click('Lokale stijlparcoursen veiligstellen');
  expect(db.protocols).toEqual({we0:['Brug'],we1:['Sprong'],yr:['Poort achterwaarts']});
  expect(container.textContent).toContain('2 lokale stijlparcoursen teruggevonden en centraal opgeslagen');
});
it('does not restore obsolete local participants after a database error', async () => {
  db.error = { message: 'Verbinding verbroken' };
  localStorage.setItem('startlijst_w', JSON.stringify([{ type: 'entry', klasse: 'we0', ruiter: 'Afgemelde ruiter' }]));
  await act(async () => root.render(<ProtocolGenerator />));
  await select(1, 'we0'); await select(2, 'dressuur');
  await click('Volgende: Items & Deelnemers'); await click('Laad deelnemers uit DB');
  expect(container.textContent).not.toContain('Afgemelde ruiter');
  await click('Terug');
  expect(container.textContent).toContain('Verbinding verbroken');
});

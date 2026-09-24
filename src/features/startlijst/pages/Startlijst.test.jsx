import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Startlijst from './Startlijst';

const db = vi.hoisted(() => ({ entries: [], config: {}, rpc: vi.fn() }));
vi.mock('@/features/inschrijven/pages/hooks/useWedstrijden', () => ({ useWedstrijden: () => ({ items: [{ id: 'w', naam: 'Testwedstrijd' }], loading: false }) }));
vi.mock('@/features/wedstrijden/context/WedstrijdContext', () => ({ useWedstrijdContext: () => ({ selectedWedstrijdId: 'w' }) }));
vi.mock('@/lib/supabaseClient', () => ({ supabase: {
  rpc: (...args) => db.rpc(...args),
  from: table => {
    const filters = [];
    const query = {
      select: () => query, eq: (key, value) => { filters.push([key, value]); return query; }, or: () => query,
      maybeSingle: async () => ({ data: { startlijst_config: db.config } }),
      then: resolve => Promise.resolve({ data: table === 'inschrijvingen'
        ? db.entries.filter(row => filters.every(([key, value]) => row[key] === value)) : [] }).then(resolve),
    };
    return query;
  },
} }));

let container, root;
async function mount() {
  root = createRoot(container);
  await act(async () => { root.render(<MemoryRouter><Startlijst /></MemoryRouter>); });
}
beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  window.history.replaceState({}, '', '/?wedstrijd_id=w');
  db.config = {};
  db.entries = [
    { id: 'a', ruiter: 'Ruiter A', paard: 'Paard A', klasse: 'WE0', startnummer: 1, wedstrijd_id: 'w', volgorde: 0 },
    { id: 'b', ruiter: 'Ruiter B', paard: 'Paard B', klasse: 'WE4', startnummer: 2, wedstrijd_id: 'w', volgorde: 1 },
  ];
  db.rpc.mockReset();
  db.rpc.mockImplementation(async (_name, { p_rows, p_config, p_scope }) => {
    db.entries = p_rows.filter(r => r.type === 'entry').map((r, i) => ({ ...r, wedstrijd_id: 'w', startnummer: Number(r.startnummer), volgorde: i }));
    const saved = { ...p_config, rowOrder: p_rows.map(r => ({ id: r.id, type: r.type })), pauses: [] };
    db.config = { ...saved, startlijstScopes: { [p_scope]: saved } };
    return { data: p_rows };
  });
  container = document.createElement('div'); document.body.append(container);
});
afterEach(async () => { await act(async () => root?.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const visibleOrder = () => [...container.querySelectorAll('tbody tr[draggable]')].map(row => row.textContent.includes('Ruiter A') ? 'a' : 'b');

it('opens the list, changes cross-class order, saves and reloads the same order', async () => {
  await mount();
  expect(visibleOrder()).toEqual(['a', 'b']);
  await act(async () => container.querySelector('button[title="Verplaats klasse naar beneden"]').click());
  expect(visibleOrder()).toEqual(['b', 'a']);
  const save = [...container.querySelectorAll('button')].find(button => button.textContent.trim() === 'Opslaan');
  await act(async () => save.click());
  expect(db.rpc).toHaveBeenCalledWith('save_startlijst', expect.objectContaining({ p_wedstrijd_id: 'w' }));
  expect(container.textContent).toContain('deelnemers en instellingen opgeslagen');
  await act(async () => root.unmount());
  await mount();
  expect(visibleOrder()).toEqual(['b', 'a']);
});

it('does not bring cancelled participants back from localStorage on an empty list', async () => {
  db.entries = [];
  localStorage.setItem('startlijst_w', JSON.stringify([{ id: 'a', type: 'entry', ruiter: 'Afgemelde ruiter' }]));
  await mount();
  expect(container.textContent).not.toContain('Afgemelde ruiter');
  expect(visibleOrder()).toEqual([]);
});

it('loads WE0 aliases and preserves padded numbers after save and reload', async () => {
  db.entries.push({ id: 'c', ruiter: 'Jeugdruiter', paard: 'Pony', klasse: '0', rubriek: 'Jeugd', startnummer: 7, wedstrijd_id: 'w', volgorde: 2 });
  await mount();
  const select = [...container.querySelectorAll('select')].find(el =>
    [...el.options].some(option => option.textContent === 'Alle klassen'));
  await act(async () => { select.value = 'WE0'; select.dispatchEvent(new Event('change', { bubbles: true })); });
  expect(container.textContent).toContain('Ruiter A');
  expect(container.textContent).toContain('Jeugdruiter');
  expect(container.textContent).not.toContain('Ruiter B');
  expect(container.textContent).toContain('001');
  expect(container.textContent).toContain('007');
  const save = [...container.querySelectorAll('button')].find(button => button.textContent.trim() === 'Opslaan');
  await act(async () => save.click());
  await act(async () => root.unmount());
  await mount();
  expect(container.textContent).toContain('001');
  expect(container.textContent).toContain('007');
});

it('shows a failed save without a success notification', async () => {
  await mount();
  db.rpc.mockResolvedValue({ error: { message: 'Geen beheerrechten' } });
  vi.stubGlobal('alert', vi.fn());
  const save = [...container.querySelectorAll('button')].find(button => button.textContent.trim() === 'Opslaan');
  await act(async () => save.click());
  expect(container.textContent).toContain('Geen beheerrechten');
  expect(container.textContent).not.toContain('deelnemers en instellingen opgeslagen');
});

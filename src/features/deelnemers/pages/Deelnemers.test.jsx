import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import Deelnemers from './Deelnemers';

const db = vi.hoisted(() => ({
  wedstrijd: { id: 'w', naam: 'Testwedstrijd', wachtlijst_enabled: false },
  entries: [], scores: [], update: vi.fn(), rpc: vi.fn(), reads: [],
}));
vi.mock('@/features/inschrijven/pages/hooks/useWedstrijden', () => ({ useWedstrijden: () => ({ items: [], loading: false }) }));
vi.mock('@/features/wedstrijden/context/WedstrijdContext', () => ({ useWedstrijdContext: () => ({ selectedWedstrijdId: 'w', selectedWedstrijd: db.wedstrijd }) }));
vi.mock('@/lib/supabaseClient', () => ({ supabase: {
  rpc: (...args) => db.rpc(...args),
  from: table => {
    db.reads.push(table);
    let patch;
    const filters = [];
    const q = {
      select: () => q, eq: (key, value) => { filters.push([key, value]); return q; }, order: () => q, limit: () => q,
      update: value => { patch = value; return q; },
      single: async () => {
        db.update(patch, filters);
        const entry = db.entries.find(row => filters.every(([key, value]) => row[key] === value));
        if (!entry) return { error: { message: 'Geen rij bijgewerkt' } };
        Object.assign(entry, patch);
        return { data: { id: entry.id } };
      },
      then: resolve => Promise.resolve({ data: table === 'inschrijvingen' ? db.entries.map(row => ({ ...row })) : table === 'scores' ? db.scores : [] }).then(resolve),
    };
    return q;
  },
} }));
let root, container;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear(); db.reads = []; db.scores = []; db.update.mockReset(); db.rpc.mockReset();
  db.wedstrijd.wachtlijst_enabled = false;
  db.entries = [{ id: 'a', wedstrijd_id: 'w', ruiter: 'Ruiter', paard: 'Pony', klasse: 'WE0 - Jeugd', rubriek: 'Algemeen', startnummer: 7, email: 'test@example.invalid', opmerkingen: 'Behouden', stal_toewijzing: { heeftStal: true, stalnummer: 'B12' } }];
  db.rpc.mockImplementation(async (name, args) => {
    if (name === 'afmelden_deelnemer') db.entries[0].deelnemer_status = 'afgemeld';
    return { data: null, error: null };
  });
  vi.stubGlobal('confirm', vi.fn(() => true));
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
async function mount() { await act(async () => root.render(<MemoryRouter><Deelnemers /></MemoryRouter>)); }
async function click(label) {
  const button = [...container.querySelectorAll('button')].find(el => el.textContent.trim() === label);
  expect(button).toBeTruthy(); await act(async () => button.click());
}
async function section(value) {
  await act(async () => {
    const select = container.querySelector('[aria-label=Rubriek]'); select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}
it('saves the separate section, reloads it and preserves unrelated registration fields', async () => {
  await mount(); await click('Wijzig'); await section('Senior'); await click('Opslaan');
  expect(db.update).toHaveBeenCalledWith({ klasse: 'we0', rubriek: 'Senior', paard: 'Pony' }, [['id', 'a'], ['wedstrijd_id', 'w']]);
  expect(db.entries[0]).toMatchObject({ email: 'test@example.invalid', opmerkingen: 'Behouden', startnummer: 7, stal_toewijzing: { stalnummer: 'B12' } });
  await click('Wijzig');
  expect(container.querySelector('[aria-label=Rubriek]').value).toBe('Senior');
});
it('blocks a section change when scores exist', async () => {
  db.scores = [{ id: 1 }];
  await mount(); await click('Wijzig'); await section('Senior'); await click('Opslaan');
  expect(db.update).not.toHaveBeenCalled();
  expect(container.textContent).toContain('heeft al scores');
});
it('uses transactional cancellation without consulting a disabled waiting list', async () => {
  await mount(); await click('Afmelden');
  expect(db.rpc).toHaveBeenCalledExactlyOnceWith('afmelden_deelnemer', { p_wedstrijd_id: 'w', p_deelnemer_id: 'a', p_wachtlijst_id: null });
  expect(db.reads).not.toContain('wachtlijst');
  expect(db.entries[0]).toMatchObject({ id: 'a', deelnemer_status: 'afgemeld', opmerkingen: 'Behouden' });
  expect(db.update).not.toHaveBeenCalled();
});
it('does not report cancellation as successful after an RPC failure', async () => {
  db.rpc.mockResolvedValue({ error: { message: 'Geen beheerrechten' } });
  await mount(); await click('Afmelden');
  expect(container.textContent).toContain('Afmelden mislukt: Geen beheerrechten');
  expect(db.entries[0].deelnemer_status).toBeUndefined();
});
it('edits stall preference, reloads it and preserves scores, start numbers and assigned stall', async () => {
  Object.assign(db.entries[0], {geboortedatum_ruiter:'2010-01-01',stokmaat_cm:165,stal_nodig:true,stalmaat:'klein'});
  db.scores = [{id:1}];
  await mount(); expect(container.textContent).toContain('165 cm'); await click('Wijzig');
  await act(async () => {
    const label=[...container.querySelectorAll('label')].find(el=>el.textContent.includes('Grote stal'));
    label.querySelector('input').click();
  });
  await click('Opslaan');
  expect(db.entries[0]).toMatchObject({stalmaat:'groot',geboortedatum_ruiter:'2010-01-01',startnummer:7,opmerkingen:'Behouden',stal_toewijzing:{stalnummer:'B12'}});
  expect(container.textContent).toContain('Grote stal');
  await click('Wijzig');
  expect([...container.querySelectorAll('label')].find(el=>el.textContent.includes('Grote stal')).querySelector('input').checked).toBe(true);
});

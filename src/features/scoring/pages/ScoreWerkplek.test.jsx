import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import ScoreWerkplek from './ScoreWerkplek';

const state = vi.hoisted(() => ({ isAdmin: false, selected: 'other' }));
vi.mock('@/features/auth/AdminGate', () => ({ useAccess: () => ({ isAdmin: state.isAdmin, scoreWedstrijdIds: ['assigned'] }) }));
vi.mock('@/features/wedstrijden/context/WedstrijdContext', () => ({ useWedstrijdContext: () => ({
  wedstrijden: [{ id: 'assigned', naam: 'Onstwedde' }, { id: 'other', naam: 'Andere wedstrijd' }],
  selectedWedstrijdId: state.selected, setSelectedWedstrijdId: vi.fn(), loadingWedstrijden: false,
}) }));
vi.mock('./ScoreInvoer', () => ({ default: () => <p>Scores bewerken</p> }));
let container, root;
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; state.isAdmin = false; state.selected = 'other'; container = document.createElement('div'); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); });
it('does not mount a volunteer page for an unassigned stored competition', async () => {
  await act(async () => root.render(<MemoryRouter><ScoreWerkplek><p>Deelnemers bekijken</p></ScoreWerkplek></MemoryRouter>));
  expect(container.textContent).not.toContain('Deelnemers bekijken');
  expect(container.textContent).not.toContain('Andere wedstrijd');
  expect([...container.querySelectorAll('a')].map(a => a.textContent)).toEqual(['Score-invoer', 'Deelnemers en stallen', 'Einduitslag']);
});
it('renders the read-only page for an assigned competition instead of score editing', async () => {
  state.selected = 'assigned';
  await act(async () => root.render(<MemoryRouter><ScoreWerkplek><p>Deelnemers bekijken</p></ScoreWerkplek></MemoryRouter>));
  expect(container.textContent).toContain('Deelnemers bekijken');
  expect(container.textContent).not.toContain('Scores bewerken');
});
it('keeps all competitions available to admins', async () => {
  state.isAdmin = true;
  await act(async () => root.render(<MemoryRouter><ScoreWerkplek /></MemoryRouter>));
  expect(container.textContent).toContain('Andere wedstrijd');
  expect(container.textContent).toContain('Scores bewerken');
});

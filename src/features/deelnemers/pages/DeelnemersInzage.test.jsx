import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { it, expect, vi } from 'vitest';
import DeelnemersInzage from './DeelnemersInzage';

const query = vi.hoisted(() => ({ eq: vi.fn(), order: vi.fn() }));
vi.mock('@/features/wedstrijden/context/WedstrijdContext', () => ({ useWedstrijdContext: () => ({ selectedWedstrijdId: 'assigned' }) }));
vi.mock('@/lib/supabaseClient', () => ({ supabase: { from: () => ({ select: () => ({ eq: query.eq }) }) } }));

it('reads shared stalls without browser storage and offers no participant mutations', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  query.eq.mockReturnValue({ order: query.order });
  query.order.mockResolvedValue({ data: [{ id: 'a', ruiter: 'Test ruiter', paard: 'Paard', stal_toewijzing: { heeftStal: true, stalnummer: 'B12' } }] });
  localStorage.clear();
  const container = document.createElement('div');
  const root = createRoot(container);
  try {
    await act(async () => root.render(<DeelnemersInzage />));
    expect(query.eq).toHaveBeenCalledWith('wedstrijd_id', 'assigned');
    expect(container.textContent).toContain('B12');
    expect([...container.querySelectorAll('button')].map(b => b.textContent)).toEqual(['Verversen']);
    expect(container.textContent).not.toContain('Afmelden');
    expect(container.textContent).not.toContain('Stal toewijzen');
    query.order.mockResolvedValue({ error: { message: 'denied' } });
    await act(async () => container.querySelector('button').click());
    expect(container.querySelector('[role="alert"]').textContent).toContain('niet worden geladen');
    expect(container.textContent).not.toContain('B12');
  } finally { await act(async () => root.unmount()); }
});

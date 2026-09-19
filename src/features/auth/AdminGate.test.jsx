import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AdminGate from './AdminGate';

const mock = vi.hoisted(() => ({ callback: null, read: vi.fn(), signIn: vi.fn(), unsubscribe: vi.fn() }));
vi.mock('@/lib/supabaseClient', () => ({ supabase: {
  auth: {
    onAuthStateChange: callback => { mock.callback = callback; return { data: { subscription: { unsubscribe: mock.unsubscribe } } }; },
    signInWithPassword: (...args) => mock.signIn(...args), signOut: vi.fn(),
  },
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mock.read }) }) }),
} }));

describe('admin route gate', () => {
  let container, root;
  beforeEach(async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    mock.read.mockReset();
    container = document.createElement('div'); document.body.append(container);
    root = createRoot(container);
    await act(async () => root.render(<AdminGate><p>Beheer startlijst</p></AdminGate>));
  });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
  async function session(user, appMetadata = {}) {
    await act(async () => { mock.callback('SIGNED_IN', user ? { user: { id: user, app_metadata: appMetadata } } : null); await new Promise(resolve => setTimeout(resolve, 5)); });
  }
  it('asks anonymous visitors to log in and does not mount management', async () => {
    await session(null);
    expect(container.textContent).toContain('Inloggen voor wedstrijdbeheer');
    expect(container.textContent).not.toContain('Beheer startlijst');
    expect(mock.read).not.toHaveBeenCalled();
  });
  it('denies ordinary participants, including metadata-only admins', async () => {
    mock.read.mockResolvedValue({ data: null });
    await session('participant');
    expect(container.textContent).toContain('geen beheerrechten');
    expect(container.textContent).not.toContain('Beheer startlijst');
  });
  it('allows a database admin and preserves the editor on token refresh', async () => {
    mock.read.mockResolvedValue({ data: { user_id: 'admin' } });
    await session('admin');
    expect(container.textContent).toContain('Beheer startlijst');
    const editor = container.querySelector('p');
    await session('admin');
    expect(container.querySelector('p')).toBe(editor);
    expect(mock.read).toHaveBeenCalledTimes(1);
    await session(null);
    expect(container.textContent).not.toContain('Beheer startlijst');
  });
  it('fails closed if the rights query fails', async () => {
    mock.read.mockResolvedValue({ error: { message: 'network failure' } });
    await session('admin');
    expect(container.textContent).not.toContain('Beheer startlijst');
    expect(container.textContent).toContain('konden niet worden gecontroleerd');
  });
  it('allows a scoped volunteer only on the score route', async () => {
    mock.read.mockResolvedValue({ data: null });
    await session('volunteer', { score_wedstrijd_ids: ['wedstrijd'] });
    expect(container.textContent).not.toContain('Beheer startlijst');
    expect(container.textContent).toContain('Ga naar score-invoer');
    await act(async () => root.render(<AdminGate allowScorer><p>Scorewerkplek</p></AdminGate>));
    expect(container.textContent).toContain('Scorewerkplek');
  });
});

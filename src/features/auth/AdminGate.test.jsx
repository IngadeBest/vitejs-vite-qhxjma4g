import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AdminGate from './AdminGate';

const mock = vi.hoisted(() => ({ callback: null, read: vi.fn(), signIn: vi.fn(), unsubscribe: vi.fn(), signOut: vi.fn() }));
vi.mock('@/lib/supabaseClient', () => ({ supabase: {
  auth: {
    onAuthStateChange: callback => { mock.callback = callback; return { data: { subscription: { unsubscribe: mock.unsubscribe } } }; },
    signInWithPassword: (...args) => mock.signIn(...args), signOut: (...args) => mock.signOut(...args),
  },
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mock.read }) }) }),
} }));

describe('admin route gate', () => {
  let container, root;
  beforeEach(async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    mock.read.mockReset();
    mock.signIn.mockReset();
    mock.signOut.mockReset();
    mock.signOut.mockResolvedValue({ error: null });
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
  async function submit(email = ' Admin@Example.nl ', password = 'entered-password') {
    await session(null);
    await act(async () => {
      const inputs = container.querySelectorAll('input');
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      for (const [index, value] of [email, password].entries()) {
        setter.call(inputs[index], value);
        inputs[index].dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await act(async () => container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  }
  it('normalizes email, preserves the password and admits a successful admin login', async () => {
    mock.read.mockResolvedValue({ data: { user_id: 'admin' } });
    mock.signIn.mockImplementation(async () => {
      mock.callback('SIGNED_IN', { user: { id: 'admin' } });
      return { error: null };
    });
    await submit('Admin@Example.nl', ' password with spaces ');
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
    expect(mock.signIn).toHaveBeenCalledWith({ email: 'admin@example.nl', password: ' password with spaces ' });
    expect(container.textContent).toContain('Beheer startlijst');
  });
  it.each(['wrong-password', 'unknown-email'])('rejects %s with the same safe message', async () => {
    mock.signIn.mockResolvedValue({ error: { code: 'invalid_credentials', status: 400 } });
    await submit();
    expect(container.textContent).toContain('Controleer je e-mailadres en wachtwoord');
    expect(container.textContent).not.toContain('Beheer startlijst');
    expect(container.querySelector('input[type=password]').value).toBe('');
    expect(container.querySelector('button').disabled).toBe(false);
  });
  it.each([new TypeError('Failed to fetch'), { code: 'unexpected_failure', status: 500 }, { status: 401 }])('distinguishes technical login failures', async failure => {
    mock.signIn.mockRejectedValue(failure);
    await submit();
    expect(container.textContent).toContain('technische fout');
    expect(container.textContent).not.toContain('Controleer je e-mailadres');
    expect(container.querySelector('button').disabled).toBe(false);
  });
  it('restores access from the initial persisted session after a page reload', async () => {
    mock.read.mockResolvedValue({ data: { user_id: 'admin' } });
    await act(async () => {
      mock.callback('INITIAL_SESSION', { user: { id: 'admin' } });
      await new Promise(resolve => setTimeout(resolve, 10));
    });
    expect(container.textContent).toContain('Beheer startlijst');
  });
  it('logs out and hides protected content', async () => {
    mock.read.mockResolvedValue({ data: { user_id: 'admin' } });
    await session('admin');
    await act(async () => container.querySelector('button').click());
    expect(mock.signOut).toHaveBeenCalledOnce();
    expect(container.textContent).not.toContain('Beheer startlijst');
    expect(container.querySelector('form')).not.toBeNull();
  });
  it('reports a failed logout without claiming the session ended', async () => {
    mock.read.mockResolvedValue({ data: { user_id: 'admin' } });
    mock.signOut.mockResolvedValue({ error: { status: 503 } });
    await session('admin');
    await act(async () => container.querySelector('button').click());
    expect(container.textContent).toContain('Uitloggen is niet gelukt');
  });
  it('does not describe a thrown permissions query as missing rights', async () => {
    mock.read.mockRejectedValue(new TypeError('Failed to fetch'));
    await session('admin');
    expect(container.textContent).toContain('konden niet worden gecontroleerd');
    expect(container.textContent).not.toContain('geen beheerrechten');
    expect(container.textContent).not.toContain('Beheer startlijst');
  });

});

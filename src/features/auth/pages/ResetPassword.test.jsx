import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import ResetPassword from './ResetPassword';

const auth = vi.hoisted(() => ({ getSession: vi.fn(), exchangeCodeForSession: vi.fn(), updateUser: vi.fn(), signOut: vi.fn() }));
vi.mock('@/lib/supabaseClient', () => ({ supabase: { auth } }));
let root, container;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.resetAllMocks();
  auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u' } } } });
  auth.updateUser.mockResolvedValue({}); auth.signOut.mockResolvedValue({});
  window.history.replaceState(null, '', '/#/nieuw-wachtwoord');
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
async function mount() { await act(async () => root.render(<ResetPassword />)); }
async function submit(password, repeat = password) {
  await act(async () => {
    for (const [index, value] of [password, repeat].entries()) {
      const input = container.querySelectorAll('input')[index];
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  await act(async () => container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
}
it('uses the initialized recovery session, clears URL credentials and saves once', async () => {
  window.history.replaceState(null, '', '/?code=already-consumed');
  await mount();
  expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  expect(window.location.search).toBe('');
  await submit('new-password');
  expect(auth.updateUser).toHaveBeenCalledExactlyOnceWith({ password: 'new-password' });
  expect(auth.signOut).toHaveBeenCalledTimes(1);
  expect(container.querySelector('[role=status]').textContent).toContain('opgeslagen');
  expect(container.querySelector('button').disabled).toBe(true);
});
it('exchanges an unhandled PKCE code only when no session exists', async () => {
  window.history.replaceState(null, '', '/?code=unused');
  auth.getSession.mockResolvedValue({ data: { session: null } });
  auth.exchangeCodeForSession.mockResolvedValue({ data: { session: { user: { id: 'u' } } } });
  await mount();
  expect(auth.exchangeCodeForSession).toHaveBeenCalledExactlyOnceWith('unused');
  expect(container.querySelector('button').disabled).toBe(false);
});
it('blocks an expired link even with a previous session', async () => {
  window.history.replaceState(null, '', '/#error_code=otp_expired');
  await mount();
  expect(container.querySelector('[role=alert]').textContent).toContain('verlopen');
  expect(container.querySelector('button').disabled).toBe(true);
  expect(auth.updateUser).not.toHaveBeenCalled();
});
it('validates matching passwords and permits retry after a network error', async () => {
  await mount(); await submit('password-a', 'password-b');
  expect(auth.updateUser).not.toHaveBeenCalled();
  auth.updateUser.mockRejectedValueOnce(new Error('Verbinding verbroken'));
  await submit('password-a');
  expect(container.querySelector('[role=alert]').textContent).toContain('Verbinding verbroken');
  expect(container.querySelector('button').disabled).toBe(false);
  await submit('password-a');
  expect(container.querySelector('[role=status]').textContent).toContain('opgeslagen');
});

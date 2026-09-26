import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

// Log only diagnostic fields, never credentials, tokens or complete error objects.
function reportFailure(stage, error) {
  console.error('[wedstrijdbeheer-auth]', {
    stage, code: error?.code, status: error?.status, name: error?.name,
    timestamp: new Date().toISOString(),
  });
}
function loginMessage(error) {
  if (error?.code === 'invalid_credentials') return 'Inloggen mislukt. Controleer je e-mailadres en wachtwoord.';
  if (error?.status === 429) return 'Te veel inlogpogingen. Wacht even en probeer opnieuw.';
  return 'Inloggen is momenteel niet mogelijk door een technische fout. Probeer opnieuw of neem contact op met de beheerder.';
}

const AccessContext = createContext({ isAdmin: false, scoreWedstrijdIds: [] });
export const useAccess = () => useContext(AccessContext);

// This gate is only UX. RLS and the invoker RPCs enforce authorization in Postgres.
export default function AdminGate({ children, allowScorer = false }) {
  const [status, setStatus] = useState('loading');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const [scoreWedstrijdIds, setScoreWedstrijdIds] = useState([]);

  useEffect(() => {
    let active = true;
    let generation = 0;
    let checkedUserId = null;
    async function check(session) {
      if (session?.user?.id && session.user.id === checkedUserId) return;
      const current = ++generation;
      if (!session?.user) {
        checkedUserId = null;
        if (active) { setStatus('login'); setScoreWedstrijdIds([]); setError(''); }
        return;
      }
      if (active) setStatus('loading');
      let data, readError;
      try {
        ({ data, error: readError } = await supabase.from('admins')
          .select('user_id').eq('user_id', session.user.id).maybeSingle());
      } catch (failure) { readError = failure; }
      if (active && current === generation) {
        checkedUserId = readError ? null : session.user.id;
        const ids = session.user.app_metadata?.score_wedstrijd_ids;
        const scopedIds = Array.isArray(ids) ? ids.filter(id => typeof id === 'string') : [];
        setScoreWedstrijdIds(scopedIds);
        setStatus(readError ? 'error' : data ? 'admin' : scopedIds.length ? 'scorer' : 'denied');
        if (readError) {
          reportFailure('permissions', readError);
          setError('Beheerrechten konden niet worden gecontroleerd. Probeer opnieuw.');
        } else setError('');
      }
    }
    // Defer DB work outside the auth callback to avoid blocking token refresh.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => { if (active) void check(session); }, 0);
    });
    return () => { active = false; generation++; subscription.unsubscribe(); };
  }, [retry]);

  async function login(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (loginError) throw loginError;
    } catch (failure) {
      reportFailure('password-login', failure);
      setError(loginMessage(failure));
    } finally {
      setPassword('');
      setBusy(false);
    }
  }

  async function logout() {
    setError('');
    try {
      const { error: logoutError } = await supabase.auth.signOut();
      if (logoutError) throw logoutError;
      setScoreWedstrijdIds([]);
      setStatus('login');
    } catch (failure) {
      reportFailure('logout', failure);
      setError('Uitloggen is niet gelukt. Probeer opnieuw.');
    }
  }

  if (status === 'loading') return <p role="status">Beheerrechten controleren…</p>;
  if (status === 'admin' || (status === 'scorer' && allowScorer)) return <AccessContext.Provider value={{ isAdmin: status === 'admin', scoreWedstrijdIds }}><div style={{ textAlign: 'right', padding: 8 }}>
    <button onClick={logout}>Uitloggen</button>
    {error && <p role="alert">{error}</p>}
  </div>{children}</AccessContext.Provider>;
  return <section style={{ maxWidth: 420, margin: '48px auto', padding: 24 }}>
    <h1>Inloggen voor wedstrijdbeheer</h1>
    {status === 'error' ? <>
      <button onClick={() => { setStatus('loading'); setRetry(value => value + 1); }}>Opnieuw proberen</button>
      <button onClick={logout}>Uitloggen</button>
    </> : status === 'denied' || status === 'scorer' ? <>
      <p>Je account heeft geen beheerrechten. Alleen bevoegde admins en organisatoren mogen startlijsten beheren.</p>
      {status === 'scorer' && <p><a href="#/scores">Ga naar score-invoer voor jouw wedstrijd</a></p>}
      <button onClick={logout}>Met een ander account inloggen</button>
    </> : <form onSubmit={login} style={{ display: 'grid', gap: 12 }}>
      <label>E-mailadres<input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} /></label>
      <label>Wachtwoord<input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></label>
      <button disabled={busy}>{busy ? 'Inloggen…' : 'Inloggen'}</button>
    </form>}
    {error && <p role="alert">{error}</p>}
  </section>;
}

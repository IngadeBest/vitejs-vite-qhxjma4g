import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

const AccessContext = createContext({ isAdmin: false, scoreWedstrijdIds: [] });
export const useAccess = () => useContext(AccessContext);

// This gate is only UX. RLS and the invoker RPCs enforce authorization in Postgres.
export default function AdminGate({ children, allowScorer = false }) {
  const [status, setStatus] = useState('loading');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
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
        if (active) setStatus('login');
        return;
      }
      if (active) setStatus('loading');
      const { data, error: readError } = await supabase.from('admins')
        .select('user_id').eq('user_id', session.user.id).maybeSingle();
      if (active && current === generation) {
        checkedUserId = session.user.id;
        const ids = session.user.app_metadata?.score_wedstrijd_ids;
        const scopedIds = Array.isArray(ids) ? ids.filter(id => typeof id === 'string') : [];
        setScoreWedstrijdIds(scopedIds);
        setStatus(readError ? 'denied' : data ? 'admin' : scopedIds.length ? 'scorer' : 'denied');
        if (readError) setError('Beheerrechten konden niet worden gecontroleerd. Probeer opnieuw.');
      }
    }
    // Defer DB work outside the auth callback to avoid blocking token refresh.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => { if (active) void check(session); }, 0);
    });
    return () => { active = false; generation++; subscription.unsubscribe(); };
  }, []);

  async function login(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const { error: loginError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setPassword('');
    if (loginError) setError('Inloggen mislukt. Controleer je e-mailadres en wachtwoord.');
    setBusy(false);
  }

  if (status === 'loading') return <p role="status">Beheerrechten controleren…</p>;
  if (status === 'admin' || (status === 'scorer' && allowScorer)) return <AccessContext.Provider value={{ isAdmin: status === 'admin', scoreWedstrijdIds }}><div style={{ textAlign: 'right', padding: 8 }}>
    <button onClick={() => supabase.auth.signOut()}>Uitloggen</button>
  </div>{children}</AccessContext.Provider>;
  return <section style={{ maxWidth: 420, margin: '48px auto', padding: 24 }}>
    <h1>Inloggen voor wedstrijdbeheer</h1>
    {status === 'denied' || status === 'scorer' ? <>
      <p>Je account heeft geen beheerrechten. Alleen bevoegde admins en organisatoren mogen startlijsten beheren.</p>
      {status === 'scorer' && <p><a href="#/scores">Ga naar score-invoer voor jouw wedstrijd</a></p>}
      <button onClick={() => supabase.auth.signOut()}>Met een ander account inloggen</button>
    </> : <form onSubmit={login} style={{ display: 'grid', gap: 12 }}>
      <label>E-mailadres<input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} /></label>
      <label>Wachtwoord<input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></label>
      <button disabled={busy}>{busy ? 'Inloggen…' : 'Inloggen'}</button>
    </form>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
